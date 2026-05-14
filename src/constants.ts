export const DEFAULT_TRUNCATE_START = 6;
export const DEFAULT_TRUNCATE_END = 4;
export const FOOTER_BUY_ME_COFFEE_URL = 'https://example.com/buy-me-coffee';
export const FOOTER_PROFILE_URL = 'https://desktopofsamuel.com/?ref=web3-design-pal';

/** Persisted via figma.clientStorage — see https://developers.figma.com/docs/plugins/api/figma-clientStorage/ */
export const TRUNCATE_RULES_STORAGE_KEY = 'web3dpal_truncate_rules';
export const COINGECKO_KEY_STORAGE_KEY = 'web3dpal_coingecko_key';
export const CMC_KEY_STORAGE_KEY = 'web3dpal_cmc_key';

export const APPENDABLE_TYPES: SceneNode['type'][] = [
  'FRAME',
  'GROUP',
  'SECTION',
  'COMPONENT',
  'COMPONENT_SET',
  'INSTANCE',
];

export const DEFAULT_FONT: FontName = { family: 'Inter', style: 'Regular' };
