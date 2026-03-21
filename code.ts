type Network = 'Ethereum' | 'Solana' | 'Bitcoin' | 'Ripple';

type SelectionContextMode =
  | 'create-on-page'
  | 'create-in-frame'
  | 'retext-one'
  | 'retext-many'
  | 'unsupported';

type SelectionContextMessage = {
  type: 'selection-context';
  textTargetCount: number;
  /** How many text layers Apply will touch (retext count, or new-text count for create flows). */
  previewBatchSize: number;
  mode: SelectionContextMode;
  /** `editor` when not in Figma/FigJam; `selection` when only non-appendable nodes selected */
  unsupportedReason?: 'editor' | 'selection';
};

type ApplyMessage = {
  type: 'apply';
  network: Network;
  /** Full generated address (always). */
  previewAddress: string;
  /** When true, apply the same shortened form as the preview (`0x1234…abcd`). */
  truncate: boolean;
  /** Characters from start / end when truncating (mirrors UI / clientStorage). */
  truncateStart?: number;
  truncateEnd?: number;
};

const DEFAULT_TRUNCATE_START = 6;
const DEFAULT_TRUNCATE_END = 4;
const FOOTER_BUY_ME_COFFEE_URL = 'https://example.com/buy-me-coffee';
const FOOTER_PROFILE_URL = 'https://desktopofsamuel.com/?ref=web3-design-pal';

/** Persisted via figma.clientStorage — see https://developers.figma.com/docs/plugins/api/figma-clientStorage/ */
const TRUNCATE_RULES_STORAGE_KEY = 'web3dpal_truncate_rules';

type TruncateRulesPayload = { start: number; end: number };

type GetTruncateRulesMessage = { type: 'get-truncate-rules' };
type SaveTruncateRulesMessage = {
  type: 'save-truncate-rules';
  start: number;
  end: number;
};
type GetFooterLinksMessage = { type: 'get-footer-links' };
type ResizeUiMessage = {
  type: 'resize-ui';
  height: number;
};

type TruncateRulesToUIMessage = {
  type: 'truncate-rules';
  start: number;
  end: number;
};
type FooterLinksToUIMessage = {
  type: 'footer-links';
  buyMeCoffeeUrl: string;
  profileUrl: string;
};

type CancelMessage = { type: 'cancel' };

type PluginMessageFromUI =
  | ApplyMessage
  | CancelMessage
  | GetTruncateRulesMessage
  | SaveTruncateRulesMessage
  | GetFooterLinksMessage
  | ResizeUiMessage;

const APPENDABLE_TYPES: SceneNode['type'][] = [
  'FRAME',
  'GROUP',
  'SECTION',
  'COMPONENT',
  'COMPONENT_SET',
  'INSTANCE',
];

const DEFAULT_FONT: FontName = { family: 'Inter', style: 'Regular' };

function normalizeStoredTruncateRules(raw: unknown): TruncateRulesPayload {
  if (!raw || typeof raw !== 'object') {
    return { start: DEFAULT_TRUNCATE_START, end: DEFAULT_TRUNCATE_END };
  }
  const o = raw as Record<string, unknown>;
  const s = o.start;
  const e = o.end;
  const start =
    typeof s === 'number' && !Number.isNaN(s)
      ? Math.max(0, Math.min(64, Math.floor(s)))
      : DEFAULT_TRUNCATE_START;
  const end =
    typeof e === 'number' && !Number.isNaN(e)
      ? Math.max(0, Math.min(64, Math.floor(e)))
      : DEFAULT_TRUNCATE_END;
  return { start, end };
}

async function pushTruncateRulesToUI(): Promise<void> {
  const stored = await figma.clientStorage.getAsync(TRUNCATE_RULES_STORAGE_KEY);
  const rules = normalizeStoredTruncateRules(stored);
  figma.ui.postMessage({ type: 'truncate-rules', ...rules } satisfies TruncateRulesToUIMessage);
}

function pushFooterLinksToUI(): void {
  figma.ui.postMessage({
    type: 'footer-links',
    buyMeCoffeeUrl: FOOTER_BUY_ME_COFFEE_URL,
    profileUrl: FOOTER_PROFILE_URL,
  } satisfies FooterLinksToUIMessage);
}

function isApplySupportedEditor(): boolean {
  return figma.editorType === 'figma' || figma.editorType === 'figjam';
}

function isAppendableContainer(node: SceneNode): node is SceneNode & ChildrenMixin {
  return APPENDABLE_TYPES.includes(node.type) && 'appendChild' in node;
}

function getAppendableContainers(
  selection: readonly SceneNode[],
): Array<SceneNode & ChildrenMixin> {
  return selection.filter(isAppendableContainer);
}

function collectTextTargets(selection: readonly SceneNode[]): TextNode[] {
  const ordered: TextNode[] = [];
  const seen = new Set<string>();

  function add(t: TextNode): void {
    if (seen.has(t.id)) return;
    seen.add(t.id);
    ordered.push(t);
  }

  for (const node of selection) {
    if (node.type === 'TEXT') {
      add(node);
    } else if ('findAll' in node) {
      const inner = (
        node as SceneNode & {
          findAll<T extends SceneNode>(predicate: (n: SceneNode) => n is T): T[];
        }
      ).findAll((n): n is TextNode => n.type === 'TEXT');
      for (const t of inner) add(t);
    }
  }

  return ordered;
}

function randomInt(max: number): number {
  return Math.floor(Math.random() * max);
}

function generateHex(length: number): string {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[randomInt(16)];
  }
  return result;
}

function generateBase58(length: number): string {
  const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[randomInt(chars.length)];
  }
  return result;
}

function generateAlphaNum(length: number): string {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[randomInt(chars.length)];
  }
  return result;
}

function formatAddressForCanvas(
  full: string,
  truncate: boolean,
  truncateStart?: number,
  truncateEnd?: number,
): string {
  if (!truncate) return full;
  const start =
    typeof truncateStart === 'number' && !Number.isNaN(truncateStart)
      ? Math.max(0, Math.min(64, Math.floor(truncateStart)))
      : DEFAULT_TRUNCATE_START;
  const end =
    typeof truncateEnd === 'number' && !Number.isNaN(truncateEnd)
      ? Math.max(0, Math.min(64, Math.floor(truncateEnd)))
      : DEFAULT_TRUNCATE_END;
  if (start + end >= full.length) return full;
  return `${full.slice(0, start)}...${full.slice(-end)}`;
}

function generateAddress(network: Network): string {
  switch (network) {
    case 'Ethereum':
      return '0x' + generateHex(40);
    case 'Solana':
      return generateBase58(44);
    case 'Bitcoin':
      return 'bc1' + generateAlphaNum(39);
    case 'Ripple':
      return 'r' + generateBase58(33);
    default:
      return '';
  }
}

function pushSelectionContext(): void {
  if (!isApplySupportedEditor()) {
    const msg: SelectionContextMessage = {
      type: 'selection-context',
      textTargetCount: 0,
      previewBatchSize: 0,
      mode: 'unsupported',
      unsupportedReason: 'editor',
    };
    figma.ui.postMessage(msg);
    return;
  }

  const sel = figma.currentPage.selection;
  const targets = collectTextTargets(sel);
  const textTargetCount = targets.length;
  let mode: SelectionContextMode;

  if (targets.length === 0) {
    if (sel.length === 0) {
      mode = 'create-on-page';
    } else if (getAppendableContainers(sel).length > 0) {
      mode = 'create-in-frame';
    } else {
      mode = 'unsupported';
    }
  } else if (targets.length === 1) {
    mode = 'retext-one';
  } else {
    mode = 'retext-many';
  }

  let previewBatchSize = 0;
  switch (mode) {
    case 'create-on-page':
      previewBatchSize = 1;
      break;
    case 'create-in-frame':
      previewBatchSize = getAppendableContainers(sel).length;
      break;
    case 'retext-one':
      previewBatchSize = 1;
      break;
    case 'retext-many':
      previewBatchSize = textTargetCount;
      break;
    default:
      previewBatchSize = 0;
  }

  const msg: SelectionContextMessage = {
    type: 'selection-context',
    textTargetCount,
    previewBatchSize,
    mode,
  };
  if (mode === 'unsupported' && sel.length > 0) {
    msg.unsupportedReason = 'selection';
  }
  figma.ui.postMessage(msg);
}

async function loadFontForEdit(text: TextNode): Promise<void> {
  try {
    if (text.fontName === figma.mixed) {
      await figma.loadFontAsync(DEFAULT_FONT);
      text.fontName = DEFAULT_FONT;
      return;
    }
    await figma.loadFontAsync(text.fontName as FontName);
  } catch (_err) {
    await figma.loadFontAsync(DEFAULT_FONT);
    text.fontName = DEFAULT_FONT;
  }
}

async function setTextCharacters(text: TextNode, value: string): Promise<void> {
  await loadFontForEdit(text);
  text.characters = value;
}

async function createTextNode(
  parent: ChildrenMixin,
  value: string,
  x: number,
  y: number,
): Promise<TextNode> {
  const t = figma.createText();
  await figma.loadFontAsync(DEFAULT_FONT);
  t.fontName = DEFAULT_FONT;
  t.characters = value;
  t.x = x;
  t.y = y;
  parent.appendChild(t);
  return t;
}

async function applyWalletText(msg: ApplyMessage): Promise<void> {
  if (!isApplySupportedEditor()) {
    figma.notify('Open this plugin in Figma Design or FigJam.');
    return;
  }

  const { previewAddress, network, truncate, truncateStart, truncateEnd } = msg;
  if (!previewAddress) {
    figma.notify('Generate an address in the preview first.');
    return;
  }

  const toCanvas = (full: string) =>
    formatAddressForCanvas(full, truncate, truncateStart, truncateEnd);

  const sel = figma.currentPage.selection;
  const targets = collectTextTargets(sel);

  if (targets.length === 0) {
    if (sel.length === 0) {
      const t = await createTextNode(figma.currentPage, toCanvas(previewAddress), 0, 0);
      const c = figma.viewport.center;
      t.x = c.x - t.width / 2;
      t.y = c.y - t.height / 2;
      figma.currentPage.selection = [t];
      figma.viewport.scrollAndZoomIntoView([t]);
      return;
    }

    const containers = getAppendableContainers(sel);
    if (containers.length === 0) {
      figma.notify('Select a frame or group, or clear selection to create on the page.');
      return;
    }

    const made: TextNode[] = [];
    for (const parent of containers) {
      const t = await createTextNode(parent, toCanvas(previewAddress), 16, 16);
      made.push(t);
    }
    figma.currentPage.selection = made;
    figma.viewport.scrollAndZoomIntoView(made);
    return;
  }

  if (targets.length === 1) {
    await setTextCharacters(targets[0], toCanvas(previewAddress));
    figma.currentPage.selection = [targets[0]];
    return;
  }

  for (const t of targets) {
    const next = generateAddress(network);
    await setTextCharacters(t, toCanvas(next));
  }
  figma.currentPage.selection = targets;
  figma.notify(`${targets.length} text layers updated`);
}

figma.showUI(__html__, { width: 320, height: 560 });

figma.ui.onmessage = async (msg: PluginMessageFromUI) => {
  if (msg.type === 'cancel') {
    figma.closePlugin();
    return;
  }
  if (msg.type === 'get-truncate-rules') {
    await pushTruncateRulesToUI();
    return;
  }
  if (msg.type === 'save-truncate-rules') {
    const rules = normalizeStoredTruncateRules({
      start: msg.start,
      end: msg.end,
    });
    await figma.clientStorage.setAsync(TRUNCATE_RULES_STORAGE_KEY, rules);
    figma.ui.postMessage({ type: 'truncate-rules', ...rules } satisfies TruncateRulesToUIMessage);
    return;
  }
  if (msg.type === 'get-footer-links') {
    pushFooterLinksToUI();
    return;
  }
  if (msg.type === 'resize-ui') {
    const nextHeight = Math.max(420, Math.min(900, Math.floor(msg.height)));
    figma.ui.resize(320, nextHeight);
    return;
  }
  if (msg.type === 'apply') {
    try {
      await applyWalletText(msg);
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      figma.notify(`Could not apply: ${err}`);
    }
  }
};

if (isApplySupportedEditor()) {
  figma.on('selectionchange', () => {
    pushSelectionContext();
  });
}

pushSelectionContext();

void pushTruncateRulesToUI();
pushFooterLinksToUI();
