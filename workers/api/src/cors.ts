// CORS — explicit origin allowlist (API Invariant V).
//
// Never use a wildcard "*". Browser requests from an allowlisted Origin get that
// exact Origin echoed back in Access-Control-Allow-Origin. Everything else gets
// no ACAO header (the browser then blocks the response).

// Exact origins permitted to call this API from a browser.
//  - https://formn400.org / https://www.formn400.org → production web app
//  - http://localhost:8787 / http://127.0.0.1:8787    → `wrangler dev` default
//  - http://localhost:8765                            → local static-site preview
export const ALLOWED_ORIGINS = new Set([
  'https://formn400.org',
  'https://www.formn400.org',
  'http://localhost:8787',
  'http://127.0.0.1:8787',
  'http://localhost:8765',
]);

/**
 * Build the response headers for a given request Origin.
 *
 * - Origin allowlisted     → echo the exact Origin in Access-Control-Allow-Origin.
 * - Origin missing (null)  → return headers WITHOUT ACAO. Native mobile fetch
 *   normally does not send an Origin header and is not governed by browser CORS,
 *   so the request is allowed to proceed and simply gets no ACAO.
 * - Origin present but not allowlisted → no ACAO is set; the browser blocks it.
 *   (Returning 403 is optional and not done here — omitting ACAO is sufficient.)
 *
 * Content-Type is always application/json since every endpoint returns JSON.
 */
export function corsHeaders(origin: string | null): Headers {
  const headers = new Headers({
    'Content-Type': 'application/json',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  });
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
  }
  return headers;
}

/** Convenience for OPTIONS preflight: 204 No Content with the CORS headers. */
export function preflightResponse(origin: string | null): Response {
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

/** JSON response helper that always attaches the correct CORS headers. */
export function jsonResponse(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(origin) });
}
