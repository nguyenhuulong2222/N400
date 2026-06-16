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
            current_case_status_text_en: 'Case Was Received',
            current_case_status_text_es: 'Se recibió su caso',
          },
          {
            date: '02-10-2025 11:42:13',
            current_case_status_text_en: 'Interview Was Scheduled',
            current_case_status_text_es: 'Se programó la entrevista',
          },
        ]
      : null,
  };
  // Top-level `message` mirrors the upstream success envelope.
  return { message: 'Successfully retrieved case status', case_status: cs };
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
