// formn400-api — Cloudflare Worker.
//
// Purpose: proxy the official USCIS Case Status API so the USCIS Client ID /
// Client Secret never reach the browser or the mobile app. This Worker serves
// NO question / quiz / civics data — that stays in the pure-static web app.
//
// Phase API-1: foundation only. The /case-status endpoint validates the receipt
// format and then returns 501 — it does NOT call USCIS yet. The live USCIS
// integration (OAuth + Torch API call) lands in a later phase, in src/uscis.ts,
// only once the official endpoint/spec has been copied from the developer portal.

import { classifyReceipt } from './receipt.ts';
import { jsonResponse, preflightResponse } from './cors.ts';

const SERVICE = 'formn400-api';
const VERSION = '0.1.0';

export interface Env {
  // Bound later via `wrangler secret put` (never committed, never logged).
  // Present here only so TypeScript knows the shape; unused in API-1.
  USCIS_CLIENT_ID?: string;
  USCIS_CLIENT_SECRET?: string;
}

export default {
  async fetch(request: Request, _env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    const { method } = request;
    const path = url.pathname;

    // CORS preflight. Required for /case-status; harmless for any route.
    if (method === 'OPTIONS') {
      return preflightResponse(origin);
    }

    // GET /health
    if (method === 'GET' && path === '/health') {
      return jsonResponse({ ok: true, service: SERVICE, version: VERSION }, 200, origin);
    }

    // GET /
    if (method === 'GET' && path === '/') {
      return jsonResponse(
        { ok: true, service: SERVICE, message: 'FormN400 API is running.' },
        200,
        origin,
      );
    }

    // POST /case-status
    if (method === 'POST' && path === '/case-status') {
      return handleCaseStatus(request, origin);
    }

    // Unknown route.
    return jsonResponse({ ok: false, error: 'not_found' }, 404, origin);
  },
};

// Receipt numbers are sensitive immigration identifiers. Never log, store, or
// place them in URLs.
//
// TODO: Add rate limiting before USCIS production integration. USCIS quotas must
// be protected. Rate-limit by IP using a Cloudflare primitive (e.g. the Rate
// Limiting binding) or external storage. If logging request metadata, never log
// the receipt number.
async function handleCaseStatus(request: Request, origin: string | null): Promise<Response> {
  // Parse JSON safely. We intentionally never log the request body — it carries
  // the receipt number (Invariant II).
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return invalidReceipt(origin);
  }

  const receiptNumber =
    body && typeof body === 'object' ? (body as Record<string, unknown>).receiptNumber : undefined;

  // The Worker validates independently — it never trusts client-side validation.
  const { state, prefixKnown } = classifyReceipt(receiptNumber);

  // Empty or structurally invalid → 400. (Both collapse to the same response;
  // we never reveal which, and never echo the receipt.)
  if (state === 'empty' || state === 'invalid') {
    return invalidReceipt(origin);
  }

  // 'valid' or 'warn' — format is acceptable, but the live USCIS integration is
  // not wired up yet (API-1). Return 501, never call USCIS, never echo the number.
  return jsonResponse(
    {
      ok: false,
      error: 'uscis_api_not_configured',
      message: 'Live USCIS case status lookup is not connected yet.',
      receiptFormat: 'valid',
      prefixKnown,
    },
    501,
    origin,
  );
}

function invalidReceipt(origin: string | null): Response {
  return jsonResponse(
    {
      ok: false,
      error: 'invalid_receipt_format',
      message: 'Receipt number must be 3 letters followed by 10 numbers.',
    },
    400,
    origin,
  );
}
