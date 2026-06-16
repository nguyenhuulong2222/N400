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

// Sandbox receipts that return 200 WITH a populated hist_case_status[].
const WITH_HISTORY = new Set(['EAC9999103403', 'LIN9999106498', 'SRC9999102777']);

// Sandbox receipts that return 200 with an EMPTY hist_case_status[].
const WITHOUT_HISTORY = new Set(['EAC9999103400', 'LIN9999106501', 'SRC9999132694']);

/**
 * Build a canned `case_status` payload mirroring the upstream USCIS shape
 * (EN + ES text/desc only — those are the only languages USCIS returns).
 */
function buildCaseStatus(receipt: string, withHistory: boolean): unknown {
  const cs: Record<string, unknown> = {
    receiptNumber: receipt,
    formType: 'N400',
    submittedDate: '2025-01-15T00:00:00Z',
    modifiedDate: '2025-03-02T00:00:00Z',
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
            date: '2025-01-15T00:00:00Z',
            current_case_status_text_en: 'Case Was Received',
            current_case_status_text_es: 'Se recibió su caso',
          },
          {
            date: '2025-02-10T00:00:00Z',
            current_case_status_text_en: 'Interview Was Scheduled',
            current_case_status_text_es: 'Se programó la entrevista',
          },
        ]
      : [],
  };
  return { case_status: cs };
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
  return jsonResponse(
    { ok: false, error: 'case_not_found', message: 'No case was found for that receipt number.' },
    404,
    origin,
  );
}
