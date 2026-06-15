import { DEFAULT_TRUNCATE_END, DEFAULT_TRUNCATE_START, DEFAULT_PRICE_COINS_TEXT } from './constants';
import type { TruncateRulesPayload } from './types';

export function normalizeStoredTruncateRules(raw: unknown): TruncateRulesPayload {
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

export function normalizeStoredPriceCoins(raw: unknown): string {
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  return DEFAULT_PRICE_COINS_TEXT;
}
