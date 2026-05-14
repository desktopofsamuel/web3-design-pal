import { DEFAULT_TRUNCATE_END, DEFAULT_TRUNCATE_START } from './constants';
import { collectTextTargets, getAppendableContainers, isApplySupportedEditor } from './selection';
import { createTextNode, setTextCharacters } from './text';
import type { ApplyMessage, Network } from './types';

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

export function formatAddressForCanvas(
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

export function generateAddress(network: Network): string {
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

export async function applyWalletText(msg: ApplyMessage): Promise<void> {
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
