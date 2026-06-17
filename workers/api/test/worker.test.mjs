// Direct handler tests for the Worker — no `wrangler dev` process required.
// We import the Worker module and invoke its fetch() handler with synthetic
// Request objects. Run: node test/worker.test.mjs (Node 23.6+ strips TS types).
//
// No real receipt numbers are used — only the OFFICIAL USCIS sandbox samples and
// synthetic invalid inputs.

import assert from 'node:assert/strict';
import worker from '../src/index.ts';
import { __resetTokenCache } from '../src/auth.ts';

// MOCK_MODE on: the shell serves canned responses with no secrets (API-1).
const MOCK_ENV = { MOCK_MODE: '1' };
// Live path with no credentials configured — should fail safe to 503.
const LIVE_NO_CREDS_ENV = { MOCK_MODE: '0' };

function call(method, path, { body, origin, env = MOCK_ENV } = {}) {
  const headers = {};
  if (origin) headers['Origin'] = origin;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const init = { method, headers };
  if (body !== undefined) init.body = typeof body === 'string' ? body : JSON.stringify(body);
  return worker.fetch(new Request(`http://localhost:8787${path}`, init), env);
}

let passed = 0;
async function check(name, fn) {
  await fn();
  passed++;
  console.log(`  ok - ${name}`);
}

console.log('worker.fetch:');

await check('GET /health → 200 ok:true mock:true', async () => {
  const res = await call('GET', '/health');
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.ok, true);
  assert.equal(json.service, 'formn400-api');
  assert.equal(json.mock, true);
});

await check('GET / → 200 ok:true mock:true', async () => {
  const res = await call('GET', '/');
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.ok, true);
  assert.equal(json.mock, true);
});

await check('GET /health (live env) → mock:false', async () => {
  const res = await call('GET', '/health', { env: LIVE_NO_CREDS_ENV });
  assert.equal((await res.json()).mock, false);
});

await check('POST /case-status empty body (no JSON) → 422', async () => {
  const res = await call('POST', '/case-status');
  assert.equal(res.status, 422);
  assert.equal((await res.json()).error, 'invalid_receipt_format');
});

await check('POST /case-status invalid JSON → 422', async () => {
  const res = await call('POST', '/case-status', { body: '{not json' });
  assert.equal(res.status, 422);
  assert.equal((await res.json()).error, 'invalid_receipt_format');
});

await check('POST /case-status missing receiptNumber → 422', async () => {
  const res = await call('POST', '/case-status', { body: {} });
  assert.equal(res.status, 422);
  assert.equal((await res.json()).error, 'invalid_receipt_format');
});

await check('POST /case-status "IOE123" → 422 invalid_receipt_format', async () => {
  const res = await call('POST', '/case-status', { body: { receiptNumber: 'IOE123' } });
  assert.equal(res.status, 422);
  assert.equal((await res.json()).error, 'invalid_receipt_format');
});

await check('MOCK: EAC9999103403 → 200 case_status WITH history', async () => {
  const res = await call('POST', '/case-status', { body: { receiptNumber: 'EAC9999103403' } });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.ok(json.case_status, 'case_status present');
  assert.ok(Array.isArray(json.case_status.hist_case_status));
  assert.ok(json.case_status.hist_case_status.length > 0, 'history populated');
  assert.equal(json.case_status.formType, 'N400');
});

await check('MOCK: lowercase/hyphen normalized → 200 (eac-9999-103403)', async () => {
  const res = await call('POST', '/case-status', { body: { receiptNumber: 'eac-9999-103403' } });
  assert.equal(res.status, 200);
  assert.ok((await res.json()).case_status.hist_case_status.length > 0);
});

await check('MOCK: EAC9999103400 → 200 case_status NO history (hist null)', async () => {
  const res = await call('POST', '/case-status', { body: { receiptNumber: 'EAC9999103400' } });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.ok(json.case_status);
  // Live USCIS returns null (not []) for no-history cases — verified in API-2.
  assert.equal(json.case_status.hist_case_status, null);
  // Success envelope carries a top-level `message` mirroring upstream.
  assert.equal(typeof json.message, 'string');
});

await check('MOCK: valid format but not a known sandbox receipt → 404', async () => {
  const res = await call('POST', '/case-status', { body: { receiptNumber: 'EAC0000000000' } });
  assert.equal(res.status, 404);
  assert.equal((await res.json()).error, 'case_not_found');
});

await check('LIVE path with no credentials → 503 service_unavailable', async () => {
  const res = await call('POST', '/case-status', {
    env: LIVE_NO_CREDS_ENV,
    body: { receiptNumber: 'EAC9999103403' },
  });
  assert.equal(res.status, 503);
  assert.equal((await res.json()).error, 'service_unavailable');
});

await check('error response NEVER includes the receipt number', async () => {
  // Use a never-mocked valid receipt so the response is a 404 envelope (not a
  // 200 passthrough that legitimately echoes the sandbox sample).
  const res = await call('POST', '/case-status', { body: { receiptNumber: 'WAC1234567890' } });
  const text = await res.text();
  assert.ok(!text.includes('WAC1234567890'), 'full receipt leaked in response');
  assert.ok(!text.includes('1234567890'), 'receipt digits leaked in response');
});

await check('OPTIONS /case-status w/ allowed Origin → CORS headers echo Origin', async () => {
  const res = await call('OPTIONS', '/case-status', { origin: 'https://formn400.org' });
  assert.equal(res.status, 204);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'https://formn400.org');
  assert.equal(res.headers.get('Access-Control-Allow-Methods'), 'GET, POST, OPTIONS');
  assert.equal(res.headers.get('Access-Control-Allow-Headers'), 'Authorization, Content-Type');
});

await check('OPTIONS /case-status w/ disallowed Origin → no ACAO header', async () => {
  const res = await call('OPTIONS', '/case-status', { origin: 'https://evil.example' });
  assert.equal(res.status, 204);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), null);
});

await check('POST /case-status with NO Origin (native mobile) → still returns JSON, no ACAO', async () => {
  const res = await call('POST', '/case-status', { body: { receiptNumber: 'EAC9999103403' } });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), null);
  assert.equal(res.headers.get('Content-Type'), 'application/json');
});

await check('unknown route → 404 not_found', async () => {
  const res = await call('GET', '/nope');
  assert.equal(res.status, 404);
  assert.equal((await res.json()).error, 'not_found');
});

// --- Live-path: drive worker.fetch through the real upstream call with a
// stubbed global fetch (token + case-status). LIVE_ENV has dummy creds; the
// stub returns canned upstream Responses so no network/credential is touched.
const LIVE_ENV = {
  MOCK_MODE: '0',
  USCIS_CLIENT_ID: 'id',
  USCIS_CLIENT_SECRET: 'secret',
  USCIS_BASE_URL: 'https://api-int.uscis.gov/case-status',
  USCIS_TOKEN_URL: 'https://api-int.uscis.gov/oauth/accesstoken',
};

// Run worker.fetch with a stubbed global fetch: token endpoint → access token,
// case-status endpoint → the provided upstream Response-like object.
async function withStubbedUpstream(caseResponse, fn) {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url.includes('/oauth/')) {
      return { ok: true, status: 200, async json() { return { access_token: 'T', expires_in: 3600 }; } };
    }
    return caseResponse;
  };
  __resetTokenCache();
  try {
    return await fn();
  } finally {
    globalThis.fetch = realFetch;
    __resetTokenCache();
  }
}

function liveCaseStatusCall(receipt = 'EAC9999103400') {
  return worker.fetch(
    new Request('https://api.local/case-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ receiptNumber: receipt }),
    }),
    LIVE_ENV,
  );
}

// Regression for the REAL API-2 defect: USCIS sandbox returns HTTP 200 with a
// body that is syntactically INVALID JSON (~38% of staging receipts). Here the
// `current_case_status_desc_en` anchor has an unescaped `"` mid-string, so the
// string terminates early and JSON.parse fails — modeling the real upstream
// defect. The bytes are plain ASCII (NOT an encoding problem). The Worker must
// return a distinct 502 upstream_unparseable, never 503, never 200, and must
// never echo the raw malformed body.
await check('LIVE: malformed upstream 200 (invalid JSON) → 502 upstream_unparseable, no raw body', async () => {
  // Unescaped inner quotes in the href break the JSON string mid-value.
  const MALFORMED_BODY =
    '{"message":"Successfully retrieved case status","case_status":{' +
    '"receiptNumber":"EAC9999103400","formType":"N400",' +
    '"current_case_status_text_en":"Case Was Received",' +
    '"current_case_status_desc_en":"See <a href="https://egov.uscis.gov">status</a> for details.",' +
    '"hist_case_status":null}}';
  const caseResponse = { status: 200, async text() { return MALFORMED_BODY; } };
  await withStubbedUpstream(caseResponse, async () => {
    const res = await liveCaseStatusCall();
    assert.equal(res.status, 502, 'malformed upstream 200 must map to 502, not 503/200');
    const text = await res.text();
    const json = JSON.parse(text);
    assert.equal(json.error, 'upstream_unparseable');
    assert.equal(json.ok, false);
    // The raw malformed body must NOT leak into our response.
    assert.ok(!text.includes('egov.uscis.gov/status'), 'raw upstream fragment leaked');
    assert.ok(!text.includes('current_case_status_desc_en'), 'raw upstream field leaked');
  });
});

// A VALID upstream 200 still passes through as 200 (content forwarded verbatim).
await check('LIVE: valid upstream 200 → 200 passthrough', async () => {
  const VALID_BODY = JSON.stringify({
    message: 'Successfully retrieved case status',
    case_status: {
      receiptNumber: 'EAC9999103400',
      formType: 'N400',
      current_case_status_text_en: 'Case Was Received',
      hist_case_status: null,
    },
  });
  const caseResponse = { status: 200, async text() { return VALID_BODY; } };
  await withStubbedUpstream(caseResponse, async () => {
    const res = await liveCaseStatusCall();
    assert.equal(res.status, 200, 'valid upstream 200 must pass through');
    const json = await res.json();
    assert.equal(json.case_status.current_case_status_text_en, 'Case Was Received');
    assert.equal(json.case_status.hist_case_status, null);
  });
});

console.log(`\nworker.test.mjs: ${passed} passed`);
