import { COINGECKO_KEY_STORAGE_KEY, CMC_KEY_STORAGE_KEY } from '../constants';
import type { CoinPriceData, PricesResultMessage } from '../types';

export async function fetchPrices(symbols: string[]): Promise<void> {
  const [cmcKey, cgKey] = await Promise.all([
    figma.clientStorage.getAsync(CMC_KEY_STORAGE_KEY),
    figma.clientStorage.getAsync(COINGECKO_KEY_STORAGE_KEY),
  ]);

  if (typeof cmcKey === 'string' && cmcKey) {
    try {
      const resp = await fetch(
        `https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=${symbols.join(',')}`,
        { headers: { 'X-CMC_PRO_API_KEY': cmcKey, Accept: 'application/json' } },
      );
      if (resp.ok) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- CMC response shape
        const json = (await resp.json()) as any;
        const coins: Record<string, CoinPriceData> = {};
        for (const sym of symbols) {
          const q = json.data?.[sym]?.quote?.USD ?? {};
          coins[sym] = {
            price: q.price ?? null,
            change: q.percent_change_24h ?? null,
            volume: q.volume_24h ?? null,
            mcap: q.market_cap ?? null,
          };
        }
        figma.ui.postMessage({ type: 'prices-result', coins, source: 'coinmarketcap' } satisfies PricesResultMessage);
        return;
      }
    } catch (_err) {
      // fall through to CoinGecko
    }
  }

  try {
    const keyParam = typeof cgKey === 'string' && cgKey ? `&x_cg_demo_api_key=${cgKey}` : '';
    const resp = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?symbols=${symbols.join(',')}&vs_currencies=usd` +
        `&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true${keyParam}`,
    );
    if (!resp.ok) {
      figma.ui.postMessage({
        type: 'prices-result',
        coins: {},
        error: `API error: ${resp.status}`,
        source: 'coingecko',
      } satisfies PricesResultMessage);
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- CoinGecko response shape
    const json = (await resp.json()) as any;
    const coins: Record<string, CoinPriceData> = {};
    for (const sym of symbols) {
      // CoinGecko returns keys as lowercase symbols
      const d = json[sym.toLowerCase()] ?? {};
      coins[sym] = {
        price: d.usd ?? null,
        change: d.usd_24h_change ?? null,
        volume: d.usd_24h_vol ?? null,
        mcap: d.usd_market_cap ?? null,
      };
    }
    figma.ui.postMessage({ type: 'prices-result', coins, source: 'coingecko' } satisfies PricesResultMessage);
  } catch (_err) {
    figma.ui.postMessage({
      type: 'prices-result',
      coins: {},
      error: 'Network error',
      source: 'coingecko',
    } satisfies PricesResultMessage);
  }
}
