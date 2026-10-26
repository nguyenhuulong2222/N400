// The Worker's environment shape.
//
// Secrets come only from `wrangler secret put` (production) or .dev.vars
// (local, gitignored) and are optional here so the Worker can boot and serve
// mock responses with no credentials at all. Never committed, logged, or
// returned (Invariant I). Non-secret config comes from wrangler.toml [vars].
export interface Env {
  // Secrets.
  USCIS_CLIENT_ID?: string;
  USCIS_CLIENT_SECRET?: string;

  // Non-secret config from wrangler.toml [vars].
  USCIS_BASE_URL?: string;
  USCIS_TOKEN_URL?: string;
  MOCK_MODE?: string;

  // Rate Limiting binding (wrangler.toml [[ratelimits]]). Optional because the
  // unit tests have no binding and the Worker must serve rather than crash.
  CASE_STATUS_LIMITER?: RateLimit;
}

/**
 * True when MOCK_MODE is "1", "true" or "yes" (case-insensitive). In mock mode
 * the Worker serves canned responses and touches no credential.
 */
export function isMockMode(env: Env): boolean {
  const v = (env.MOCK_MODE ?? '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}
