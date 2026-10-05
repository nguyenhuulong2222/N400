// The outbound USCIS Case Status call.
//
// Endpoint, copied from the official USCIS OpenAPI spec and never guessed:
//   GET {USCIS_BASE_URL}/{receiptNumber}   Authorization: Bearer <token>
// The receipt does appear in this outbound URL — that is the published API
// contract for a server-to-USCIS call. It is never logged here and never
// placed in a response we return to our own clients (Invariant II).

import type { Env } from './env.ts';
import { demoId } from './env.ts';

// Thrown when the call cannot complete at all (network or transport). Carries
// no receipt, token, or body.
class UpstreamError extends Error {
  constructor() {
    super('upstream_unreachable');
    this.name = 'UpstreamError';
  }
}

/** Thrown on timeout, so the router can answer 504 rather than a generic 503. */
export class UpstreamTimeoutError extends Error {
  constructor() {
    super('upstream_timeout');
    this.name = 'UpstreamTimeoutError';
  }
}

// USCIS targets 10 requests per second; a call still open after this is no
// longer useful to someone watching a spinner.
const UPSTREAM_TIMEOUT_MS = 10_000;

/**
 * Call USCIS for an already-validated, normalized receipt and return the raw
 * response. The caller decides what to do with the body; error bodies are only
 * forwarded through the whitelist and receipt mask in errors.ts.
 */
export async function fetchCaseStatus(env: Env, token: string, receipt: string): Promise<Response> {
  const base = env.USCIS_BASE_URL;
  if (!base) throw new UpstreamError();
  const url = `${base.replace(/\/+$/, '')}/${encodeURIComponent(receipt)}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
  };

  // Demo traffic identifier, outbound only. Attached when DEMO_ID is non-empty,
  // so removing it after the demo is a config change, not a code change.
  const demo = demoId(env);
  if (demo !== null) headers['demo_id'] = demo;

  try {
    return await fetch(url, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (err) {
    // AbortSignal.timeout rejects with a DOMException named TimeoutError in
    // both workerd and Node, so this holds in tests and in production.
    if (err instanceof Error && err.name === 'TimeoutError') throw new UpstreamTimeoutError();
    throw new UpstreamError();
  }
}
