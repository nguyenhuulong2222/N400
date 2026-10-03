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

// ─── C2: upstream error passthrough ───────────────────────────────────
// A capable stub: counts token fetches and returns a scripted sequence of
// upstream case-status responses, so a test can prove the token cache was
// dropped between two calls.
async function withUpstream(responses, fn) {
  const realFetch = globalThis.fetch;
  const counts = { token: 0, caseStatus: 0 };
  const queue = Array.isArray(responses) ? [...responses] : [responses];
  globalThis.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url.includes('/oauth/')) {
      counts.token++;
      return { ok: true, status: 200, async json() { return { access_token: 'T', expires_in: 3600 }; } };
    }
    counts.caseStatus++;
    const next = queue.length > 1 ? queue.shift() : queue[0];
    if (typeof next === 'function') return next(init);
    return next;
  };
  __resetTokenCache();
  try {
    return await fn(counts);
  } finally {
    globalThis.fetch = realFetch;
    __resetTokenCache();
  }
}

// The shape the PUBLISHED spec documents: flat { code, message }. Tested first
// because it is what we will actually receive.
const upstreamFlat = (status, message) => ({
  status,
  async text() { return JSON.stringify({ code: status, message }); },
});

for (const [status, message] of [
  [401, 'Invalid Access Token'],
  [404, 'Case Status Online does not recognize the receipt number entered.'],
  [422, 'The application receipt number is not formatted correctly'],
  [429, 'Spike Arrest Violation'],
  [500, 'Internal Server Error'],
  [503, 'Service Unavailable'],
]) {
  await check(`LIVE: upstream ${status} (flat shape) → ${status} passthrough w/ USCIS message`, async () => {
    await withUpstream(upstreamFlat(status, message), async () => {
      const res = await liveCaseStatusCall();
      assert.equal(res.status, status, 'upstream status must be preserved, not collapsed to 503');
      const json = await res.json();
      assert.equal(json.ok, false);
      assert.equal(json.status, status);
      assert.equal(json.source, 'uscis');
      assert.equal(json.errors.length, 1, 'flat body must normalise to one errors[] item');
      assert.equal(json.errors[0].message, message, 'the USCIS message must reach the client verbatim');
      assert.equal(json.errors[0].code, status);
      // Backward compatibility with the already-deployed frontend.
      assert.equal(typeof json.error, 'string');
      assert.equal(typeof json.message, 'string');
    });
  });
}

await check('LIVE: upstream errors[] array shape → whitelisted fields only', async () => {
  const body = {
    errors: [
      {
        code: 'BAD_REQUEST', message: 'Rejected', category: 'VALIDATION',
        reference: 'ref-1', status: '400', traceId: 'trace-1',
        // None of these may survive.
        stackTrace: 'at foo()', internal: { secret: 'x' }, extras: [1, 2],
      },
    ],
  };
  await withUpstream({ status: 400, async text() { return JSON.stringify(body); } }, async () => {
    const res = await liveCaseStatusCall();
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.equal(json.errors.length, 1);
    const keys = Object.keys(json.errors[0]).sort();
    assert.deepEqual(keys, ['category', 'code', 'message', 'reference', 'status', 'traceId']);
    const text = JSON.stringify(json);
    assert.ok(!text.includes('stackTrace'), 'non-whitelisted field leaked');
    assert.ok(!text.includes('secret'), 'nested object leaked');
  });
});

await check('LIVE: receipt-shaped token in an upstream message is MASKED', async () => {
  const msg = 'No case for EAC9999103403 or for ABC*123456789 right now';
  await withUpstream(upstreamFlat(404, msg), async () => {
    const res = await liveCaseStatusCall();
    const text = await res.text();
    assert.ok(text.includes('EAC*******403'), 'standard receipt not masked');
    assert.ok(text.includes('ABC*******789'), 'star-form receipt not masked');
    assert.ok(!text.includes('EAC9999103403'), 'unmasked receipt leaked');
    assert.ok(!text.includes('ABC*123456789'), 'unmasked star-form receipt leaked');
  });
});

await check('LIVE: non-JSON upstream error body → errors:[] plus our fallback', async () => {
  const html = '<html><body><h1>502 Bad Gateway</h1></body></html>';
  await withUpstream({ status: 502, async text() { return html; } }, async () => {
    const res = await liveCaseStatusCall();
    assert.equal(res.status, 502);
    const json = await res.json();
    assert.deepEqual(json.errors, []);
    assert.equal(json.source, 'uscis');
    assert.ok(json.message.length > 0, 'fallback message required');
    const text = JSON.stringify(json);
    assert.ok(!text.includes('Bad Gateway'), 'raw upstream body leaked');
  });
});

await check('LIVE: upstream 401 clears the cached token (next call re-auths)', async () => {
  await withUpstream([upstreamFlat(401, 'Invalid Access Token'), upstreamFlat(401, 'Invalid Access Token')], async (counts) => {
    const first = await liveCaseStatusCall();
    assert.equal(first.status, 401);
    assert.equal(counts.token, 1, 'first call fetches a token');
    await liveCaseStatusCall();
    assert.equal(counts.token, 2, 'a 401 must invalidate the cache so the next call re-auths');
  });
});

await check('LIVE: upstream 404 does NOT clear the cached token', async () => {
  await withUpstream(upstreamFlat(404, 'nope'), async (counts) => {
    await liveCaseStatusCall();
    await liveCaseStatusCall();
    assert.equal(counts.token, 1, 'token must still be reused after a non-401');
  });
});

await check('LIVE: upstream timeout → 504 UPSTREAM_TIMEOUT source:worker', async () => {
  const timeout = () => {
    const e = new Error('timed out');
    e.name = 'TimeoutError';
    throw e;
  };
  await withUpstream(timeout, async () => {
    const res = await liveCaseStatusCall();
    assert.equal(res.status, 504);
    const json = await res.json();
    assert.equal(json.source, 'worker');
    assert.equal(json.errors[0].code, 'UPSTREAM_TIMEOUT');
  });
});

await check('LIVE: token endpoint 401 → client 401 USCIS_AUTH_FAILED, body never read', async () => {
  const realFetch = globalThis.fetch;
  let tokenBodyRead = false;
  globalThis.fetch = async (input) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url.includes('/oauth/')) {
      return {
        ok: false, status: 401,
        async json() { tokenBodyRead = true; return { error: 'invalid_client' }; },
        async text() { tokenBodyRead = true; return 'invalid_client'; },
      };
    }
    throw new Error('case-status must not be called when the token fails');
  };
  __resetTokenCache();
  try {
    const res = await liveCaseStatusCall();
    assert.equal(res.status, 401);
    const json = await res.json();
    assert.equal(json.source, 'worker');
    assert.equal(json.errors[0].code, 'USCIS_AUTH_FAILED');
    assert.equal(tokenBodyRead, false, 'the token response body must NEVER be read');
  } finally {
    globalThis.fetch = realFetch;
    __resetTokenCache();
  }
});

await check('worker-originated 422 uses the shared envelope', async () => {
  const res = await call('POST', '/case-status', { body: { receiptNumber: 'IOE123' } });
  const json = await res.json();
  assert.equal(json.source, 'worker');
  assert.equal(json.status, 422);
  assert.equal(json.errors[0].code, 'INVALID_RECEIPT_FORMAT');
  assert.equal(json.errors[0].status, '422');
  assert.equal(json.error, 'invalid_receipt_format', 'legacy field kept for the deployed frontend');
});

// ─── C3: rate limiting ────────────────────────────────────────────────
function limiterEnv(behaviour) {
  return {
    ...MOCK_ENV,
    CASE_STATUS_LIMITER: {
      limit: async ({ key }) => {
        limiterEnv.lastKey = key;
        if (behaviour === 'throw') throw new Error('limiter down');
        return { success: behaviour === 'allow' };
      },
    },
  };
}

await check('RATE LIMIT: over the limit → 429 RATE_LIMITED source:worker', async () => {
  const res = await call('POST', '/case-status', {
    env: limiterEnv('deny'),
    body: { receiptNumber: 'EAC9999103403' },
  });
  assert.equal(res.status, 429);
  const json = await res.json();
  assert.equal(json.source, 'worker', 'must be distinguishable from a USCIS 429');
  assert.equal(json.errors[0].code, 'RATE_LIMITED');
  assert.equal(json.error, 'rate_limited');
});

await check('RATE LIMIT: under the limit → request proceeds', async () => {
  const res = await call('POST', '/case-status', {
    env: limiterEnv('allow'),
    body: { receiptNumber: 'EAC9999103403' },
  });
  assert.equal(res.status, 200);
});

await check('RATE LIMIT: keyed on CF-Connecting-IP, never the receipt', async () => {
  const env = limiterEnv('allow');
  const res = await worker.fetch(
    new Request('https://api.local/case-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.7' },
      body: JSON.stringify({ receiptNumber: 'EAC9999103403' }),
    }),
    env,
  );
  assert.equal(res.status, 200);
  assert.equal(limiterEnv.lastKey, '203.0.113.7');
  assert.ok(!String(limiterEnv.lastKey).includes('9999103403'), 'receipt must never be a limiter key');
});

await check('RATE LIMIT: no header → key "unknown"', async () => {
  await call('POST', '/case-status', { env: limiterEnv('allow'), body: { receiptNumber: 'EAC9999103403' } });
  assert.equal(limiterEnv.lastKey, 'unknown');
});

await check('RATE LIMIT: binding absent → never crashes, request proceeds', async () => {
  const res = await call('POST', '/case-status', { body: { receiptNumber: 'EAC9999103403' } });
  assert.equal(res.status, 200);
});

await check('RATE LIMIT: limiter throws → fails OPEN', async () => {
  const res = await call('POST', '/case-status', {
    env: limiterEnv('throw'),
    body: { receiptNumber: 'EAC9999103403' },
  });
  assert.equal(res.status, 200);
});

// ─── C4: reserved MOCK_MODE demo receipts ─────────────────────────────
for (const [receipt, status, fragment] of [
  ['MCK0000000401', 401, 'Invalid Access Token'],
  ['MCK0000000404', 404, 'does not recognize the receipt number'],
  ['MCK0000000429', 429, 'Spike Arrest Violation'],
  ['MCK0000000503', 503, 'The Case Status API Sandbox is unavailable at this time'],
  ['MCK0000000500', 500, 'Internal Server Error'],
]) {
  await check(`MOCK: ${receipt} → ${status} with the USCIS-shaped message`, async () => {
    const res = await call('POST', '/case-status', { body: { receiptNumber: receipt } });
    assert.equal(res.status, status);
    const json = await res.json();
    assert.equal(json.source, 'uscis');
    assert.equal(json.errors.length, 1);
    assert.ok(json.errors[0].message.includes(fragment));
    assert.ok(json.errors[0].message.includes('(Mock — simulated USCIS error)'));
  });
}

await check('MOCK: MCK0000009457 → errors[] shape, receipt masked', async () => {
  const res = await call('POST', '/case-status', { body: { receiptNumber: 'MCK0000009457' } });
  assert.equal(res.status, 400);
  const text = await res.text();
  assert.ok(text.includes('EAC*******403'), 'receipt in the mock message must be masked');
  assert.ok(!text.includes('EAC9999103403'));
  const json = JSON.parse(text);
  assert.equal(json.errors[0].traceId, 'mock-trace-0001');
  assert.equal(json.errors[0].category, 'VALIDATION');
});

await check('MOCK: generic miss → 404 carrying the documented USCIS message', async () => {
  const res = await call('POST', '/case-status', { body: { receiptNumber: 'EAC0000000000' } });
  assert.equal(res.status, 404);
  const json = await res.json();
  assert.equal(json.error, 'case_not_found');
  assert.ok(json.errors[0].message.includes('does not recognize the receipt number'));
});

await check('MOCK: history items use the spec field name completed_text_en', async () => {
  const res = await call('POST', '/case-status', { body: { receiptNumber: 'EAC9999103403' } });
  const hist = (await res.json()).case_status.hist_case_status;
  assert.ok(Array.isArray(hist) && hist.length > 0);
  assert.equal(typeof hist[0].date, 'string');
  assert.equal(typeof hist[0].completed_text_en, 'string');
  assert.equal(hist[0].current_case_status_text_en, undefined, 'the invented field name must be gone');
});

// ─── The third error shape: {"error":{…}} ─────────────────────────────
// Regression for a PRODUCTION failure. The deployed normaliser accepted the
// spec's flat shape and the Torch RFC 9457 array, and the first real error body
// we ever received matched neither — so errors[] came back empty and the USCIS
// sentence was replaced by our own fallback.
//
// This is the exact body, captured 2026-10-03 09:34 UTC by direct curl against
// the closed sandbox. The leading newlines and spaces are part of what USCIS
// sent and are kept deliberately: they are NOT the cause of the bug (JSON.parse
// accepts leading whitespace, and the trimmed body failed identically), so this
// fixture proves both that the shape is handled and that the whitespace never
// mattered.
const REAL_503_MESSAGE =
  'The Case Status API Sandbox is unavailable at this time. ' +
  'Please retry your API request during normal operation hours M-F 7:00AM EST - 8:00 PM EST';
const REAL_503_BODY = '\n\n  {"error":{"code":"503","message":"' + REAL_503_MESSAGE + '"}}';

await check('LIVE: real sandbox 503 — {"error":{…}} + leading whitespace → USCIS message passed through', async () => {
  await withUpstream({ status: 503, async text() { return REAL_503_BODY; } }, async () => {
    const res = await liveCaseStatusCall();
    assert.equal(res.status, 503);
    const json = await res.json();
    assert.equal(json.source, 'uscis');
    assert.equal(json.errors.length, 1, 'the wrapped error object must normalise to one item');
    assert.equal(json.errors[0].message, REAL_503_MESSAGE);
    assert.equal(json.errors[0].code, '503', 'code is a STRING in this shape, not an int');
  });
});

await check('LIVE: the same body trimmed behaves identically (whitespace was never the cause)', async () => {
  await withUpstream({ status: 503, async text() { return REAL_503_BODY.trim(); } }, async () => {
    const json = await (await liveCaseStatusCall()).json();
    assert.equal(json.errors[0].message, REAL_503_MESSAGE);
  });
});

for (const [status, message] of [
  [401, 'Invalid Access Token'],
  [429, 'Spike Arrest Violation'],
]) {
  await check(`LIVE: upstream ${status} in the {"error":{…}} shape → ${status} w/ USCIS message`, async () => {
    const body = JSON.stringify({ error: { code: String(status), message } });
    await withUpstream({ status, async text() { return body; } }, async () => {
      const res = await liveCaseStatusCall();
      assert.equal(res.status, status);
      const json = await res.json();
      assert.equal(json.source, 'uscis');
      assert.equal(json.errors.length, 1);
      assert.equal(json.errors[0].message, message);
      assert.equal(json.errors[0].code, String(status));
    });
  });
}

await check('LIVE: {"error":[ … ]} array variant → items normalised, whitelist enforced', async () => {
  const body = JSON.stringify({
    error: [
      { code: '503', message: 'First', traceId: 't-1', stackTrace: 'at foo()' },
      { code: '503', message: 'Second' },
    ],
  });
  await withUpstream({ status: 503, async text() { return body; } }, async () => {
    const res = await liveCaseStatusCall();
    const text = await res.text();
    const json = JSON.parse(text);
    assert.equal(json.errors.length, 2);
    assert.equal(json.errors[0].traceId, 't-1');
    assert.ok(!text.includes('stackTrace'), 'non-whitelisted field leaked');
  });
});

// Shape 4 — defensive, never observed from USCIS. An OAuth-style string body.
await check('LIVE: {"error":"<string>"} → string becomes the message, no code invented', async () => {
  const body = JSON.stringify({ error: 'invalid_token' });
  await withUpstream({ status: 401, async text() { return body; } }, async () => {
    const res = await liveCaseStatusCall();
    assert.equal(res.status, 401);
    const json = await res.json();
    assert.equal(json.source, 'uscis');
    assert.equal(json.errors.length, 1);
    assert.equal(json.errors[0].message, 'invalid_token');
    assert.equal(json.errors[0].code, undefined, 'no code may be fabricated for a bare string');
  });
});

await check('LIVE: {"error":""} and {"error":"   "} stay unrecognised → errors:[]', async () => {
  for (const v of ['', '   ']) {
    const body = JSON.stringify({ error: v });
    await withUpstream({ status: 503, async text() { return body; } }, async () => {
      const json = await (await liveCaseStatusCall()).json();
      assert.deepEqual(json.errors, [], `empty error string ${JSON.stringify(v)} must not produce an item`);
      assert.ok(json.message.length > 0, 'our fallback must still be present');
    });
  }
});

await check('LIVE: masking applies on the {"error":{…}} branch too', async () => {
  const body = JSON.stringify({ error: { code: '404', message: 'No case for EAC9999103403' } });
  await withUpstream({ status: 404, async text() { return body; } }, async () => {
    const text = await (await liveCaseStatusCall()).text();
    assert.ok(text.includes('EAC*******403'));
    assert.ok(!text.includes('EAC9999103403'));
  });
});

await check('LIVE: masking applies on the {"error":"<string>"} branch too', async () => {
  const body = JSON.stringify({ error: 'Rejected for EAC9999103403' });
  await withUpstream({ status: 400, async text() { return body; } }, async () => {
    const text = await (await liveCaseStatusCall()).text();
    assert.ok(text.includes('EAC*******403'));
    assert.ok(!text.includes('EAC9999103403'));
  });
});

await check('MOCK: MCK0000000503 now returns the real captured sandbox body', async () => {
  const res = await call('POST', '/case-status', { body: { receiptNumber: 'MCK0000000503' } });
  assert.equal(res.status, 503);
  const json = await res.json();
  assert.equal(json.source, 'uscis');
  assert.equal(json.errors[0].code, '503');
  assert.ok(json.errors[0].message.startsWith('The Case Status API Sandbox is unavailable'));
  assert.ok(json.errors[0].message.includes('(Mock — simulated USCIS error)'));
});

console.log(`\nworker.test.mjs: ${passed} passed`);
