// Upstream error passthrough — criterion 4 of the USCIS production-access demo
// requires that the USCIS `message` reach the user's screen. Everything here
// exists to let that happen without also forwarding anything we should not.
//
// SHAPE. Two are accepted, deliberately:
//
//  1. FLAT `{ code: <int>, message: "<string>" }` — this is what the published
//     Case Status spec documents (swagger_3.yaml, Case Status API 1.0.0). Its
//     only error schema is `ErrorRequest { message: string }` and every example
//     is flat. This is the shape we will actually see, so it is the one the
//     tests exercise first.
//  2. ARRAY `{ errors: [ … ] }` — the RFC 9457 envelope the USCIS Production
//     Access documentation describes for Torch APIs.
//
// A parser that accepted only (2) would drop every documented body on the floor
// and show our own fallback instead — failing the exact criterion this file is
// for. One normaliser, one shape for the UI to render.
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
 * Accepts `{ errors: [...] }`, or a flat `{ code, message }` / `{ message }`
 * wrapped into a single item. Anything else — non-JSON, an HTML gateway page,
 * an empty body — yields [] and the caller falls back to our own plain-English
 * message.
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
    raw = obj.errors.slice(0, MAX_ITEMS);
  } else if (typeof obj.message === 'string' || obj.code !== undefined) {
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
