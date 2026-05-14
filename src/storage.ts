import { DEFAULT_TRUNCATE_END, DEFAULT_TRUNCATE_START } from './constants';
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
