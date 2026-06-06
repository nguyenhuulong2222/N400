// Unit tests for the pure receipt classifier.
// Run: node test/receipt.test.mjs   (Node 23.6+ strips the TS types on import)
//
// No real receipt numbers are used — all inputs are synthetic samples.

import assert from 'node:assert/strict';
import { classifyReceipt } from '../src/receipt.ts';

let passed = 0;
function check(name, fn) {
  fn();
  passed++;
  console.log(`  ok - ${name}`);
}

console.log('classifyReceipt:');

check('null → empty', () => {
  assert.deepEqual(classifyReceipt(null), { state: 'empty', prefixKnown: false });
});

check('"" → empty', () => {
  assert.deepEqual(classifyReceipt(''), { state: 'empty', prefixKnown: false });
});

check('"   " → empty', () => {
  assert.deepEqual(classifyReceipt('   '), { state: 'empty', prefixKnown: false });
});

check('"IOE123" → invalid', () => {
  assert.deepEqual(classifyReceipt('IOE123'), { state: 'invalid', prefixKnown: false });
});

check('"IOE1234567890" → valid + prefixKnown true', () => {
  assert.deepEqual(classifyReceipt('IOE1234567890'), { state: 'valid', prefixKnown: true });
});

check('"ioe-1234567890" → valid + prefixKnown true (normalized)', () => {
  assert.deepEqual(classifyReceipt('ioe-1234567890'), { state: 'valid', prefixKnown: true });
});

check('"IOE 1234 5678 90" → valid + prefixKnown true (spaces stripped)', () => {
  assert.deepEqual(classifyReceipt('IOE 1234 5678 90'), { state: 'valid', prefixKnown: true });
});

check('"ABC1234567890" → warn + prefixKnown false (unknown prefix)', () => {
  assert.deepEqual(classifyReceipt('ABC1234567890'), { state: 'warn', prefixKnown: false });
});

check('return object NEVER includes the receipt number', () => {
  const result = classifyReceipt('IOE1234567890');
  assert.deepEqual(Object.keys(result).sort(), ['prefixKnown', 'state']);
  const serialized = JSON.stringify(result);
  assert.ok(!serialized.includes('IOE1234567890'), 'full receipt leaked');
  assert.ok(!serialized.includes('1234567890'), 'receipt digits leaked');
});

console.log(`\nreceipt.test.mjs: ${passed} passed`);
