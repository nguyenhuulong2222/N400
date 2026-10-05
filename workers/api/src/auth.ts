// OAuth 2.0 client-credentials token manager for the USCIS Case Status API.
//
// The Client ID and Secret come only from env bindings, go to USCIS in an HTTP
// Basic header, and are never logged, returned, or printed (Invariant I).
// The only thing cached is the access token, in memory, per isolate, keyed by
// nothing — there is one identity for this Worker. No user data is cached.

import type { Env } from './env.ts';

// Thrown when a token cannot be obtained. Carries the upstream status for the
// router to map; never a token, secret, or response body.
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
  expiresAt: number;
}

let cached: CachedToken | null = null;

// Refresh this long before the real expiry, so a token never expires in flight.
const SAFETY_WINDOW_MS = 60_000;
// Used only when USCIS omits expires_in.
const DEFAULT_TTL_S = 3600;
// Status reported when the failure is ours (misconfiguration, transport).
const NO_UPSTREAM_STATUS = 0;

/**
 * A valid access token, reusing the cached one until it nears expiry.
 * Throws TokenError(status) on any failure.
 */
export async function getAccessToken(env: Env): Promise<string> {
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.token;

  const clientId = env.USCIS_CLIENT_ID;
  const clientSecret = env.USCIS_CLIENT_SECRET;
  const tokenUrl = env.USCIS_TOKEN_URL;
  if (!clientId || !clientSecret || !tokenUrl) {
    throw new TokenError(NO_UPSTREAM_STATUS);
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
    throw new TokenError(NO_UPSTREAM_STATUS);
  }

  // Do not read the body on failure: a token error body can echo credentials.
  if (!res.ok) throw new TokenError(res.status);

  const json = (await res.json()) as {
    access_token?: string;
    accessToken?: string;
    expires_in?: number;
  };
  const token = json.access_token ?? json.accessToken;
  if (!token) throw new TokenError(NO_UPSTREAM_STATUS);

  const ttlS =
    typeof json.expires_in === 'number' && json.expires_in > 0 ? json.expires_in : DEFAULT_TTL_S;
  cached = { token, expiresAt: now + ttlS * 1000 - SAFETY_WINDOW_MS };
  return token;
}

/**
 * Drop the cached token. Called on an upstream 401, where the token is expired
 * early or revoked and reusing it would fail every later lookup in this
 * isolate. Costs one extra token fetch. Logs nothing.
 */
export function resetTokenCache(): void {
  cached = null;
}
