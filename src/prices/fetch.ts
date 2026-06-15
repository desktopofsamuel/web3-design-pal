import {
  COINGECKO_KEY_STORAGE_KEY,
  CMC_KEY_STORAGE_KEY,
  SUPPORTED_VS_CURRENCIES,
} from '../constants';
import type { CoinPriceData, PricesResultMessage, VsCurrencyQuotes } from '../types';

const CMC_CONVERTS = SUPPORTED_VS_CURRENCIES.map((c) => c.toUpperCase());

function mergeCoinGeckoEntry(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- CoinGecko dynamic keys per vs currency
  d: Record<string, any>,
): CoinPriceData {
  const root: CoinPriceData = {
    price: d.usd ?? null,
    change: d.usd_24h_change ?? null,
    volume: d.usd_24h_vol ?? null,
    mcap: d.usd_market_cap ?? null,
  };
  const vs: VsCurrencyQuotes = {};
  for (const fc of SUPPORTED_VS_CURRENCIES) {
    if (fc === 'usd') continue;
    const price = d[fc] ?? null;
    const change = d[`${fc}_24h_change`] ?? null;
    const volume = d[`${fc}_24h_vol`] ?? null;
    const mcap = d[`${fc}_market_cap`] ?? null;
    if (price != null || change != null || volume != null || mcap != null) {
      vs[fc] = { price, change, volume, mcap };
    }
  }
  return Object.keys(vs).length > 0 ? { ...root, vs } : root;
}

async function fetchCoinMarketCapQuotes(
  symbols: string[],
  cmcKey: string,
): Promise<Record<string, CoinPriceData> | null> {
  const symParam = symbols.join(',');
  const responses = await Promise.all(
    CMC_CONVERTS.map((convert) =>
      fetch(
        `https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=${symParam}&convert=${convert}`,
        { headers: { 'X-CMC_PRO_API_KEY': cmcKey, Accept: 'application/json' } },
      ),
    ),
  );
  if (!responses.every((r) => r.ok)) return null;

  const jsons = await Promise.all(responses.map((r) => r.json()));
  const coins: Record<string, CoinPriceData> = {};

  for (const sym of symbols) {
    coins[sym] = { price: null, change: null, volume: null, mcap: null };
  }

  for (let i = 0; i < CMC_CONVERTS.length; i++) {
    const convert = CMC_CONVERTS[i];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- CMC response
    const json = jsons[i] as any;
    const data = json?.data;
    if (!data || typeof data !== 'object') continue;
    const fiatLower = convert.toLowerCase();

    for (const sym of symbols) {
      const entry = data[sym] ?? data[sym.toUpperCase()];
      const q = entry?.quote?.[convert] ?? {};
      const slice = {
        price: q.price ?? null,
        change: q.percent_change_24h ?? null,
        volume: q.volume_24h ?? null,
        mcap: q.market_cap ?? null,
      };
      if (convert === 'USD') {
        Object.assign(coins[sym], slice);
      } else {
        if (!coins[sym].vs) coins[sym].vs = {};
        coins[sym].vs![fiatLower] = slice;
      }
    }
  }

  return coins;
}

export async function fetchPrices(symbols: string[]): Promise<void> {
  const [cmcKey, cgKey] = await Promise.all([
    figma.clientStorage.getAsync(CMC_KEY_STORAGE_KEY),
    figma.clientStorage.getAsync(COINGECKO_KEY_STORAGE_KEY),
  ]);

  if (typeof cmcKey === 'string' && cmcKey) {
    try {
      const coins = await fetchCoinMarketCapQuotes(symbols, cmcKey);
      if (coins) {
        figma.ui.postMessage({
          type: 'prices-result',
          coins,
          source: 'coinmarketcap',
        } satisfies PricesResultMessage);
        return;
      }
    } catch (_err) {
      // fall through to CoinGecko
    }
  }

  try {
    const keyParam = typeof cgKey === 'string' && cgKey ? `&x_cg_demo_api_key=${cgKey}` : '';
    const vsList = SUPPORTED_VS_CURRENCIES.join(',');
    const resp = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?symbols=${symbols.join(',')}&vs_currencies=${vsList}` +
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
      const d = json[sym.toLowerCase()] ?? {};
      coins[sym] = mergeCoinGeckoEntry(d);
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
