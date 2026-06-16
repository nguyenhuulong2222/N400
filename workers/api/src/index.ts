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
import { mockCaseStatus } from './mock.ts';
import { getAccessToken, TokenError } from './auth.ts';
import { fetchCaseStatus, UpstreamError } from './caseStatus.ts';

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
// TODO: Add rate limiting before USCIS production integration. USCIS quotas must
// be protected (sandbox 5 TPS / 1k day; prod 10 TPS / 150k day). Rate-limit by
// IP using a Cloudflare primitive (Rate Limiting binding). Never log the receipt.
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
    return mockCaseStatus(receipt, origin);
  }

  // Live path. Token problems are server-side → generic 503 (never the client's
  // fault, never leak token detail). Upstream errors map to clean envelopes.
  let token: string;
  try {
    token = await getAccessToken(env);
  } catch (err) {
    void (err as TokenError); // status intentionally not surfaced to the client
    return serviceUnavailable(origin);
  }

  let upstream: Response;
  try {
    upstream = await fetchCaseStatus(env, token, receipt);
  } catch (err) {
    void (err as UpstreamError);
    return serviceUnavailable(origin);
  }

  return mapUpstream(upstream, origin);
}

// Translate the upstream USCIS response into our client-facing response.
// 200 is passed through as-is. Every non-200 becomes a clean envelope — we never
// forward an upstream error body (it can echo the receipt or internal detail).
async function mapUpstream(upstream: Response, origin: string | null): Promise<Response> {
  switch (upstream.status) {
    case 200: {
      let json: unknown;
      try {
        json = await upstream.json();
      } catch {
        return serviceUnavailable(origin);
      }
      return jsonResponse(json, 200, origin);
    }
    case 404:
      return jsonResponse(
        { ok: false, error: 'case_not_found', message: 'No case was found for that receipt number.' },
        404,
        origin,
      );
    case 422:
      return invalidReceipt(origin);
    case 429:
      return jsonResponse(
        { ok: false, error: 'rate_limited', message: 'Too many requests. Please try again shortly.' },
        429,
        origin,
      );
    // 401 (token problem) and anything else are server-side concerns → 503.
    default:
      return serviceUnavailable(origin);
  }
}

function invalidReceipt(origin: string | null): Response {
  return jsonResponse(
    {
      ok: false,
      error: 'invalid_receipt_format',
      message: 'Receipt number must be 3 letters followed by 10 numbers.',
    },
    422,
    origin,
  );
}

function serviceUnavailable(origin: string | null): Response {
  return jsonResponse(
    {
      ok: false,
      error: 'service_unavailable',
      message: 'Case status service is temporarily unavailable. Please try again later.',
    },
    503,
    origin,
  );
}

export type { Env };
