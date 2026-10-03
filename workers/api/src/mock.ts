// MOCK_MODE responses — let the web app and mobile app develop against
// realistic case-status payloads WITHOUT any USCIS credentials and WITHOUT
// touching the live (quota-limited) USCIS API.
//
// The receipt numbers below are the OFFICIAL USCIS sandbox sample receipts from
// the Case Status API documentation. They are NOT real applicants' numbers, so
// it is safe to reference them in source and to echo them in the mock payload
// (mirroring the upstream passthrough shape). API Invariant II still forbids
// logging/storing/URL-placing any *real* user's receipt anywhere.

import { jsonResponse } from './cors.ts';
import { errorBody } from './errors.ts';

// Sandbox receipts that return 200 WITH a populated hist_case_status[].
const WITH_HISTORY = new Set(['EAC9999103403', 'LIN9999106498', 'SRC9999102777']);

// Sandbox receipts that return 200 with NO history. The live USCIS sandbox
// returns `hist_case_status: null` for these (NOT an empty array) — confirmed by
// fetching the raw JSON for EAC9999103400 during the API-2 sandbox run.
const WITHOUT_HISTORY = new Set(['EAC9999103400', 'LIN9999106501', 'SRC9999132694']);

/**
 * Build a canned success envelope mirroring the upstream USCIS shape:
 *   { message, case_status: { ...EN/ES text/desc, hist_case_status } }
 *
 * Shape notes (verified against the live sandbox in API-2):
 *  - No-history cases return `hist_case_status: null`, NOT `[]`.
 *  - The envelope carries a top-level `message` string alongside `case_status`.
 *  - Dates use USCIS's `MM-DD-YYYY HH:MM:SS` format, NOT ISO — the mock matches
 *    so the frontend can't quietly assume ISO.
 *  - USCIS returns EN + ES text/desc only (the only languages it ships).
 *  - History items carry `date` + `completed_text_en` / `completed_text_es`,
 *    which is what the published spec declares. An earlier version of this mock
 *    used `current_case_status_text_en` inside history items — a name that
 *    appears nowhere in the spec. Our shape-delta runner never caught it
 *    because it only diffs top-level `case_status` keys, never inside the
 *    array, so this was never verified against the live sandbox. The frontend
 *    reads `completed_text_en` first and falls back to the old name, and the
 *    Monday sandbox run settles which one USCIS actually sends.
 */
function buildCaseStatus(receipt: string, withHistory: boolean): unknown {
  const cs: Record<string, unknown> = {
    receiptNumber: receipt,
    formType: 'N400',
    submittedDate: '01-15-2025 09:00:00',
    modifiedDate: '03-02-2025 14:28:46',
    current_case_status_text_en: 'Case Was Received',
    current_case_status_text_es: 'Se recibió su caso',
    current_case_status_desc_en:
      'On January 15, 2025, we received your Form N-400, Application for Naturalization. ' +
      '(Mock response — not a live USCIS result.)',
    current_case_status_desc_es:
      'El 15 de enero de 2025, recibimos su Formulario N-400, Solicitud de Naturalización. ' +
      '(Respuesta simulada — no es un resultado real de USCIS.)',
    // Live USCIS returns null (not []) when a case has no status history.
    hist_case_status: withHistory
      ? [
          {
            date: '01-15-2025 09:00:00',
            completed_text_en: 'Case Was Received',
            completed_text_es: 'Se recibió su caso',
          },
          {
            date: '02-10-2025 11:42:13',
            completed_text_en: 'Interview Was Scheduled',
            completed_text_es: 'Se programó la entrevista',
          },
        ]
      : null,
  };
  // Top-level `message` mirrors the upstream success envelope.
  return { message: 'Successfully retrieved case status', case_status: cs };
}

// Reserved demo receipts → canned UPSTREAM error responses, MOCK_MODE only.
//
// Messages are the published spec's own examples verbatim, plus the required
// "(Mock — simulated USCIS error)" suffix, so what the demo shows matches what
// the documentation promises.
//
// The spec documents exactly six responses — 200, 401, 404, 422, 429, 503 — so
// there is no further code to add. MCK0000000500 is NOT one of them; it exists
// only to exercise the generic 5xx branch in tests and is excluded from the
// demo script (see README).
//
// `MCK` is not in KNOWN_PREFIXES, so classifyReceipt returns 'warn', which the
// router accepts — these receipts reach this table. Production sets
// MOCK_MODE = "0", so none of it is reachable there.
const MOCK_UPSTREAM_ERRORS: Record<string, { status: number; body: unknown }> = {
  MCK0000000401: {
    status: 401,
    body: { code: 401, message: 'Invalid Access Token (Mock — simulated USCIS error)' },
  },
  MCK0000000404: {
    status: 404,
    body: {
      code: 404,
      message:
        'Case Status Online does not recognize the receipt number entered. Please check your receipt number and try again. If you need further assistance, please call the USCIS Contact Center at 1-800-375-5283. (Mock — simulated USCIS error)',
    },
  },
  MCK0000000429: {
    status: 429,
    body: { code: 429, message: 'Spike Arrest Violation (Mock — simulated USCIS error)' },
  },
  // The REAL body the live sandbox returned, captured 2026-10-03 09:34 UTC by
  // direct curl while the sandbox was closed — the `{"error":{…}}` wrapper,
  // `code` as a string, and the leading newlines and spaces exactly as they
  // arrived. Held as a raw string rather than an object so the whitespace
  // survives: this fixture is the bytes we were sent, not a tidied version of
  // them, so the local demo parses what production parses.
  MCK0000000503: {
    status: 503,
    body:
      '\n\n  {"error":{"code":"503","message":"The Case Status API Sandbox is unavailable at this time. ' +
      'Please retry your API request during normal operation hours M-F 7:00AM EST - 8:00 PM EST ' +
      '(Mock — simulated USCIS error)"}}',
  },
  // Undocumented code. Tests only — not part of the demo.
  MCK0000000500: {
    status: 500,
    body: { code: 500, message: 'Internal Server Error (Mock — simulated USCIS error)' },
  },
  // The RFC 9457 array shape documented on the USCIS Production Access page.
  // The message carries a receipt-shaped token ON PURPOSE: it must come back
  // masked as EAC*******403, which is what proves the mask is wired in.
  MCK0000009457: {
    status: 400,
    body: {
      errors: [
        {
          code: 'BAD_REQUEST',
          message: 'Request rejected for EAC9999103403 (Mock — simulated USCIS error)',
          category: 'VALIDATION',
          reference: 'mock-ref-1',
          status: '400',
          traceId: 'mock-trace-0001',
        },
      ],
    },
  },
};

/**
 * Synthetic UPSTREAM Response for a reserved demo receipt, or null.
 *
 * The caller runs the result through the real mapUpstream, so the mock proves
 * the production passthrough / masking / status-mapping path rather than
 * bypassing it.
 */
export function mockUpstreamError(receipt: string): Response | null {
  const hit = MOCK_UPSTREAM_ERRORS[receipt];
  if (!hit) return null;
  // A string body is emitted verbatim — that is how the captured 503 keeps its
  // leading whitespace. Object bodies are serialized as before.
  const payload = typeof hit.body === 'string' ? hit.body : JSON.stringify(hit.body);
  return new Response(payload, {
    status: hit.status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Resolve a mock response for an already-validated, normalized receipt number.
 *
 * - Known sandbox receipt (with/without history) → 200 canned case_status.
 * - Any other structurally valid receipt          → 404 clean envelope.
 *
 * Never calls USCIS; never reads any credential.
 */
export function mockCaseStatus(receipt: string, origin: string | null): Response {
  if (WITH_HISTORY.has(receipt)) {
    return jsonResponse(buildCaseStatus(receipt, true), 200, origin);
  }
  if (WITHOUT_HISTORY.has(receipt)) {
    return jsonResponse(buildCaseStatus(receipt, false), 200, origin);
  }
  // Same envelope the live path produces, carrying the spec's documented 404
  // message — so a local demo of "receipt not found" shows what USCIS would
  // actually say rather than only our own fallback sentence.
  return jsonResponse(
    errorBody({
      error: 'case_not_found',
      message: 'No case was found for that receipt number.',
      status: 404,
      source: 'uscis',
      errors: [
        {
          code: 404,
          message:
            'Case Status Online does not recognize the receipt number entered. Please check your receipt number and try again. If you need further assistance, please call the USCIS Contact Center at 1-800-375-5283. (Mock — simulated USCIS error)',
        },
      ],
    }),
    404,
    origin,
  );
}
