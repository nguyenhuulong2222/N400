// Upstream USCIS Case Status call.
//
// Official endpoint (USCIS Case Status API OpenAPI, sandbox):
//   GET {USCIS_BASE_URL}/{receiptNumber}
//   Authorization: Bearer <token>
// API Invariant III — this URL is copied from the official spec; we never guess
// or scrape. The base URL is injected from config (sandbox vs production).
//
// API Invariant II nuance: the receipt number DOES appear in the outbound URL to
// USCIS — that is the official API contract and is a server→USCIS call, not our
// public surface. The receipt is used transiently and is NEVER logged here, and
// NEVER placed in a response/error we return to our own clients.

import type { Env } from './env.ts';
import { demoId } from './env.ts';

// Thrown when the upstream call cannot complete (network/transport). Carries no
// receipt, token, or body.
export class UpstreamError extends Error {
  constructor() {
    super('upstream_unreachable');
    this.name = 'UpstreamError';
  }
}

/**
 * The upstream did not answer inside UPSTREAM_TIMEOUT_MS. Distinct from
 * UpstreamError so the router can return 504 rather than a generic 503 — "USCIS
 * is slow" and "we could not reach USCIS" are different operational facts, and
 * the demo has to be able to show both.
 */
export class UpstreamTimeoutError extends Error {
  constructor() {
    super('upstream_timeout');
    this.name = 'UpstreamTimeoutError';
  }
}

// USCIS's production target is 10 TPS. A request still open after 10 seconds is
// not going to be useful to someone watching a spinner.
export const UPSTREAM_TIMEOUT_MS = 10_000;

/**
 * Call USCIS for a normalized, already-validated receipt number and return the
 * raw upstream Response. The caller inspects the status and decides what to do
 * with the body: error bodies are forwarded, but only through the whitelist and
 * receipt mask in errors.ts — never raw, because they can echo the receipt.
 * Throws UpstreamTimeoutError on timeout, UpstreamError on transport failure.
 */
export async function fetchCaseStatus(env: Env, token: string, receipt: string): Promise<Response> {
  const base = env.USCIS_BASE_URL;
  if (!base) throw new UpstreamError();
  const url = `${base.replace(/\/+$/, '')}/${encodeURIComponent(receipt)}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`, // token value never logged
    Accept: 'application/json',
  };

  // USCIS Torch API demo scheduling: identify our traffic to the USCIS team.
  // Env-gated (wrangler.toml [vars] DEMO_ID) and attached ONLY when non-empty,
  // so removing it after the demo is a one-line config change, not a code change.
  // Outbound-only: never added to any response we return, never logged, and it
  // carries no receipt or credential.
  const demo = demoId(env);
  if (demo !== null) headers['demo_id'] = demo;

  try {
    return await fetch(url, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (err) {
    // AbortSignal.timeout rejects with a DOMException named 'TimeoutError' in
    // both workerd and Node, so this check holds in tests and in production.
    if (err && (err as Error).name === 'TimeoutError') throw new UpstreamTimeoutError();
    throw new UpstreamError();
  }
}
