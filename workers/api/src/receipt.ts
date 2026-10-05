// Receipt-number validation. Pure: no side effects, no storage, no network,
// no logging. Dependency-free so the mobile app can reuse it.
//
// classifyReceipt never returns the receipt itself, only a coarse state
// (Invariant II). normalizeReceipt does return it, for the outbound USCIS call
// only — see the warning on that function.

// USCIS format: 3 letters then 10 digits, e.g. IOE1234567890.
const RECEIPT_RE = /^[A-Z]{3}[0-9]{10}$/;

// Prefixes USCIS publishes as examples. Not exhaustive, which is why an
// unknown prefix is a soft "warn" rather than a hard "invalid".
const KNOWN_PREFIXES = new Set(['EAC', 'WAC', 'LIN', 'SRC', 'NBC', 'MSC', 'IOE']);

export type ReceiptState = 'empty' | 'invalid' | 'warn' | 'valid';

export interface ReceiptClassification {
  state: ReceiptState;
  prefixKnown: boolean;
}

/**
 * Classify a raw receipt string. Normalizes by uppercasing and stripping
 * whitespace and hyphens, then reports:
 *   empty   — missing, not a string, or whitespace only
 *   invalid — wrong shape
 *   valid   — right shape, known prefix
 *   warn    — right shape, unknown prefix (still accepted)
 */
export function classifyReceipt(raw: unknown): ReceiptClassification {
  if (typeof raw !== 'string') return { state: 'empty', prefixKnown: false };
  const cleaned = raw.replace(/[\s-]/g, '').toUpperCase();
  if (cleaned.length === 0) return { state: 'empty', prefixKnown: false };
  if (!RECEIPT_RE.test(cleaned)) return { state: 'invalid', prefixKnown: false };
  const prefixKnown = KNOWN_PREFIXES.has(cleaned.slice(0, 3));
  // `cleaned` is deliberately not returned.
  return { state: prefixKnown ? 'valid' : 'warn', prefixKnown };
}

/**
 * The normalized receipt if the shape is valid, else null.
 *
 * Unlike classifyReceipt this does return the full receipt, because the
 * outbound USCIS URL needs it. Use it in memory for that one call and never
 * log, store, cache, or return it (Invariant II).
 */
export function normalizeReceipt(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.replace(/[\s-]/g, '').toUpperCase();
  return RECEIPT_RE.test(cleaned) ? cleaned : null;
}
