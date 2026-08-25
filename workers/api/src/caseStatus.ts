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
 * Call USCIS for a normalized, already-validated receipt number and return the
 * raw upstream Response. The caller inspects status and decides what (if any)
 * body to forward — error bodies are NEVER passed through (they may echo the
 * receipt). Throws UpstreamError on transport failure.
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
    });
  } catch {
    throw new UpstreamError();
  }
}
