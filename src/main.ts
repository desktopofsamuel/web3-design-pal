import {
  COINGECKO_KEY_STORAGE_KEY,
  CMC_KEY_STORAGE_KEY,
  TRUNCATE_RULES_STORAGE_KEY,
} from './constants';
import { applyPriceReplacements } from './prices/apply';
import { fetchPrices } from './prices/fetch';
import { scanPriceLayers } from './prices/scan';
import { isApplySupportedEditor, pushSelectionContext } from './selection';
import { normalizeStoredTruncateRules } from './storage';
import type {
  ApiKeysToUIMessage,
  PluginMessageFromUI,
  PricesResultMessage,
  TruncateRulesToUIMessage,
} from './types';
import { pushApiKeysToUI, pushFooterLinksToUI, pushTruncateRulesToUI } from './ui';
import { applyWalletText } from './wallet';

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
    return;
  }
  if (msg.type === 'get-api-keys') {
    await pushApiKeysToUI();
    return;
  }
  if (msg.type === 'save-api-keys') {
    const cgKey = typeof msg.coingeckoKey === 'string' ? msg.coingeckoKey.trim() : '';
    const cmcKey = typeof msg.cmcKey === 'string' ? msg.cmcKey.trim() : '';
    await Promise.all([
      figma.clientStorage.setAsync(COINGECKO_KEY_STORAGE_KEY, cgKey),
      figma.clientStorage.setAsync(CMC_KEY_STORAGE_KEY, cmcKey),
    ]);
    figma.ui.postMessage({ type: 'api-keys', coingeckoKey: cgKey, cmcKey } satisfies ApiKeysToUIMessage);
    return;
  }
  if (msg.type === 'fetch-prices') {
    try {
      await fetchPrices(msg.symbols);
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      figma.ui.postMessage({ type: 'prices-result', coins: {}, error: err } satisfies PricesResultMessage);
    }
    return;
  }
  if (msg.type === 'scan-price-layers') {
    scanPriceLayers(msg.cryptoVar, msg.priceVar, msg.changeVar, msg.volumeVar, msg.mcapVar, msg.knownTickers);
    return;
  }
  if (msg.type === 'apply-price') {
    try {
      await applyPriceReplacements(msg.replacements);
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      figma.notify(`Apply failed: ${err}`);
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
void pushApiKeysToUI();
