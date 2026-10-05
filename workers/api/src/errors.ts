// Upstream error passthrough: get the USCIS message to the user's screen
// without forwarding anything we should not.
//
// USCIS uses more than one error envelope, so four are accepted and normalised
// to one errors[] list. Each passed-through string is receipt-masked first,
// because an upstream message can quote the receipt back at us (Invariant II).

// Fields allowed out of an upstream error. Everything else is dropped.
const WHITELIST_FIELDS = ['code', 'message', 'category', 'reference', 'status', 'traceId'] as const;

// Upper bound on items forwarded from one upstream body.
const MAX_ITEMS = 10;

// Receipt masking: keep the first and last 3 characters, replace the middle.
const MASK_KEEP = 3;
const MASK_FILL = '*******';

// Both receipt formats the USCIS spec allows: AAA0000000000 and AAA*000000000.
// Our validator accepts only the first, but USCIS can echo either.
const RECEIPT_TOKEN_RE = /\b[A-Z]{3}(?:[0-9]{10}|\*[0-9]{9})\b/gi;

export interface PassthroughError {
  code?: string | number;
  message?: string;
  category?: string;
  reference?: string;
  status?: string | number;
  traceId?: string | number;
}

function maskReceipts(input: string): string {
  return input.replace(
    RECEIPT_TOKEN_RE,
    (m) => `${m.slice(0, MASK_KEEP)}${MASK_FILL}${m.slice(-MASK_KEEP)}`,
  );
}

// Pick the error items out of a parsed body, in this order:
//   { errors: [...] }           RFC 9457, per the USCIS Production Access page
//   { error: [...] }            defensive, not observed
//   { error: {...} }            what the live sandbox sends; code is a string
//   { error: "text" }           defensive, not observed; becomes a message
//   { code, message }           what the published spec documents
// Anything else returns null, and the caller falls back to our own message.
function selectErrorItems(obj: Record<string, unknown>): unknown[] | null {
  if (Array.isArray(obj.errors)) return obj.errors.slice(0, MAX_ITEMS);
  // Array first: an array is also an object.
  if (Array.isArray(obj.error)) return obj.error.slice(0, MAX_ITEMS);
  if (obj.error && typeof obj.error === 'object') return [obj.error];
  if (typeof obj.error === 'string' && obj.error.trim() !== '') return [{ message: obj.error }];
  if (typeof obj.message === 'string' || obj.code !== undefined) return [obj];
  return null;
}

/**
 * Whitelisted, receipt-masked error items from an upstream body.
 *
 * Non-JSON, an HTML gateway page, an empty body or an unrecognised object all
 * yield [], and the caller falls back to our own plain-English message. Only
 * strings and finite numbers survive, so no nested structure can ride along.
 */
export function extractUpstreamErrors(text: string): PassthroughError[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return [];
  }
  if (!parsed || typeof parsed !== 'object') return [];

  const items = selectErrorItems(parsed as Record<string, unknown>);
  if (items === null) return [];

  const out: PassthroughError[] = [];
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const src = item as Record<string, unknown>;
    // Record<> accumulator, then one cast: assigning through a union key into
    // PassthroughError does not narrow, and the whitelist above is what makes
    // the cast sound.
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
 * The client error envelope. ok / error / message are kept for the deployed
 * frontend; status / source / errors are additive.
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

/** new Response() throws outside 200-599, so an absurd status becomes 502. */
export function safeStatus(status: number): number {
  return Number.isInteger(status) && status >= 200 && status <= 599 ? status : 502;
}

/**
 * Our own code and plain-English message for an upstream status. Used when the
 * upstream body carried nothing usable, and as the envelope message even when
 * it did, so a client that reads only `message` still has a sentence to show.
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
