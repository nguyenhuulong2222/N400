// Unit tests for the OAuth token manager (auth.ts) — NO network, NO real creds.
// global.fetch is stubbed so we can count token-endpoint requests and assert the
// in-memory cache reuses the token until it nears expiry, then refreshes.
// Run: node test/auth.test.mjs (Node 23.6+ strips the TS types on import).

import assert from 'node:assert/strict';
import { getAccessToken, __resetTokenCache, TokenError } from '../src/auth.ts';

const ENV = {
  USCIS_CLIENT_ID: 'test-id',
  USCIS_CLIENT_SECRET: 'test-secret',
  USCIS_TOKEN_URL: 'https://token.example/oauth/accesstoken',
};

const realFetch = globalThis.fetch;
let tokenCalls = 0;

// Stub the token endpoint. `expiresIn` drives the cache TTL; `status` lets us
// simulate a rejected token request. Never echoes credentials.
function stubToken({ expiresIn = 3600, status = 200, token = 'tok-abc' } = {}) {
  tokenCalls = 0;
  globalThis.fetch = async () => {
    tokenCalls++;
    if (status !== 200) return new Response('upstream said no', { status });
    return new Response(JSON.stringify({ access_token: token, expires_in: expiresIn }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
}

let passed = 0;
async function check(name, fn) {
  await fn();
  passed++;
  console.log(`  ok - ${name}`);
}

console.log('auth.getAccessToken:');

await check('fetches once, then REUSES the cached token across calls', async () => {
  __resetTokenCache();
  stubToken({ expiresIn: 3600, token: 'tok-reuse' });
  const a = await getAccessToken(ENV);
  const b = await getAccessToken(ENV);
  const c = await getAccessToken(ENV);
  assert.equal(a, 'tok-reuse');
  assert.equal(b, 'tok-reuse');
  assert.equal(c, 'tok-reuse');
  assert.equal(tokenCalls, 1, 'token endpoint should be hit exactly once');
});

await check('REFRESHES when the cached token is within the safety window of expiry', async () => {
  __resetTokenCache();
  // expires_in 30s → expiresAt = now + 30s - 60s safety window → already past →
  // every call must refetch.
  stubToken({ expiresIn: 30 });
  await getAccessToken(ENV);
  await getAccessToken(ENV);
  await getAccessToken(ENV);
  assert.equal(tokenCalls, 3, 'near-expiry token should be refetched each call');
});

await check('missing credentials → TokenError (no fetch attempted)', async () => {
  __resetTokenCache();
  stubToken();
  await assert.rejects(
    () => getAccessToken({ USCIS_TOKEN_URL: ENV.USCIS_TOKEN_URL }),
    (err) => err instanceof TokenError,
  );
  assert.equal(tokenCalls, 0, 'should not call the token endpoint without creds');
});

await check('non-OK token response → TokenError carrying upstream status', async () => {
  __resetTokenCache();
  stubToken({ status: 401 });
  await assert.rejects(
    () => getAccessToken(ENV),
    (err) => err instanceof TokenError && err.status === 401,
  );
});

globalThis.fetch = realFetch;
console.log(`\nauth.test.mjs: ${passed} passed`);
