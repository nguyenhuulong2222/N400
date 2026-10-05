// MOCK_MODE responses, so the web and mobile apps can be developed against
// realistic payloads with no credentials and without spending the USCIS quota.
//
// The receipts below are the official USCIS sandbox samples, not real
// applicants' numbers, so it is safe to name them here and echo them in a mock
// payload. Production sets MOCK_MODE = "0", so none of this is reachable there.

import { jsonResponse } from './cors.ts';
import type { CorsContext } from './cors.ts';
import { errorBody } from './errors.ts';

// Sandbox receipts that return 200 with a populated hist_case_status[].
const WITH_HISTORY = new Set(['EAC9999103403', 'LIN9999106498', 'SRC9999102777']);

// Sandbox receipts that return 200 with no history. The live sandbox returns
// hist_case_status: null for these, not [].
const WITHOUT_HISTORY = new Set(['EAC9999103400', 'LIN9999106501', 'SRC9999132694']);

// The documented USCIS 404 message, reused by the mock miss below.
const NOT_FOUND_MESSAGE =
  'Case Status Online does not recognize the receipt number entered. Please check your receipt ' +
  'number and try again. If you need further assistance, please call the USCIS Contact Center at ' +
  '1-800-375-5283. (Mock — simulated USCIS error)';

/**
 * A canned success payload in the upstream shape:
 * { message, case_status: { …EN/ES text and desc, hist_case_status } }.
 *
 * Dates use USCIS's MM-DD-YYYY HH:MM:SS, not ISO, so the frontend cannot
 * quietly assume ISO. History items use the spec's `completed_text_*` names.
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
  return { message: 'Successfully retrieved case status', case_status: cs };
}

// Reserved demo receipts, each returning a canned UPSTREAM error body so the
// demo can show any response code on request. Messages are the USCIS spec's own
// examples plus a "(Mock — simulated USCIS error)" suffix. MCK is not a known
// prefix, so classifyReceipt returns "warn", which the router accepts.
const MOCK_UPSTREAM_ERRORS: Record<string, { status: number; body: unknown }> = {
  MCK0000000401: {
    status: 401,
    body: { code: 401, message: 'Invalid Access Token (Mock — simulated USCIS error)' },
  },
  MCK0000000404: {
    status: 404,
    body: { code: 404, message: NOT_FOUND_MESSAGE },
  },
  MCK0000000429: {
    status: 429,
    body: { code: 429, message: 'Spike Arrest Violation (Mock — simulated USCIS error)' },
  },
  // The body the live sandbox really returns: an { error: { … } } wrapper, a
  // string code, and leading whitespace. Kept as a raw string so the
  // whitespace survives and the mock parses the bytes production parses.
  MCK0000000503: {
    status: 503,
    body:
      '\n\n  {"error":{"code":"503","message":"The Case Status API Sandbox is unavailable at this time. ' +
      'Please retry your API request during normal operation hours M-F 7:00AM EST - 8:00 PM EST ' +
      '(Mock — simulated USCIS error)"}}',
  },
  // 500 is not a documented USCIS code. Tests only, not part of the demo.
  MCK0000000500: {
    status: 500,
    body: { code: 500, message: 'Internal Server Error (Mock — simulated USCIS error)' },
  },
  // The RFC 9457 array shape. Its message contains a receipt on purpose: it
  // must come back masked, which is what proves the mask is wired in.
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
 * A synthetic upstream Response for a reserved demo receipt, or null.
 * The caller runs it through the real mapUpstream, so the mock exercises the
 * production passthrough rather than bypassing it.
 */
export function mockUpstreamError(receipt: string): Response | null {
  const hit = MOCK_UPSTREAM_ERRORS[receipt];
  if (!hit) return null;
  // A string body is sent verbatim, which is how the captured 503 keeps its
  // leading whitespace. Object bodies are serialized.
  const payload = typeof hit.body === 'string' ? hit.body : JSON.stringify(hit.body);
  return new Response(payload, {
    status: hit.status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * A mock response for an already-validated receipt: 200 for a known sandbox
 * sample, otherwise the same 404 envelope the live path produces. Never calls
 * USCIS and never reads a credential.
 */
export function mockCaseStatus(receipt: string, cors: CorsContext): Response {
  if (WITH_HISTORY.has(receipt)) {
    return jsonResponse(buildCaseStatus(receipt, true), 200, cors);
  }
  if (WITHOUT_HISTORY.has(receipt)) {
    return jsonResponse(buildCaseStatus(receipt, false), 200, cors);
  }
  return jsonResponse(
    errorBody({
      error: 'case_not_found',
      message: 'No case was found for that receipt number.',
      status: 404,
      source: 'uscis',
      errors: [{ code: 404, message: NOT_FOUND_MESSAGE }],
    }),
    404,
    cors,
  );
}
