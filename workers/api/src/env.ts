// Shared environment shape for the Worker.
//
// Secrets (USCIS_CLIENT_ID / USCIS_CLIENT_SECRET) are bound ONLY via
// `wrangler secret put` (prod) or `.dev.vars` (local, gitignored). They are
// optional here because the shell must boot and run in MOCK_MODE with no
// secrets at all (Phase API-1 acceptance). API Invariant I — never commit,
// log, or return these.
//
// Non-secret config (USCIS_BASE_URL / USCIS_TOKEN_URL / MOCK_MODE) comes from
// wrangler.toml [vars].
export interface Env {
  // --- secrets (never committed / logged / returned) ---
  USCIS_CLIENT_ID?: string;
  USCIS_CLIENT_SECRET?: string;

  // --- non-secret config ([vars] in wrangler.toml) ---
  USCIS_BASE_URL?: string;
  USCIS_TOKEN_URL?: string;
  MOCK_MODE?: string;

  // Temporary demo identifier for USCIS Torch API demo scheduling. When set to a
  // non-empty value, the Case Status upstream call carries it as a `demo_id`
  // request header so the USCIS team can confirm our traffic. Non-secret, carries
  // no receipt/PII. Unset or empty (delete the wrangler.toml [vars] line) => the
  // header is not sent at all — removal is config, not code.
  DEMO_ID?: string;
}

/**
 * Mock mode is on when MOCK_MODE is "1" / "true" / "yes" (case-insensitive).
 * In mock mode the Worker serves canned responses and never touches USCIS or
 * any credential — so it runs with zero secrets configured.
 */
export function isMockMode(env: Env): boolean {
  const v = (env.MOCK_MODE ?? '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

/**
 * Trimmed DEMO_ID, or null when unset/blank. Callers attach the `demo_id`
 * header only when this returns a value.
 */
export function demoId(env: Env): string | null {
  const v = (env.DEMO_ID ?? '').trim();
  return v === '' ? null : v;
}
