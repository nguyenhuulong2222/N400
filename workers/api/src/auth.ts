// OAuth 2.0 client-credentials token manager for the USCIS Case Status API.
//
// API Invariant I — the Client ID/Secret come ONLY from env bindings, are sent
// to USCIS via HTTP Basic auth, and are NEVER logged, returned, or printed.
// API Invariant IV — the ONLY thing cached is the access token, in-memory per
// isolate, keyed by a module-level constant (NOT by receipt). No user data,
// ever, is cached.
//
// Not used in MOCK_MODE — the router short-circuits to mock.ts before any token
// is requested, so the shell boots and runs with zero credentials.

import type { Env } from './env.ts';

// Thrown when a token cannot be obtained. Carries an upstream status code for
// the router to map — never carries a token, secret, or response body.
export class TokenError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(`token_request_failed:${status}`);
    this.name = 'TokenError';
    this.status = status;
  }
}

interface CachedToken {
  token: string;
  // epoch ms after which the token is considered expired (refresh 60s early).
  expiresAt: number;
}

// In-memory, per-isolate cache. Single constant key — there is exactly one
// client-credentials identity for this Worker. Survives only as long as the
// isolate; never persisted. (Module state is fine for a single token.)
let cached: CachedToken | null = null;

const SAFETY_WINDOW_MS = 60_000; // refresh a minute before real expiry
const DEFAULT_TTL_S = 3600; // fallback if USCIS omits expires_in

/**
 * Return a valid access token, reusing the cached one until it nears expiry.
 * Throws TokenError(status) on any failure — the caller maps it to a generic
 * 503 so token problems are never surfaced as the client's fault.
 */
export async function getAccessToken(env: Env): Promise<string> {
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.token;

  const clientId = env.USCIS_CLIENT_ID;
  const clientSecret = env.USCIS_CLIENT_SECRET;
  const tokenUrl = env.USCIS_TOKEN_URL;
  if (!clientId || !clientSecret || !tokenUrl) {
    // Misconfiguration is a server-side problem; 0 maps to a generic 503.
    throw new TokenError(0);
  }

  // RFC 6749 client_credentials grant. Credentials in the Basic header only.
  const basic = btoa(`${clientId}:${clientSecret}`);
  let res: Response;
  try {
    res = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({ grant_type: 'client_credentials', scope: 'read' }),
    });
  } catch {
    // Network/transport failure — never includes credentials.
    throw new TokenError(0);
  }

  if (!res.ok) {
    // Do NOT read/forward the body — token error bodies can echo credentials.
    throw new TokenError(res.status);
  }

  const json = (await res.json()) as { access_token?: string; accessToken?: string; expires_in?: number };
  const token = json.access_token ?? json.accessToken;
  if (!token) throw new TokenError(0);

  const ttlS = typeof json.expires_in === 'number' && json.expires_in > 0 ? json.expires_in : DEFAULT_TTL_S;
  cached = { token, expiresAt: now + ttlS * 1000 - SAFETY_WINDOW_MS };
  return token;
}

/** Test-only: clear the in-memory token cache. */
export function __resetTokenCache(): void {
  cached = null;
}
