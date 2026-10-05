// formn400-api — Cloudflare Worker.
//
// Proxies the official USCIS Case Status API so the USCIS Client ID and Secret
// never reach the browser or the mobile app. Serves no question or quiz data.
// Routes: GET /health, GET /, POST /case-status (receipt in the BODY, never in
// the URL — API Invariant II), OPTIONS for CORS preflight.

import type { Env } from './env.ts';
import { isMockMode } from './env.ts';
import { classifyReceipt, normalizeReceipt } from './receipt.ts';
import { corsContext, jsonResponse, preflightResponse } from './cors.ts';
import type { CorsContext } from './cors.ts';
import { mockCaseStatus, mockUpstreamError } from './mock.ts';
import { getAccessToken, TokenError, resetTokenCache } from './auth.ts';
import { fetchCaseStatus, UpstreamTimeoutError } from './caseStatus.ts';
import { errorBody, extractUpstreamErrors, fallbackFor, safeStatus } from './errors.ts';
import type { PassthroughError } from './errors.ts';

const SERVICE = 'formn400-api';
// Keep in sync with "version" in package.json.
const VERSION = '0.2.0';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const cors = corsContext(request);
    const { method } = request;
    const path = url.pathname;
    const mock = isMockMode(env);

    if (method === 'OPTIONS') {
      return preflightResponse(cors);
    }

    if (method === 'GET' && path === '/health') {
      return jsonResponse({ ok: true, service: SERVICE, version: VERSION, mock }, 200, cors);
    }

    if (method === 'GET' && path === '/') {
      return jsonResponse(
        { ok: true, service: SERVICE, message: 'FormN400 API is running.', mock },
        200,
        cors,
      );
    }

    if (method === 'POST' && path === '/case-status') {
      // Checked before the body is read: the limiter must never see the receipt.
      const limited = await enforceRateLimit(request, env, cors);
      if (limited) return limited;
      return handleCaseStatus(request, cors, env, mock);
    }

    return jsonResponse({ ok: false, error: 'not_found' }, 404, cors);
  },
};

// Validate the receipt, then answer from the mock table or from USCIS.
// The normalized receipt lives only in a local variable here and in the
// outbound URL; it is never logged, stored, or returned (API Invariant II).
async function handleCaseStatus(
  request: Request,
  cors: CorsContext,
  env: Env,
  mock: boolean,
): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return invalidReceipt(cors);
  }

  const rawReceipt =
    body && typeof body === 'object' ? (body as Record<string, unknown>).receiptNumber : undefined;

  // The Worker validates independently; it never trusts client-side validation.
  const { state } = classifyReceipt(rawReceipt);
  if (state === 'empty' || state === 'invalid') {
    return invalidReceipt(cors);
  }

  const receipt = normalizeReceipt(rawReceipt);
  if (receipt === null) {
    // Unreachable given the classification above; fail safe.
    return invalidReceipt(cors);
  }

  if (mock) {
    // Reserved demo receipts return a synthetic upstream response and then go
    // through the real mapUpstream, so the demo exercises production code.
    const canned = mockUpstreamError(receipt);
    if (canned) return mapUpstream(canned, cors);
    return mockCaseStatus(receipt, cors);
  }

  let token: string;
  try {
    token = await getAccessToken(env);
  } catch (err) {
    // Only the status reaches us. auth.ts never reads the token response body,
    // because that body can echo the client secret.
    const tokenStatus = err instanceof TokenError ? err.status : 0;
    if (tokenStatus === 400 || tokenStatus === 401) {
      return workerError(
        cors,
        401,
        'uscis_auth_failed',
        'USCIS_AUTH_FAILED',
        'We could not authenticate with the USCIS case status service. Please try again later.',
      );
    }
    return serviceUnavailable(cors);
  }

  let upstream: Response;
  try {
    upstream = await fetchCaseStatus(env, token, receipt);
  } catch (err) {
    if (err instanceof UpstreamTimeoutError) {
      return workerError(
        cors,
        504,
        'upstream_timeout',
        'UPSTREAM_TIMEOUT',
        'The USCIS case status service did not respond in time. Please try again.',
      );
    }
    return serviceUnavailable(cors);
  }

  return mapUpstream(upstream, cors);
}

// Turn the upstream response into our client response. A 200 body is passed
// through unchanged. Every non-200 keeps the upstream status and carries the
// USCIS message, whitelisted and receipt-masked by errors.ts, so the user can
// read what USCIS actually said.
async function mapUpstream(upstream: Response, cors: CorsContext): Promise<Response> {
  const status = upstream.status;

  if (status === 200) {
    // Read as text and JSON.parse by hand, not upstream.json(), so a parse
    // failure can be reported as its own error. The USCIS sandbox has returned
    // HTTP 200 with syntactically invalid JSON (an unescaped quote inside an
    // HTML anchor in current_case_status_desc_en). We do not try to repair it:
    // guessing at legal status text is worse than a clean error.
    let text: string;
    try {
      text = await upstream.text();
    } catch {
      return serviceUnavailable(cors);
    }
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      return upstreamUnparseable(cors);
    }
    return jsonResponse(json, 200, cors);
  }

  // An error body may be JSON in any of the shapes errors.ts knows, an HTML
  // gateway page, or empty. Never logged.
  let text = '';
  try {
    text = await upstream.text();
  } catch {
    text = '';
  }
  const errors: PassthroughError[] = extractUpstreamErrors(text);

  // A 401 means the cached token is dead, so drop it rather than reuse it for
  // the remaining life of this isolate.
  if (status === 401) resetTokenCache();

  const safe = safeStatus(status);
  const { error, message } = fallbackFor(status);
  return jsonResponse(errorBody({ error, message, status: safe, source: 'uscis', errors }), safe, cors);
}

// Returns a 429 response when this connection is over the limit, else null.
//
// Keyed on CF-Connecting-IP. Cloudflare advises against IP keys because they
// are shared, but this endpoint is unauthenticated so there is no user to key
// on; the limit is generous for that reason. Fails open: a missing binding or a
// throwing limiter lets the request through, because this protects a quota and
// is not a security control. The IP is used as a key and never logged.
async function enforceRateLimit(
  request: Request,
  env: Env,
  cors: CorsContext,
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
  // source "worker" is what tells this apart from a USCIS 429.
  return workerError(
    cors,
    429,
    'rate_limited',
    'RATE_LIMITED',
    'Too many lookups from this connection. Please wait a minute and try again.',
  );
}

// A failure that originated here, not at USCIS. One errors[] item, so the UI
// has a single rendering path for both sources.
function workerError(
  cors: CorsContext,
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
    cors,
  );
}

function invalidReceipt(cors: CorsContext): Response {
  return workerError(
    cors,
    422,
    'invalid_receipt_format',
    'INVALID_RECEIPT_FORMAT',
    'Receipt number must be 3 letters followed by 10 numbers.',
  );
}

// Upstream sent a 200 we could not parse: 502, distinct from a 503 outage. The
// marker carries no receipt, no body, and no PII, so logs can show how often
// USCIS is malformed without recording anything sensitive.
function upstreamUnparseable(cors: CorsContext): Response {
  console.warn('upstream_unparseable');
  return workerError(
    cors,
    502,
    'upstream_unparseable',
    'UPSTREAM_UNPARSEABLE',
    "The case status service returned a response we couldn't read. Please try again later or check your status directly at egov.uscis.gov.",
  );
}

function serviceUnavailable(cors: CorsContext): Response {
  return workerError(
    cors,
    503,
    'service_unavailable',
    'SERVICE_UNAVAILABLE',
    'Case status service is temporarily unavailable. Please try again later.',
  );
}
