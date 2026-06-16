// PURE receipt-number validation — the single source of truth for the Worker.
//
// Ported from `csClassifyReceipt` in the web app (index.html, WEB-2). Keep the
// two in sync. This module is intentionally dependency-free and portable so the
// mobile app can import the same logic later.
//
// API Invariant II — RECEIPT NUMBERS ARE SENSITIVE PII:
// This function is pure — no side effects, no storage, no network, no logging.
// It MUST NOT return, echo, or otherwise expose the full (normalized) receipt
// number. Callers only ever receive a coarse classification.

// USCIS receipt-number format: 3 letters followed by 10 digits (e.g., IOE1234567890).
export const RECEIPT_RE = /^[A-Z]{3}[0-9]{10}$/;

// Common service-center prefixes USCIS publishes as examples. Not exhaustive —
// an applicant may have a less common but still structurally valid prefix, which
// is why an unknown prefix is a soft "warn", not a hard "invalid".
export const KNOWN_PREFIXES = new Set(['EAC', 'WAC', 'LIN', 'SRC', 'NBC', 'MSC', 'IOE']);

export type ReceiptState = 'empty' | 'invalid' | 'warn' | 'valid';

export interface ReceiptClassification {
  state: ReceiptState;
  prefixKnown: boolean;
}

/**
 * Classify a raw receipt-number string.
 *
 * Normalization: uppercase, then strip whitespace and hyphens (`/[\s-]/g`).
 *
 * Returns only a coarse classification — never the normalized/full receipt
 * number (Invariant II).
 *
 * - empty / null / non-string / whitespace-only → { state: 'empty',   prefixKnown: false }
 * - structurally invalid shape                  → { state: 'invalid', prefixKnown: false }
 * - valid shape + known prefix                  → { state: 'valid',   prefixKnown: true  }
 * - valid shape + unknown prefix                → { state: 'warn',    prefixKnown: false }
 */
export function classifyReceipt(raw: unknown): ReceiptClassification {
  if (typeof raw !== 'string') return { state: 'empty', prefixKnown: false };
  const cleaned = raw.replace(/[\s-]/g, '').toUpperCase();
  if (cleaned.length === 0) return { state: 'empty', prefixKnown: false };
  if (!RECEIPT_RE.test(cleaned)) return { state: 'invalid', prefixKnown: false };
  const prefixKnown = KNOWN_PREFIXES.has(cleaned.slice(0, 3));
  // Deliberately do not include `cleaned` in the returned object.
  return { state: prefixKnown ? 'valid' : 'warn', prefixKnown };
}

/**
 * Return the normalized (uppercased, whitespace/hyphen-stripped) receipt number
 * IFF it is structurally valid, otherwise null.
 *
 * UNLIKE `classifyReceipt`, this intentionally returns the full receipt — it is
 * needed transiently to build the upstream USCIS request path. API Invariant II:
 * the caller MUST use the result only in-memory for the outbound USCIS call and
 * MUST NEVER log it, store it, cache it, or place it in any response/error/URL
 * we return to our own clients. Discard immediately after the upstream fetch.
 */
export function normalizeReceipt(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.replace(/[\s-]/g, '').toUpperCase();
  return RECEIPT_RE.test(cleaned) ? cleaned : null;
}
