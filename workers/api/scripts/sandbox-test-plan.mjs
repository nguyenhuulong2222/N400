// Phase API-2 — repeatable USCIS sandbox test plan.
//
// Tests THROUGH the Worker's own logic (the real POST /case-status contract):
// it imports the Worker module and invokes worker.fetch() with an `env` built
// from process.env. This validates the full client contract AND exercises the
// live sandbox (validation → auth.ts token → caseStatus.ts upstream call →
// error mapping) in one shot — no separate `wrangler dev` process required, so
// it is CI/cron-friendly.
//
// MODES:
//   LIVE  (default): requires USCIS_CLIENT_ID + USCIS_CLIENT_SECRET in env;
//                    makes real calls to the USCIS sandbox.
//   MOCK  (MOCK_MODE=1): no creds, no USCIS calls — a wiring check against the
//                    API-1 mock so you can sanity-check this script for free.
//
// PII (API Invariant II): this script accepts NO receipt input from argv/stdin.
// Every receipt below is a hardcoded OFFICIAL USCIS sandbox *sample* (fake) or a
// synthetic malformed string. No real user receipt ever appears here, and the
// token-fetch counter never logs a URL (a case-status URL would carry a receipt).
//
// Run:
//   cd workers/api
//   MOCK_MODE=1 node scripts/sandbox-test-plan.mjs                                  # dry run, no creds
//   USCIS_CLIENT_ID=... USCIS_CLIENT_SECRET=... node scripts/sandbox-test-plan.mjs  # live sandbox
// Exits non-zero on any failure (so it can gate CI / a daily cron later).

import worker from '../src/index.ts';
import { isMockMode } from '../src/env.ts';

// Official USCIS sandbox endpoints (verified in API-1). Overridable via env.
const SANDBOX_BASE = 'https://api-int.uscis.gov/case-status';
const SANDBOX_TOKEN = 'https://api-int.uscis.gov/oauth/accesstoken';

// Stay FAR under sandbox quota (5 TPS / 1,000 per day): one request per 250ms,
// strictly sequential.
const THROTTLE_MS = 250;
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// Fields the API-1 mock models. Live 200s are diffed against this to surface any
// shape delta (extra/missing fields) — reported, never silently absorbed.
const EXPECTED_CASE_FIELDS = [
  'receiptNumber',
  'formType',
  'submittedDate',
  'modifiedDate',
  'current_case_status_text_en',
  'current_case_status_text_es',
  'current_case_status_desc_en',
  'current_case_status_desc_es',
  'hist_case_status',
];

// Representative matrix (NOT the full staging list — quota-aware). Every receipt
// here is in BOTH the live staging lists AND the API-1 mock sets, so the MOCK
// dry run passes identically to a healthy LIVE run.
const MATRIX = [
  { klass: 'hist', label: 'with-history #1', receipt: 'EAC9999103403', expect: 200, history: 'non-empty' },
  { klass: 'hist', label: 'with-history #2', receipt: 'LIN9999106498', expect: 200, history: 'non-empty' },
  { klass: 'hist', label: 'with-history #3', receipt: 'SRC9999102777', expect: 200, history: 'non-empty' },
  { klass: 'nohist', label: 'no-history #1', receipt: 'EAC9999103400', expect: 200, history: 'empty' },
  { klass: 'nohist', label: 'no-history #2', receipt: 'LIN9999106501', expect: 200, history: 'empty' },
  { klass: 'nohist', label: 'no-history #3', receipt: 'SRC9999132694', expect: 200, history: 'empty' },
  { klass: '404', label: 'unknown valid-format', receipt: 'EAC0000000000', expect: 404 },
  { klass: '422', label: 'malformed (short)', receipt: 'ABC123', expect: 422, localOnly: true },
  { klass: '422', label: 'malformed (empty)', receipt: '', expect: 422, localOnly: true },
];

function displayReceipt(r) {
  return r === '' ? '(empty)' : r;
}

function callWorker(env, receipt) {
  const init = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ receiptNumber: receipt }),
  };
  // Host is irrelevant (handler routes on pathname); no receipt in the URL.
  return worker.fetch(new Request('https://api.local/case-status', init), env);
}

function pad(s, n) {
  s = String(s);
  return s.length >= n ? s : s + ' '.repeat(n - s.length);
}

function printTable(rows) {
  console.log(
    `${pad('RESULT', 7)}${pad('CLASS', 8)}${pad('LABEL', 22)}${pad('RECEIPT', 16)}${pad('EXP', 5)}${pad('GOT', 5)}DETAIL/NOTES`,
  );
  console.log('-'.repeat(96));
  for (const r of rows) {
    const result = r.pass ? 'PASS' : 'FAIL';
    const detail = [r.detail, ...r.notes].filter(Boolean).join(' | ');
    console.log(
      `${pad(result, 7)}${pad(r.klass, 8)}${pad(r.label, 22)}${pad(displayReceipt(r.receipt), 16)}${pad(r.expect, 5)}${pad(r.got, 5)}${detail}`,
    );
  }
}

async function main() {
  const mock = isMockMode(process.env);
  const clientId = process.env.USCIS_CLIENT_ID;
  const clientSecret = process.env.USCIS_CLIENT_SECRET;

  if (!mock && (!clientId || !clientSecret)) {
    console.error('Refusing to run: LIVE mode requires USCIS_CLIENT_ID and USCIS_CLIENT_SECRET in the environment.');
    console.error('(Secrets are never printed, committed, or hardcoded.)');
    console.error('');
    console.error('  MOCK_MODE=1 node scripts/sandbox-test-plan.mjs                                  # wiring check, no creds');
    console.error('  USCIS_CLIENT_ID=... USCIS_CLIENT_SECRET=... node scripts/sandbox-test-plan.mjs  # live sandbox');
    process.exit(1);
  }

  const workerEnv = {
    USCIS_CLIENT_ID: clientId,
    USCIS_CLIENT_SECRET: clientSecret,
    USCIS_BASE_URL: process.env.USCIS_BASE_URL ?? SANDBOX_BASE,
    USCIS_TOKEN_URL: process.env.USCIS_TOKEN_URL ?? SANDBOX_TOKEN,
    MOCK_MODE: mock ? '1' : '0',
  };

  // Count token-endpoint fetches to prove in-memory token reuse. We compare the
  // URL only against the token URL and NEVER log it (a case-status URL contains
  // a receipt).
  let tokenFetches = 0;
  const realFetch = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input?.url;
    if (url === workerEnv.USCIS_TOKEN_URL) tokenFetches++;
    return realFetch(input, init);
  };

  console.log(`USCIS sandbox test plan — mode: ${mock ? 'MOCK (dry run, no USCIS calls)' : 'LIVE sandbox'}`);
  console.log(`Throttle: ${THROTTLE_MS}ms between requests, sequential.\n`);

  const rows = [];
  let first = true;
  for (const tc of MATRIX) {
    if (!first) await delay(THROTTLE_MS);
    first = false;

    let res;
    try {
      res = await callWorker(workerEnv, tc.receipt);
    } catch (err) {
      rows.push({ ...tc, got: 'ERR', pass: false, detail: '', notes: [`worker threw: ${err?.name ?? 'Error'}`] });
      continue;
    }

    const got = res.status;
    let pass = got === tc.expect;
    let detail = '';
    const notes = [];

    if (got === 200 && tc.expect === 200) {
      const json = await res.json().catch(() => null);
      const cs = json?.case_status;
      if (!cs) {
        pass = false;
        notes.push('no case_status object');
      } else {
        const hist = Array.isArray(cs.hist_case_status) ? cs.hist_case_status : null;
        if (hist === null) {
          pass = false;
          notes.push('hist_case_status is not an array');
        } else {
          detail = `hist=${hist.length}`;
          if (tc.history === 'non-empty' && hist.length === 0) {
            pass = false;
            notes.push('expected non-empty history');
          }
          if (tc.history === 'empty' && hist.length > 0) {
            pass = false;
            notes.push('expected empty history');
          }
        }
        // Shape delta vs the API-1 mock — report, do not absorb.
        const extra = Object.keys(cs).filter((k) => !EXPECTED_CASE_FIELDS.includes(k));
        const missing = EXPECTED_CASE_FIELDS.filter((k) => !(k in cs));
        if (extra.length) notes.push(`SHAPE DELTA extra: ${extra.join(',')}`);
        if (missing.length) notes.push(`SHAPE DELTA missing: ${missing.join(',')}`);
      }
    } else if (got !== tc.expect && got === 503 && (tc.expect === 200 || tc.expect === 404)) {
      // The Worker maps upstream 401/5xx/timeout → 503, so 503 here is ambiguous:
      // a sandbox 502 outage (USCIS posted a notice), an expired token, or a
      // cred/subscription problem. Do NOT retry-storm; diagnose with the
      // lower-level scripts/test-uscis-sandbox.mjs (it surfaces the raw status).
      notes.push('UPSTREAM 503: possible sandbox 502 outage OR token/cred issue — run scripts/test-uscis-sandbox.mjs to see raw upstream status');
    }

    rows.push({ ...tc, got, pass, detail, notes });
  }

  globalThis.fetch = realFetch;

  console.log('');
  printTable(rows);

  // Token reuse evidence.
  if (mock) {
    console.log(`\nToken fetches this run: 0 (mock mode makes no USCIS calls).`);
  } else {
    const ok = tokenFetches === 1;
    console.log(`\nToken fetches this run: ${tokenFetches} (expected 1 — single in-memory token reused). ${ok ? 'PASS' : 'CHECK'}`);
    if (tokenFetches > 1) console.log('  Note: >1 means the token cache is NOT being reused across calls.');
    if (tokenFetches === 0) console.log('  Note: 0 means no live call reached USCIS (all rejected locally?).');
  }

  // Coverage: the production-access gate requires BOTH 200 and 4xx demonstrably
  // tested. Confirm at least one PASS in each class.
  const classesNeeded = ['hist', 'nohist', '404', '422'];
  const covered = classesNeeded.filter((k) => rows.some((r) => r.klass === k && r.pass));
  const missingClasses = classesNeeded.filter((k) => !covered.includes(k));
  console.log(`\nClass coverage (passing): ${covered.join(', ') || '(none)'}`);
  if (missingClasses.length) console.log(`Missing class coverage: ${missingClasses.join(', ')}`);

  const failures = rows.filter((r) => !r.pass);
  console.log(`\n${rows.length - failures.length}/${rows.length} checks passed.`);

  const tokenProblem = !mock && tokenFetches !== 1;
  if (failures.length || missingClasses.length || tokenProblem) {
    console.log('RESULT: FAIL');
    process.exitCode = 1;
  } else {
    console.log('RESULT: ALL PASS');
  }
}

main().catch((err) => {
  // err message is built from our own code — never includes secrets/tokens/receipts.
  console.error(`\nFatal: ${err?.message ?? err}`);
  process.exit(1);
});
