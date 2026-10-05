// CORS — hardcoded origin allowlist (API Invariant V). Never a wildcard.
// Production origins are always accepted. Local-dev origins are accepted only
// when the request did not come through the Cloudflare edge, so no env var or
// wrangler.toml value can widen production.
// An allowlisted Origin is echoed back; anything else gets no ACAO header and
// the browser blocks it. A request with no Origin (native mobile) is unaffected.

const PRODUCTION_ORIGINS = new Set(['https://formn400.org', 'https://www.formn400.org']);

// Local static-site preview, honoured only on a locally running Worker.
const LOCAL_DEV_ORIGINS = new Set(['http://localhost:8765']);

/** Request Origin plus whether this Worker instance is running locally. */
export interface CorsContext {
  origin: string | null;
  local: boolean;
}

/**
 * Derive the CORS context once per request, from the request itself.
 *
 * Local is decided by the absence of CF-Ray. Cloudflare sets that header on
 * every request through its edge and overwrites any client-supplied value, so
 * a request without it did not come from the edge.
 *
 * The request URL cannot be used for this: when wrangler.toml declares a
 * custom-domain route, `wrangler dev` rewrites request.url to that route, so
 * the hostname reads api.formn400.org even on a local server.
 */
export function corsContext(request: Request): CorsContext {
  return {
    origin: request.headers.get('Origin'),
    local: request.headers.get('CF-Ray') === null,
  };
}

// Returns the Origin to echo, or null when it must not be echoed.
function allowedOrigin(cors: CorsContext): string | null {
  const { origin, local } = cors;
  if (!origin) return null;
  if (PRODUCTION_ORIGINS.has(origin)) return origin;
  if (local && LOCAL_DEV_ORIGINS.has(origin)) return origin;
  return null;
}

/** Response headers. Content-Type is always JSON; every endpoint returns JSON. */
export function corsHeaders(cors: CorsContext): Headers {
  const headers = new Headers({
    'Content-Type': 'application/json',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  });
  const allowed = allowedOrigin(cors);
  if (allowed) headers.set('Access-Control-Allow-Origin', allowed);
  return headers;
}

/** OPTIONS preflight: 204 No Content with the CORS headers. */
export function preflightResponse(cors: CorsContext): Response {
  return new Response(null, { status: 204, headers: corsHeaders(cors) });
}

/** JSON response with the correct CORS headers. */
export function jsonResponse(body: unknown, status: number, cors: CorsContext): Response {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(cors) });
}
