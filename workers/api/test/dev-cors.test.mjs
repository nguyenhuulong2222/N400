// CORS check against a REAL `wrangler dev` server.
//
// The unit tests in worker.test.mjs decide "local" by omitting CF-Ray from a
// synthetic Request. That encodes an assumption: that `wrangler dev` really
// does not send CF-Ray. This file proves it, because the assumption is exactly
// what went wrong before — the rule used to key on the request hostname, every
// synthetic test passed, and the real dev server refused the local origin
// because wrangler rewrites request.url to the custom-domain route.
//
// Not part of `npm test`: it spawns a binary, takes about half a minute, and
// needs a free port. Run it with `npm run test:dev-cors`, and before a demo.

import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const CWD = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT ?? 8794);
const BASE = `http://localhost:${PORT}`;
const READY_TIMEOUT_MS = 60_000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let log = '';
const child = spawn(
  'npx',
  ['wrangler', 'dev', '--var', 'MOCK_MODE:1', '--port', String(PORT), '--ip', '127.0.0.1'],
  { cwd: CWD, stdio: ['ignore', 'pipe', 'pipe'] },
);
child.stdout.on('data', (d) => (log += d));
child.stderr.on('data', (d) => (log += d));

function stop(code) {
  child.kill('SIGTERM');
  setTimeout(() => process.exit(code), 1200);
}

// Poll /health rather than sleeping a fixed time.
let ready = false;
const deadline = Date.now() + READY_TIMEOUT_MS;
while (Date.now() < deadline) {
  try {
    const res = await fetch(`${BASE}/health`);
    if (res.ok) {
      ready = true;
      break;
    }
  } catch {
    /* not up yet */
  }
  await sleep(1000);
}
if (!ready) {
  console.error(`wrangler dev did not become ready on ${BASE} within ${READY_TIMEOUT_MS / 1000}s`);
  console.error('--- server output (tail) ---\n' + log.slice(-1500));
  stop(1);
}

console.log(`dev-cors: wrangler dev ready on ${BASE}`);

async function acao(origin) {
  const res = await fetch(`${BASE}/case-status`, {
    method: 'OPTIONS',
    headers: { Origin: origin },
  });
  return res.headers.get('access-control-allow-origin');
}

let passed = 0;
const failures = [];
async function check(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ok - ${name}`);
  } catch (err) {
    failures.push(`${name}: ${err.message}`);
    console.log(`  NOT OK - ${name}`);
    console.log(`           ${err.message}`);
  }
}

await check('the local preview origin is allowed by a local dev server', async () => {
  assert.equal(
    await acao('http://localhost:8765'),
    'http://localhost:8765',
    'this is the demo path: a page on :8765 talking to the Worker on :8787',
  );
});

await check('a production origin is allowed', async () => {
  assert.equal(await acao('https://formn400.org'), 'https://formn400.org');
  assert.equal(await acao('https://www.formn400.org'), 'https://www.formn400.org');
});

await check('the removed wrangler-dev origins are refused', async () => {
  assert.equal(await acao('http://localhost:8787'), null);
  assert.equal(await acao('http://127.0.0.1:8787'), null);
});

await check('an unknown origin is refused', async () => {
  assert.equal(await acao('https://evil.example'), null);
});

await check('a request with no Origin gets no ACAO and still answers', async () => {
  const res = await fetch(`${BASE}/case-status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ receiptNumber: 'EAC9999103403' }),
  });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('access-control-allow-origin'), null);
});

console.log(`\ndev-cors.test.mjs: ${passed} passed, ${failures.length} failed`);
stop(failures.length === 0 ? 0 : 1);
