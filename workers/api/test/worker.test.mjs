// Direct handler tests for the Worker — no `wrangler dev` process required.
// We import the Worker module and invoke its fetch() handler with synthetic
// Request objects. Run: node test/worker.test.mjs (Node 23.6+ strips TS types).
//
// No real receipt numbers are used — only the OFFICIAL USCIS sandbox samples and
// synthetic invalid inputs.

import assert from 'node:assert/strict';
import worker from '../src/index.ts';

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

await check('MOCK: EAC9999103400 → 200 case_status EMPTY history', async () => {
  const res = await call('POST', '/case-status', { body: { receiptNumber: 'EAC9999103400' } });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.ok(json.case_status);
  assert.equal(json.case_status.hist_case_status.length, 0);
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

console.log(`\nworker.test.mjs: ${passed} passed`);
