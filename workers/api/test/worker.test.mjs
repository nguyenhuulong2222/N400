// Direct handler tests for the Worker — no `wrangler dev` process required.
// We import the Worker module and invoke its fetch() handler with synthetic
// Request objects. Run: node test/worker.test.mjs (Node 23.6+ strips TS types).
//
// No real receipt numbers are used — all inputs are synthetic samples.

import assert from 'node:assert/strict';
import worker from '../src/index.ts';

const env = {}; // No secrets needed in API-1.

function call(method, path, { body, origin } = {}) {
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

await check('GET /health → 200 ok:true', async () => {
  const res = await call('GET', '/health');
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.ok, true);
  assert.equal(json.service, 'formn400-api');
});

await check('GET / → 200 ok:true', async () => {
  const res = await call('GET', '/');
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.ok, true);
  assert.equal(json.service, 'formn400-api');
});

await check('POST /case-status empty body (no JSON) → 400', async () => {
  const res = await call('POST', '/case-status');
  assert.equal(res.status, 400);
  const json = await res.json();
  assert.equal(json.error, 'invalid_receipt_format');
});

await check('POST /case-status invalid JSON → 400', async () => {
  const res = await call('POST', '/case-status', { body: '{not json' });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, 'invalid_receipt_format');
});

await check('POST /case-status missing receiptNumber → 400', async () => {
  const res = await call('POST', '/case-status', { body: {} });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, 'invalid_receipt_format');
});

await check('POST /case-status "IOE123" → 400 invalid_receipt_format', async () => {
  const res = await call('POST', '/case-status', { body: { receiptNumber: 'IOE123' } });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, 'invalid_receipt_format');
});

await check('POST /case-status valid known → 501 + prefixKnown true', async () => {
  const res = await call('POST', '/case-status', { body: { receiptNumber: 'IOE1234567890' } });
  assert.equal(res.status, 501);
  const json = await res.json();
  assert.equal(json.error, 'uscis_api_not_configured');
  assert.equal(json.prefixKnown, true);
  assert.equal(json.receiptFormat, 'valid');
});

await check('POST /case-status valid unknown → 501 + prefixKnown false', async () => {
  const res = await call('POST', '/case-status', { body: { receiptNumber: 'ABC1234567890' } });
  assert.equal(res.status, 501);
  const json = await res.json();
  assert.equal(json.error, 'uscis_api_not_configured');
  assert.equal(json.prefixKnown, false);
});

await check('response body NEVER includes the full receipt number', async () => {
  const res = await call('POST', '/case-status', { body: { receiptNumber: 'IOE1234567890' } });
  const text = await res.text();
  assert.ok(!text.includes('IOE1234567890'), 'full receipt leaked in response');
  assert.ok(!text.includes('1234567890'), 'receipt digits leaked in response');
});

await check('OPTIONS /case-status w/ allowed Origin → CORS headers echo Origin', async () => {
  const res = await call('OPTIONS', '/case-status', { origin: 'https://formn400.org' });
  assert.equal(res.status, 204);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'https://formn400.org');
  assert.equal(res.headers.get('Access-Control-Allow-Methods'), 'GET, POST, OPTIONS');
  assert.equal(res.headers.get('Access-Control-Allow-Headers'), 'Content-Type');
});

await check('OPTIONS /case-status w/ disallowed Origin → no ACAO header', async () => {
  const res = await call('OPTIONS', '/case-status', { origin: 'https://evil.example' });
  assert.equal(res.status, 204);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), null);
});

await check('POST /case-status with NO Origin (native mobile) → still returns JSON, no ACAO', async () => {
  const res = await call('POST', '/case-status', { body: { receiptNumber: 'IOE1234567890' } });
  assert.equal(res.status, 501);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), null);
  assert.equal(res.headers.get('Content-Type'), 'application/json');
  assert.equal((await res.json()).error, 'uscis_api_not_configured');
});

await check('unknown route → 404 not_found', async () => {
  const res = await call('GET', '/nope');
  assert.equal(res.status, 404);
  assert.equal((await res.json()).error, 'not_found');
});

console.log(`\nworker.test.mjs: ${passed} passed`);
