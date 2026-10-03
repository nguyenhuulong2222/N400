// Upstream error passthrough — criterion 4 of the USCIS production-access demo
// requires that the USCIS `message` reach the user's screen. Everything here
// exists to let that happen without also forwarding anything we should not.
//
// SHAPE. Four are accepted. USCIS is known to use three of them, each observed
// somewhere different, and the third was found the hard way — in production:
//
//  1. FLAT `{ code: <int>, message: "<string>" }` — what the published Case
//     Status spec documents (swagger_3.yaml, Case Status API 1.0.0). Its only
//     error schema is `ErrorRequest { message: string }` and every example is
//     flat. Source: the spec's own 401/404/422/429/503 examples.
//
//  2. ARRAY `{ errors: [ … ] }` — the RFC 9457 envelope the USCIS Production
//     Access documentation describes for Torch APIs. Source: that page. Not
//     yet observed on the wire from the Case Status API.
//
//  3. SINGULAR `{ "error": { "code": "503", "message": "…" } }` — what the LIVE
//     sandbox actually returns. Captured 2026-10-03 09:34 UTC by direct curl
//     against a closed sandbox. Note `code` is a STRING here, not the integer
//     the spec's examples use. An `error` ARRAY is accepted on the same branch.
//
//  4. STRING `{ "error": "invalid_token" }` — DEFENSIVE, not observed. The
//     string becomes `message` and there is no code to report. OAuth-style
//     bodies look like this, and after shape 3 the cost of guessing wrong
//     about USCIS's error envelope is better paid here than in production.
//
// Shape 3 is the reason this comment exists in this form. Shapes 1 and 2 were
// built from documentation; the first real error body we ever saw matched
// neither, errors[] came back empty in production, and the USCIS message was
// silently replaced by our own fallback — the precise failure this file was
// written to prevent. Documentation told us two shapes. The wire told us a
// third. Assume there is a fifth: an unrecognised body must keep degrading to
// our own message, never to a crash, and never to a guess.
//
// The shape-3 body arrives with leading newlines and spaces. That is NOT why it
// was dropped — whitespace before a value is legal JSON and JSON.parse already
// accepted it; the trimmed body failed identically. No trim is needed and none
// was added, so nothing here pretends to fix a problem that did not exist.
//
// API Invariant II. Every passed-through string is masked first: an upstream
// message may quote the receipt number back at us (the 200 descriptions do),
// and that must not survive into a response we emit.

export const WHITELIST_FIELDS = [
  'code',
  'message',
  'category',
  'reference',
  'status',
  'traceId',
] as const;

const MAX_ITEMS = 10;

// Both receipt formats the spec's RegEx allows: [a-zA-Z]{3}[0-9]{10} and
// [a-zA-Z]{3}\*[0-9]{9}. Our own validator accepts only the first, but USCIS
// can echo either, so the mask covers both.
const RECEIPT_TOKEN_RE = /\b[A-Z]{3}(?:[0-9]{10}|\*[0-9]{9})\b/gi;

export interface PassthroughError {
  code?: string | number;
  message?: string;
  category?: string;
  reference?: string;
  status?: string | number;
  traceId?: string | number;
}

/** First 3 chars + ******* + last 3 chars, for every receipt-shaped token. */
export function maskReceipts(input: string): string {
  return input.replace(RECEIPT_TOKEN_RE, (m) => `${m.slice(0, 3)}*******${m.slice(-3)}`);
}

/**
 * Pull a whitelisted error list out of an upstream body.
 *
 * Checked in this order (see the four shapes at the top of this file):
 *   1. `{ errors: [ … ] }`
 *   2. `{ error: [ … ] }`
 *   3. `{ error: { … } }`
 *   4. `{ error: "<string>" }`      → becomes a lone `message`
 *   5. flat `{ code, message }` / `{ message }`
 *
 * Anything else — non-JSON, an HTML gateway page, an empty body, an object
 * with none of these keys — yields [] and the caller falls back to our own
 * plain-English message.
 *
 * Only string and finite-number values survive. Nested objects, arrays and
 * functions are dropped rather than serialized, so no unexpected structure can
 * ride along. At most MAX_ITEMS items.
 */
export function extractUpstreamErrors(text: string): PassthroughError[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return [];
  }
  if (!parsed || typeof parsed !== 'object') return [];
  const obj = parsed as Record<string, unknown>;

  let raw: unknown[];
  if (Array.isArray(obj.errors)) {
    // Shape 2.
    raw = obj.errors.slice(0, MAX_ITEMS);
  } else if (Array.isArray(obj.error)) {
    // Shape 3, plural variant. Tested before the object check below, because
    // an array is also an object.
    raw = obj.error.slice(0, MAX_ITEMS);
  } else if (obj.error && typeof obj.error === 'object') {
    // Shape 3 as the live sandbox sends it: one wrapped error object.
    raw = [obj.error];
  } else if (typeof obj.error === 'string' && obj.error.trim() !== '') {
    // Shape 4. Synthesized into the same item form so the whitelist loop
    // below masks it exactly like any other message. No code is invented.
    raw = [{ message: obj.error }];
  } else if (typeof obj.message === 'string' || obj.code !== undefined) {
    // Shape 1, the documented flat body.
    raw = [obj];
  } else {
    return [];
  }

  const out: PassthroughError[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const src = item as Record<string, unknown>;
    const kept: Record<string, string | number> = {};
    for (const field of WHITELIST_FIELDS) {
      const v = src[field];
      if (typeof v === 'string') kept[field] = maskReceipts(v);
      else if (typeof v === 'number' && Number.isFinite(v)) kept[field] = v;
    }
    if (Object.keys(kept).length > 0) out.push(kept as PassthroughError);
  }
  return out;
}

/**
 * The client envelope.
 *
 * `ok` / `error` / `message` are kept exactly as the previously deployed
 * frontend expects them — the Worker ships before the web app, so this must
 * stay backward-compatible. `status`, `source` and `errors` are additive.
 */
export function errorBody(opts: {
  error: string;
  message: string;
  status: number;
  source: 'uscis' | 'worker';
  errors?: PassthroughError[];
}): Record<string, unknown> {
  return {
    ok: false,
    error: opts.error,
    message: opts.message,
    status: opts.status,
    source: opts.source,
    errors: opts.errors ?? [],
  };
}

/**
 * `new Response(body, { status })` throws a RangeError outside 200–599, so an
 * absurd upstream status must not be handed to it verbatim. Anything out of
 * range becomes 502 — the upstream misbehaved.
 */
export function safeStatus(status: number): number {
  return Number.isInteger(status) && status >= 200 && status <= 599 ? status : 502;
}

/**
 * Our own code + plain-English fallback for a given upstream status. Used when
 * the upstream body carried nothing usable, and as the envelope's `message`
 * even when it did (the UI prefers the USCIS text, but a client that only reads
 * `message` still gets a sentence it can show).
 */
export function fallbackFor(status: number): { error: string; message: string } {
  switch (status) {
    case 401:
      return {
        error: 'uscis_auth_failed',
        message:
          'We could not authenticate with the USCIS case status service. Please try again later.',
      };
    case 404:
      return { error: 'case_not_found', message: 'No case was found for that receipt number.' };
    case 422:
      return {
        error: 'invalid_receipt_format',
        message: 'Receipt number must be 3 letters followed by 10 numbers.',
      };
    case 429:
      return { error: 'rate_limited', message: 'Too many requests. Please try again shortly.' };
    case 503:
      return {
        error: 'service_unavailable',
        message: 'Case status service is temporarily unavailable. Please try again later.',
      };
    default:
      return {
        error: 'upstream_error',
        message: 'The case status service returned an error. Please try again later.',
      };
  }
}
