// formn400-api — Cloudflare Worker.
//
// Purpose: proxy the official USCIS Case Status API so the USCIS Client ID /
// Client Secret never reach the browser or the mobile app. This Worker serves
// NO question / quiz / civics data — that stays in the pure-static web app.
//
// Phase API-1: runnable shell. Routing, validation, CORS, PII guards, OAuth
// token-flow scaffolding (auth.ts) and the upstream call (caseStatus.ts) are all
// in place, but the default config runs in MOCK_MODE — so it boots and serves
// realistic canned responses with ZERO credentials. The live path activates once
// USCIS_CLIENT_ID / USCIS_CLIENT_SECRET are set as Worker secrets and MOCK_MODE
// is turned off.
//
// Public contract (receipt in the JSON BODY, never the URL — API Invariant II):
//   GET  /health        → { ok, service, version, mock }
//   GET  /              → { ok, service, message, mock }
//   POST /case-status   → { receiptNumber } in body → case_status payload
//   OPTIONS *           → CORS preflight

import type { Env } from './env.ts';
import { isMockMode } from './env.ts';
import { classifyReceipt, normalizeReceipt } from './receipt.ts';
import { jsonResponse, preflightResponse } from './cors.ts';
import { mockCaseStatus, mockUpstreamError } from './mock.ts';
import { getAccessToken, TokenError, resetTokenCache } from './auth.ts';
import { fetchCaseStatus, UpstreamError, UpstreamTimeoutError } from './caseStatus.ts';
import { errorBody, extractUpstreamErrors, fallbackFor, safeStatus } from './errors.ts';
import type { PassthroughError } from './errors.ts';

const SERVICE = 'formn400-api';
const VERSION = '0.2.0';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    const { method } = request;
    const path = url.pathname;
    const mock = isMockMode(env);

    // CORS preflight. Required for /case-status; harmless for any route.
    if (method === 'OPTIONS') {
      return preflightResponse(origin);
    }

    // GET /health
    if (method === 'GET' && path === '/health') {
      return jsonResponse({ ok: true, service: SERVICE, version: VERSION, mock }, 200, origin);
    }

    // GET /
    if (method === 'GET' && path === '/') {
      return jsonResponse(
        { ok: true, service: SERVICE, message: 'FormN400 API is running.', mock },
        200,
        origin,
      );
    }

    // POST /case-status
    if (method === 'POST' && path === '/case-status') {
      // Checked BEFORE the body is read: the limiter must never see, and never
      // key on, the receipt number (API Invariant II).
      const limited = await enforceRateLimit(request, env, origin);
      if (limited) return limited;
      return handleCaseStatus(request, origin, env, mock);
    }

    // Unknown route.
    return jsonResponse({ ok: false, error: 'not_found' }, 404, origin);
  },
};

// Receipt numbers are sensitive immigration identifiers. Never log, store, or
// place them in URLs we expose. The normalized receipt below is held only in a
// local variable for the duration of the upstream call.
//
// Rate limiting is applied by the router before this function runs — see
// enforceRateLimit. The quotas it protects, from the published spec: sandbox
// 5 TPS / 1,000 per day; production 10 TPS / 400,000 per day.
async function handleCaseStatus(
  request: Request,
  origin: string | null,
  env: Env,
  mock: boolean,
): Promise<Response> {
  // Parse JSON safely. We intentionally never log the request body — it carries
  // the receipt number (Invariant II).
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return invalidReceipt(origin);
  }

  const rawReceipt =
    body && typeof body === 'object' ? (body as Record<string, unknown>).receiptNumber : undefined;

  // The Worker validates independently — it never trusts client-side validation.
  // Bad/empty/structurally-invalid format → 422 (matches USCIS semantics), and
  // we never reveal which, and never echo the receipt.
  const { state } = classifyReceipt(rawReceipt);
  if (state === 'empty' || state === 'invalid') {
    return invalidReceipt(origin);
  }

  // Format is acceptable ('valid' or 'warn'). Get the normalized receipt for the
  // outbound call only. Held in-memory, never logged, discarded after this call.
  const receipt = normalizeReceipt(rawReceipt);
  if (receipt === null) {
    // Should be unreachable given the classification above; fail safe.
    return invalidReceipt(origin);
  }

  // MOCK_MODE: canned responses, no USCIS call, no credentials touched.
  if (mock) {
    // Reserved demo receipts return a synthetic UPSTREAM response which then
    // goes through the real mapUpstream, so the demo exercises the production
    // passthrough, masking and status mapping rather than a parallel mock of it.
    const canned = mockUpstreamError(receipt);
    if (canned) return mapUpstream(canned, origin);
    return mockCaseStatus(receipt, origin);
  }

  // Live path.
  let token: string;
  try {
    token = await getAccessToken(env);
  } catch (err) {
    // The token response BODY is never read or forwarded — it can echo the
    // client secret, which is why auth.ts throws before touching it. Only the
    // status reaches us, and only to choose between two of our own messages.
    const tokenStatus = (err as TokenError).status;
    if (tokenStatus === 400 || tokenStatus === 401) {
      return workerError(
        origin,
        401,
        'uscis_auth_failed',
        'USCIS_AUTH_FAILED',
        'We could not authenticate with the USCIS case status service. Please try again later.',
      );
    }
    return serviceUnavailable(origin);
  }

  let upstream: Response;
  try {
    upstream = await fetchCaseStatus(env, token, receipt);
  } catch (err) {
    if (err instanceof UpstreamTimeoutError) {
      return workerError(
        origin,
        504,
        'upstream_timeout',
        'UPSTREAM_TIMEOUT',
        'The USCIS case status service did not respond in time. Please try again.',
      );
    }
    void (err as UpstreamError);
    return serviceUnavailable(origin);
  }

  return mapUpstream(upstream, origin);
}

// Translate the upstream USCIS response into our client-facing response.
//
// 200 is passed through as-is. Every non-200 keeps its UPSTREAM STATUS and
// carries the USCIS message through — whitelisted and receipt-masked by
// errors.ts. That is demo criterion 4: the USCIS error.message has to reach the
// user's screen. Collapsing 401 and every 5xx into a blanket 503, which is what
// this did before, made that impossible and also hid from US which failure was
// actually happening.
async function mapUpstream(upstream: Response, origin: string | null): Promise<Response> {
  const status = upstream.status;

  if (status === 200) {
    // Read the body as text, then JSON.parse — NOT `upstream.json()`, so we
    // can catch a parse failure and map it to a distinct, accurate error.
    //
    // Why this matters: the USCIS sandbox returns syntactically INVALID JSON
    // for a meaningful fraction of receipts (~38% of staging samples). The
    // `current_case_status_desc_en` field embeds an HTML anchor whose
    // attribute quotes are inconsistently escaped, so the JSON string
    // terminates early and `JSON.parse` fails with
    // "Expected ',' or '}' after property value". This is an UPSTREAM DATA
    // DEFECT — not an encoding problem (the bytes are plain ASCII) and not a
    // Worker bug. We do NOT attempt to repair malformed JSON: we cannot safely
    // reconstruct legal status text, and a wrong guess shown to an anxious
    // applicant is worse than a clean error.
    let text: string;
    try {
      text = await upstream.text();
    } catch {
      // Transport/read failure mid-body → server-side, retryable.
      return serviceUnavailable(origin);
    }
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      // Upstream handed us an invalid 200 body → 502 (Bad Gateway), distinct
      // from 503 (token/transport). Never forward the raw body; never log the
      // body or receipt — only a non-identifying marker.
      return upstreamUnparseable(origin);
    }
    return jsonResponse(json, 200, origin);
  }

  // Non-200. Read as text and parse defensively: an error body may be JSON in
  // either documented shape, an HTML gateway page, or empty. Never logged.
  let text = '';
  try {
    text = await upstream.text();
  } catch {
    text = '';
  }
  const errors: PassthroughError[] = extractUpstreamErrors(text);

  // A 401 means the cached token is dead — expired early or revoked. Drop it so
  // the next lookup re-authenticates instead of 401-ing for the remaining life
  // of this isolate.
  if (status === 401) resetTokenCache();

  const safe = safeStatus(status);
  const { error, message } = fallbackFor(status);
  return jsonResponse(
    errorBody({ error, message, status: safe, source: 'uscis', errors }),
    safe,
    origin,
  );
}

/**
 * Returns a 429 Response when this connection is over the limit, else null.
 *
 * Keyed on CF-Connecting-IP. Cloudflare's own guidance argues against IP keys,
 * because mobile carriers and privacy proxies share them — but this endpoint is
 * unauthenticated, so there is no user identifier to key on instead. The limit
 * is set generously for that reason (20 per 60s, against a USCIS sandbox quota
 * of 5 TPS / 1,000 per day).
 *
 * Fails OPEN. A missing binding (unit tests, any older deployed config) or a
 * throwing limiter lets the request through: rate limiting here protects a
 * quota, it is not a security control, and breaking real lookups to enforce it
 * would be the wrong trade. The IP is used as a key and never logged.
 */
async function enforceRateLimit(
  request: Request,
  env: Env,
  origin: string | null,
): Promise<Response | null> {
  const limiter = env.CASE_STATUS_LIMITER;
  if (!limiter || typeof limiter.limit !== 'function') return null;
  const key = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  try {
    const { success } = await limiter.limit({ key });
    if (success) return null;
  } catch {
    return null;
  }
  // source:"worker" is what distinguishes this from a USCIS 429 (whose
  // documented message is "Spike Arrest Violation").
  return workerError(
    origin,
    429,
    'rate_limited',
    'RATE_LIMITED',
    'Too many lookups from this connection. Please wait a minute and try again.',
  );
}

// A failure that originated here, not at USCIS. Same envelope, source:"worker",
// and exactly one errors[] item so the UI has a single rendering path.
function workerError(
  origin: string | null,
  status: number,
  error: string,
  code: string,
  message: string,
): Response {
  return jsonResponse(
    errorBody({
      error,
      message,
      status,
      source: 'worker',
      errors: [{ code, message, status: String(status) }],
    }),
    status,
    origin,
  );
}

function invalidReceipt(origin: string | null): Response {
  return workerError(
    origin,
    422,
    'invalid_receipt_format',
    'INVALID_RECEIPT_FORMAT',
    'Receipt number must be 3 letters followed by 10 numbers.',
  );
}

// Upstream returned an invalid (unparseable) 200 body — an upstream data defect,
// distinct from a server-side outage. 502 Bad Gateway. We emit only a
// non-identifying marker (NO receipt, NO body, NO PII) so logs can show how often
// USCIS is malformed vs. unavailable without ever recording sensitive data.
function upstreamUnparseable(origin: string | null): Response {
  console.warn('upstream_unparseable');
  return workerError(
    origin,
    502,
    'upstream_unparseable',
    'UPSTREAM_UNPARSEABLE',
    "The case status service returned a response we couldn't read. Please try again later or check your status directly at egov.uscis.gov.",
  );
}

function serviceUnavailable(origin: string | null): Response {
  return workerError(
    origin,
    503,
    'service_unavailable',
    'SERVICE_UNAVAILABLE',
    'Case status service is temporarily unavailable. Please try again later.',
  );
}

export type { Env };
