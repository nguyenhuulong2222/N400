// GlobalQuotaGuard unit tests — the Durable Object class driven with a fake
// state, no workerd. Run: node test/globalGuard.test.mjs

import assert from 'node:assert/strict';
import { GlobalQuotaGuard, PER_SECOND_LIMIT, PER_DAY_LIMIT } from '../src/globalGuard.ts';

function fakeState(saved) {
  const store = new Map(saved ? [['day', saved]] : []);
  return {
    store,
    storage: {
      async get(k) { return store.get(k); },
      async put(k, v) { store.set(k, v); },
    },
    async blockConcurrencyWhile(fn) { return fn(); },
  };
}

let passed = 0;
async function check(name, fn) {
  await fn();
  passed++;
  console.log(`  ok - ${name}`);
}

console.log('GlobalQuotaGuard:');

const T0 = Date.UTC(2026, 9, 26, 12, 0, 0);

await check(`allows ${PER_SECOND_LIMIT} per second, denies the next`, async () => {
  const g = new GlobalQuotaGuard(fakeState(), {});
  for (let i = 0; i < PER_SECOND_LIMIT; i++) assert.equal(g.tryAcquire(T0 + i), true);
  assert.equal(g.tryAcquire(T0 + 999), false);
});

await check('a new second resets the per-second window', async () => {
  const g = new GlobalQuotaGuard(fakeState(), {});
  for (let i = 0; i < PER_SECOND_LIMIT; i++) g.tryAcquire(T0);
  assert.equal(g.tryAcquire(T0 + 1000), true);
});

await check('denies once the day count reaches the daily limit', async () => {
  const g = new GlobalQuotaGuard(fakeState({ day: '2026-10-26', count: PER_DAY_LIMIT }), {});
  await Promise.resolve();
  assert.equal(g.tryAcquire(T0), false);
});

await check('a new UTC day resets the daily count', async () => {
  const g = new GlobalQuotaGuard(fakeState({ day: '2026-10-25', count: PER_DAY_LIMIT }), {});
  await Promise.resolve();
  assert.equal(g.tryAcquire(T0), true);
});

await check('fetch() answers { allowed } and saves the day count every 100', async () => {
  const state = fakeState({ day: new Date().toISOString().slice(0, 10), count: 99 });
  const g = new GlobalQuotaGuard(state, {});
  await Promise.resolve();
  const res = await g.fetch();
  assert.deepEqual(await res.json(), { allowed: true });
  assert.equal(state.store.get('day').count, 100);
});

console.log(`\n${passed} passed`);
