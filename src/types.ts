export type Network = 'Ethereum' | 'Solana' | 'Bitcoin' | 'Ripple';

export type SelectionContextMode =
  | 'create-on-page'
  | 'create-in-frame'
  | 'retext-one'
  | 'retext-many'
  | 'unsupported';

export type SelectionContextMessage = {
  type: 'selection-context';
  textTargetCount: number;
  /** How many text layers Apply will touch (retext count, or new-text count for create flows). */
  previewBatchSize: number;
  mode: SelectionContextMode;
  /** `editor` when not in Figma/FigJam; `selection` when only non-appendable nodes selected */
  unsupportedReason?: 'editor' | 'selection';
};

export type ApplyMessage = {
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

export type TruncateRulesPayload = { start: number; end: number };

export type GetTruncateRulesMessage = { type: 'get-truncate-rules' };
export type SaveTruncateRulesMessage = {
  type: 'save-truncate-rules';
  start: number;
  end: number;
};
export type GetFooterLinksMessage = { type: 'get-footer-links' };
export type ResizeUiMessage = {
  type: 'resize-ui';
  height: number;
};

export type TruncateRulesToUIMessage = {
  type: 'truncate-rules';
  start: number;
  end: number;
};
export type FooterLinksToUIMessage = {
  type: 'footer-links';
  buyMeCoffeeUrl: string;
  profileUrl: string;
};

export type CancelMessage = { type: 'cancel' };

export type GetApiKeysMessage = { type: 'get-api-keys' };
export type SaveApiKeysMessage = { type: 'save-api-keys'; coingeckoKey: string; cmcKey: string };
export type GetPriceCoinsMessage = { type: 'get-price-coins' };
export type SavePriceCoinsMessage = { type: 'save-price-coins'; coins: string };
export type FetchPricesMessage = { type: 'fetch-prices'; symbols: string[] };
export type ScanPriceLayersMessage = {
  type: 'scan-price-layers';
  cryptoVar: string;
  priceVar: string;
  changeVar: string;
  volumeVar: string;
  mcapVar: string;
  /** Symbols the user entered in the coin textarea — used for literal-ticker auto-detection. */
  knownTickers: string[];
};
export type ApplyPriceMessage = {
  type: 'apply-price';
  replacements: Array<{ nodeId: string; newText: string }>;
};

export type ApiKeysToUIMessage = { type: 'api-keys'; coingeckoKey: string; cmcKey: string };

export type PriceCoinsToUIMessage = { type: 'price-coins'; coins: string };

/** Per-fiat quote slice (keys lowercase: aud, eur, …). USD is always on the root `CoinPriceData` fields. */
export type VsCurrencyQuotes = Record<
  string,
  {
    price: number | null;
    change: number | null;
    volume: number | null;
    mcap: number | null;
  }
>;

export type CoinPriceData = {
  /** Primary quote (USD). */
  price: number | null;
  change: number | null;
  volume: number | null;
  mcap: number | null;
  /** Optional non-USD quotes from the same fetch (keys lowercase). */
  vs?: VsCurrencyQuotes;
};

export type PricesResultMessage = {
  type: 'prices-result';
  coins: Record<string, CoinPriceData>;
  error?: string;
  source?: 'coingecko' | 'coinmarketcap';
};

export type PriceLayerMatch = {
  nodeId: string;
  layerName: string;
  currentText: string;
  role: 'crypto' | 'price' | 'change' | 'volume' | 'mcap';
  /**
   * When true the text is a known ticker that was auto-detected (e.g. "BTC").
   * The apply step skips replacing this node — only data layers get updated.
   */
  isLiteral?: boolean;
  /**
   * Set when the variable token appears inside a longer string in the text content
   * (e.g. content "A${price}"). The apply step replaces only this token within
   * currentText rather than overwriting the whole string.
   */
  matchedVar?: string;
  /**
   * Set when the variable token is embedded in the layer NAME (e.g. name "A${price}").
   * Value is the prefix/suffix text around the token (e.g. "A$").
   * The apply step prepends this to the formatted value.
   */
  namePrefix?: string;
  /**
   * When text is a pair like BTC/AUD, symbol used for price lookup (e.g. "BTC").
   */
  quoteSymbol?: string;
  /**
   * Lowercase fiat for quote selection (e.g. "aud"). Omitted → UI uses USD root fields.
   */
  vsCurrency?: string;
};

export type PriceCard = {
  cardName: string;
  matches: PriceLayerMatch[];
};

export type PriceLayerScanResult = {
  type: 'price-layer-scan';
  cards: PriceCard[];
};

export type PluginMessageFromUI =
  | ApplyMessage
  | CancelMessage
  | GetTruncateRulesMessage
  | SaveTruncateRulesMessage
  | GetFooterLinksMessage
  | ResizeUiMessage
  | GetApiKeysMessage
  | SaveApiKeysMessage
  | GetPriceCoinsMessage
  | SavePriceCoinsMessage
  | FetchPricesMessage
  | ScanPriceLayersMessage
  | ApplyPriceMessage;
