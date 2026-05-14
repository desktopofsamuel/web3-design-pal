import { collectTextTargets, isApplySupportedEditor } from '../selection';
import type { PriceCard, PriceLayerMatch, PriceLayerScanResult } from '../types';

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
    else if (isKnownLiteralTicker) {
      // Auto-detect: text content is a known ticker symbol (e.g. "BTC", "ETH").
      // Mark as literal so the apply step preserves the text and only updates
      // adjacent data layers ({price}, {change}, etc.) for that coin.
      result.push({ nodeId: t.id, layerName: name, currentText: chars, role: 'crypto', isLiteral: true });
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
      // If all children are partial (e.g. selected node is a Row whose direct children
      // are individual text layers), fall through and match the root as one card instead.
      const dataRoles = new Set(['price', 'change', 'volume', 'mcap']);
      const hasFullChildCard = childCards.some(c =>
        c.matches.some(m => m.role === 'crypto') &&
        c.matches.some(m => dataRoles.has(m.role))
      );
      if (hasFullChildCard) {
        figma.ui.postMessage({ type: 'price-layer-scan', cards: childCards } satisfies PriceLayerScanResult);
        return;
      }
    }
    const matches = matchesInNode(root, ...vars);
    if (matches.length > 0) cards.push({ cardName: root.name, matches });
  }

  figma.ui.postMessage({ type: 'price-layer-scan', cards } satisfies PriceLayerScanResult);
}
