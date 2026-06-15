export const DEFAULT_TRUNCATE_START = 6;
export const DEFAULT_TRUNCATE_END = 4;
export const FOOTER_BUY_ME_COFFEE_URL = 'https://example.com/buy-me-coffee';
export const FOOTER_PROFILE_URL = 'https://desktopofsamuel.com/?ref=web3-design-pal';

/** Persisted via figma.clientStorage — see https://developers.figma.com/docs/plugins/api/figma-clientStorage/ */
export const TRUNCATE_RULES_STORAGE_KEY = 'web3dpal_truncate_rules';
export const COINGECKO_KEY_STORAGE_KEY = 'web3dpal_coingecko_key';
export const CMC_KEY_STORAGE_KEY = 'web3dpal_cmc_key';
export const PRICE_COINS_STORAGE_KEY = 'web3dpal_price_coins';

/** Default coin pool for the Price tab (50 popular symbols, includes ETH). */
export const DEFAULT_PRICE_COINS = [
  'AAVE',
  'ADA',
  'ALGO',
  'APT',
  'ARB',
  'ATOM',
  'AVAX',
  'BCH',
  'BNB',
  'BTC',
  'CRV',
  'DAI',
  'DOGE',
  'DOT',
  'ENA',
  'ETH',
  'FET',
  'FIL',
  'GRT',
  'HYPE',
  'ICP',
  'IMX',
  'INJ',
  'JTO',
  'JUP',
  'LDO',
  'LINK',
  'LTC',
  'MATIC',
  'MKR',
  'NEAR',
  'OP',
  'PEPE',
  'PYTH',
  'RENDER',
  'SEI',
  'SHIB',
  'SOL',
  'STX',
  'SUI',
  'TIA',
  'TON',
  'TRX',
  'UNI',
  'USDC',
  'USDT',
  'W',
  'WIF',
  'WLD',
  'XRP',
] as const;

export const DEFAULT_PRICE_COINS_TEXT = DEFAULT_PRICE_COINS.join(', ');

export const APPENDABLE_TYPES: SceneNode['type'][] = [
  'FRAME',
  'GROUP',
  'SECTION',
  'COMPONENT',
  'COMPONENT_SET',
  'INSTANCE',
];

export const DEFAULT_FONT: FontName = { family: 'Inter', style: 'Regular' };

/** Lowercase CoinGecko `vs_currencies` codes (includes USD as default quote). */
export const SUPPORTED_VS_CURRENCIES = [
  'usd',
  'eur',
  'gbp',
  'cad',
  'jpy',
  'aud',
  'nzd',
  'chf',
  'sgd',
] as const;

export type SupportedVsCurrency = (typeof SUPPORTED_VS_CURRENCIES)[number];

/** Uppercase set for parsing pair text (e.g. BTC/AUD, BTCAUD). */
export const SUPPORTED_VS_FIAT_UPPER = new Set(
  SUPPORTED_VS_CURRENCIES.map((c) => c.toUpperCase()),
);
