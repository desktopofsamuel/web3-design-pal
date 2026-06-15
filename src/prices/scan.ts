import { SUPPORTED_VS_FIAT_UPPER } from '../constants';
import { collectTextTargets, isApplySupportedEditor } from '../selection';
import type { PriceCard, PriceLayerMatch, PriceLayerScanResult } from '../types';

const DATA_ROLES = new Set<PriceLayerMatch['role']>(['price', 'change', 'volume', 'mcap']);

function isFullCard(matches: PriceLayerMatch[]): boolean {
  return matches.some((m) => m.role === 'crypto') && matches.some((m) => DATA_ROLES.has(m.role));
}

function absoluteY(node: SceneNode): number {
  if ('absoluteBoundingBox' in node && node.absoluteBoundingBox) {
    return node.absoluteBoundingBox.y;
  }
  return node.y;
}

function isGridLayoutFrame(node: SceneNode): node is FrameNode & { layoutMode: 'GRID' } {
  return 'layoutMode' in node && (node as FrameNode).layoutMode === 'GRID';
}

function hasGridRowIndex(node: SceneNode): node is SceneNode & { gridRowAnchorIndex: number } {
  return (
    'gridRowAnchorIndex' in node &&
    typeof (node as { gridRowAnchorIndex?: unknown }).gridRowAnchorIndex === 'number'
  );
}

/** Row index for a text node inside a GRID auto-layout frame (via direct-child ancestor). */
function gridRowKeyForText(textNode: TextNode, gridRoot: SceneNode & ChildrenMixin): number | null {
  let node: BaseNode | null = textNode;
  while (node && node !== gridRoot) {
    if (node.parent === gridRoot) {
      const candidate = node as SceneNode;
      if (hasGridRowIndex(candidate)) return candidate.gridRowAnchorIndex;
      return absoluteY(candidate);
    }
    node = node.parent;
  }
  return null;
}

function rowKeyForText(textNode: TextNode, root: SceneNode & ChildrenMixin): number {
  if (isGridLayoutFrame(root)) {
    const gridKey = gridRowKeyForText(textNode, root);
    if (gridKey !== null) return gridKey;
  }
  return absoluteY(textNode);
}

function cardNameFromRowMatches(
  rowMatches: PriceLayerMatch[],
  index: number,
  cryptoVar: string,
): string {
  const crypto = rowMatches.find((m) => m.role === 'crypto');
  if (!crypto) return `Row ${index + 1}`;
  const text = crypto.currentText.trim();
  if (crypto.isLiteral || (text && text !== cryptoVar && !text.includes(cryptoVar))) {
    return text;
  }
  return `Row ${index + 1}`;
}

/**
 * When a table/grid holds multiple coin rows in one frame, group matched layers by
 * visual row (Figma GRID row index, or clustered absolute Y) so each row is its own card.
 */
function groupMatchesByVisualRow(
  root: SceneNode & ChildrenMixin,
  matches: PriceLayerMatch[],
  cryptoVar: string,
): PriceCard[] | null {
  const cryptoCount = matches.filter((m) => m.role === 'crypto').length;
  if (cryptoCount <= 1) return null;

  const textNodes = collectTextTargets([root]);
  const rowKeyById = new Map(textNodes.map((t) => [t.id, rowKeyForText(t, root)]));

  const useGridRows = isGridLayoutFrame(root);
  const ROW_TOLERANCE = 8;
  const rowBuckets: { anchorKey: number; matches: PriceLayerMatch[] }[] = [];

  for (const m of matches) {
    const key = rowKeyById.get(m.nodeId);
    if (key === undefined) continue;

    let bucket = useGridRows
      ? rowBuckets.find((b) => b.anchorKey === key)
      : rowBuckets.find((b) => Math.abs(b.anchorKey - key) <= ROW_TOLERANCE);
    if (!bucket) {
      bucket = { anchorKey: key, matches: [] };
      rowBuckets.push(bucket);
    } else if (!useGridRows) {
      bucket.anchorKey = (bucket.anchorKey + key) / 2;
    }
    bucket.matches.push(m);
  }

  rowBuckets.sort((a, b) => a.anchorKey - b.anchorKey);

  const cards: PriceCard[] = [];
  for (const bucket of rowBuckets) {
    if (!isFullCard(bucket.matches)) continue;
    cards.push({
      cardName: cardNameFromRowMatches(bucket.matches, cards.length, cryptoVar),
      matches: bucket.matches,
    });
  }

  return cards.length > 0 ? cards : null;
}

/**
 * Parses "BTC/AUD", "BTC / AUD", or "BTCAUD" when `base` is in known tickers and `fiat` is supported.
 */
function tryParseKnownTickerFiatPair(
  charsUpper: string,
  knownTickerSet: ReadonlySet<string>,
): { base: string; fiat: string } | null {
  const slash = charsUpper.match(/^([A-Z0-9]{2,})\s*\/\s*([A-Z]{3})$/);
  if (slash) {
    const base = slash[1];
    const fiat = slash[2];
    if (knownTickerSet.has(base) && SUPPORTED_VS_FIAT_UPPER.has(fiat)) return { base, fiat };
    return null;
  }
  const tickers = [...knownTickerSet].sort((a, b) => b.length - a.length);
  for (const t of tickers) {
    if (charsUpper.startsWith(t) && charsUpper.length > t.length) {
      const rest = charsUpper.slice(t.length);
      if (SUPPORTED_VS_FIAT_UPPER.has(rest)) return { base: t, fiat: rest };
    }
  }
  return null;
}

function matchesInNode(
  node: SceneNode,
  cryptoVar: string,
  priceVar: string,
  changeVar: string,
  volumeVar: string,
  mcapVar: string,
  knownTickerSet: ReadonlySet<string>,
): PriceLayerMatch[] {
  const result: PriceLayerMatch[] = [];
  for (const t of collectTextTargets([node])) {
    const name = t.name;
    const chars = t.characters;
    const charsUpper = chars.trim().toUpperCase();
    const isKnownLiteralTicker = knownTickerSet.has(charsUpper);
    if (name === cryptoVar || chars === cryptoVar)
      result.push({
        nodeId: t.id,
        layerName: name,
        currentText: chars,
        role: 'crypto',
        // If layer name is placeholder but content is a known ticker (e.g. name="{crypto}", text="BTC"),
        // preserve the literal ticker and only update sibling data layers.
        isLiteral: chars !== cryptoVar && isKnownLiteralTicker ? true : undefined,
      });
    else if (name === priceVar || chars === priceVar)
      result.push({ nodeId: t.id, layerName: name, currentText: chars, role: 'price' });
    else if (name === changeVar || chars === changeVar)
      result.push({ nodeId: t.id, layerName: name, currentText: chars, role: 'change' });
    else if (name === volumeVar || chars === volumeVar)
      result.push({ nodeId: t.id, layerName: name, currentText: chars, role: 'volume' });
    else if (name === mcapVar || chars === mcapVar)
      result.push({ nodeId: t.id, layerName: name, currentText: chars, role: 'mcap' });
    else if (chars.includes(priceVar))
      result.push({ nodeId: t.id, layerName: name, currentText: chars, role: 'price', matchedVar: priceVar });
    else if (chars.includes(changeVar))
      result.push({ nodeId: t.id, layerName: name, currentText: chars, role: 'change', matchedVar: changeVar });
    else if (chars.includes(volumeVar))
      result.push({ nodeId: t.id, layerName: name, currentText: chars, role: 'volume', matchedVar: volumeVar });
    else if (chars.includes(mcapVar))
      result.push({ nodeId: t.id, layerName: name, currentText: chars, role: 'mcap', matchedVar: mcapVar });
    else if (chars.includes(cryptoVar))
      result.push({ nodeId: t.id, layerName: name, currentText: chars, role: 'crypto', matchedVar: cryptoVar });
    // Layer NAME contains the token (e.g. name="A${price}") — covers the case where
    // the content has already been replaced with a real value like "A$23.00".
    else if (name.includes(priceVar))
      result.push({ nodeId: t.id, layerName: name, currentText: chars, role: 'price', namePrefix: name.replace(priceVar, '') });
    else if (name.includes(changeVar))
      result.push({ nodeId: t.id, layerName: name, currentText: chars, role: 'change', namePrefix: name.replace(changeVar, '') });
    else if (name.includes(volumeVar))
      result.push({ nodeId: t.id, layerName: name, currentText: chars, role: 'volume', namePrefix: name.replace(volumeVar, '') });
    else if (name.includes(mcapVar))
      result.push({ nodeId: t.id, layerName: name, currentText: chars, role: 'mcap', namePrefix: name.replace(mcapVar, '') });
    else if (name.includes(cryptoVar))
      result.push({ nodeId: t.id, layerName: name, currentText: chars, role: 'crypto', namePrefix: name.replace(cryptoVar, '') });
    else {
      const pair = tryParseKnownTickerFiatPair(charsUpper, knownTickerSet);
      if (pair) {
        result.push({
          nodeId: t.id,
          layerName: name,
          currentText: chars,
          role: 'crypto',
          isLiteral: true,
          quoteSymbol: pair.base,
          vsCurrency: pair.fiat.toLowerCase(),
        });
      } else if (isKnownLiteralTicker) {
        // Auto-detect: text content is a known ticker symbol (e.g. "BTC", "ETH").
        // Mark as literal so the apply step preserves the text and only updates
        // adjacent data layers ({price}, {change}, etc.) for that coin.
        result.push({ nodeId: t.id, layerName: name, currentText: chars, role: 'crypto', isLiteral: true });
      }
    }
  }
  return result;
}

export function scanPriceLayers(
  cryptoVar: string,
  priceVar: string,
  changeVar: string,
  volumeVar: string,
  mcapVar: string,
  knownTickers: string[],
): void {
  if (!isApplySupportedEditor()) {
    figma.ui.postMessage({ type: 'price-layer-scan', cards: [] } satisfies PriceLayerScanResult);
    return;
  }

  const sel = figma.currentPage.selection;
  if (sel.length === 0) {
    figma.ui.postMessage({ type: 'price-layer-scan', cards: [] } satisfies PriceLayerScanResult);
    return;
  }

  const cards: PriceCard[] = [];
  const tickerSet = new Set(knownTickers);
  const vars: [string, string, string, string, string, ReadonlySet<string>] = [
    cryptoVar, priceVar, changeVar, volumeVar, mcapVar, tickerSet,
  ];

  if (sel.length > 1) {
    for (const node of sel) {
      const matches = matchesInNode(node, ...vars);
      if (matches.length > 0) cards.push({ cardName: node.name, matches });
    }
  } else {
    const root = sel[0];
    if ('children' in root) {
      const childCards: PriceCard[] = [];
      for (const child of (root as SceneNode & ChildrenMixin).children) {
        const matches = matchesInNode(child, ...vars);
        if (matches.length > 0) childCards.push({ cardName: child.name, matches });
      }
      // Only split by children when at least one child is a full card (crypto + data).
      // If all children are partial (e.g. grid cells or a Row whose direct children
      // are individual text layers), fall through and match the root — then group by row.
      const hasFullChildCard = childCards.some((c) => isFullCard(c.matches));
      if (hasFullChildCard) {
        figma.ui.postMessage({ type: 'price-layer-scan', cards: childCards } satisfies PriceLayerScanResult);
        return;
      }
    }
    const matches = matchesInNode(root, ...vars);
    if (matches.length > 0) {
      const rowCards =
        'children' in root
          ? groupMatchesByVisualRow(root as SceneNode & ChildrenMixin, matches, cryptoVar)
          : null;
      if (rowCards) {
        cards.push(...rowCards);
      } else {
        cards.push({ cardName: root.name, matches });
      }
    }
  }

  figma.ui.postMessage({ type: 'price-layer-scan', cards } satisfies PriceLayerScanResult);
}
