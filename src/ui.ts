import {
  COINGECKO_KEY_STORAGE_KEY,
  CMC_KEY_STORAGE_KEY,
  FOOTER_BUY_ME_COFFEE_URL,
  FOOTER_PROFILE_URL,
  PRICE_COINS_STORAGE_KEY,
  TRUNCATE_RULES_STORAGE_KEY,
} from './constants';
import { normalizeStoredPriceCoins, normalizeStoredTruncateRules } from './storage';
import type {
  ApiKeysToUIMessage,
  FooterLinksToUIMessage,
  PriceCoinsToUIMessage,
  TruncateRulesToUIMessage,
} from './types';

export async function pushTruncateRulesToUI(): Promise<void> {
  const stored = await figma.clientStorage.getAsync(TRUNCATE_RULES_STORAGE_KEY);
  const rules = normalizeStoredTruncateRules(stored);
  figma.ui.postMessage({ type: 'truncate-rules', ...rules } satisfies TruncateRulesToUIMessage);
}

export function pushFooterLinksToUI(): void {
  figma.ui.postMessage({
    type: 'footer-links',
    buyMeCoffeeUrl: FOOTER_BUY_ME_COFFEE_URL,
    profileUrl: FOOTER_PROFILE_URL,
  } satisfies FooterLinksToUIMessage);
}

export async function pushApiKeysToUI(): Promise<void> {
  const [cg, cmc] = await Promise.all([
    figma.clientStorage.getAsync(COINGECKO_KEY_STORAGE_KEY),
    figma.clientStorage.getAsync(CMC_KEY_STORAGE_KEY),
  ]);
  figma.ui.postMessage({
    type: 'api-keys',
    coingeckoKey: typeof cg === 'string' ? cg : '',
    cmcKey: typeof cmc === 'string' ? cmc : '',
  } satisfies ApiKeysToUIMessage);
}

export async function pushPriceCoinsToUI(): Promise<void> {
  const stored = await figma.clientStorage.getAsync(PRICE_COINS_STORAGE_KEY);
  figma.ui.postMessage({
    type: 'price-coins',
    coins: normalizeStoredPriceCoins(stored),
  } satisfies PriceCoinsToUIMessage);
}
