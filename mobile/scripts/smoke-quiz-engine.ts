// Smoke test for the Phase 3A quiz engine.
//
// Loads `mobile/data.json` via fs (not via the ES-module JSON import, which
// would require an `with { type: 'json' }` attribute incompatible with the
// Metro bundler), then exercises the pure engine functions from
// `mobile/src/quiz/*.ts`. Runs natively under Node 23.6+ via type-stripping.
// Exits non-zero on any failed assertion.

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { norm } from '../src/quiz/normalize.ts';
import { gradeAnswer } from '../src/quiz/grade.ts';
import { resolveQuestion, isInfoCardQuestion } from '../src/quiz/resolve.ts';
import { pickQuestions, getQuestionBankFromData } from '../src/quiz/pick.ts';
import type { AppData, Question, RouteKey } from '../src/types/quiz.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.resolve(here, '..', 'data.json');
if (!fs.existsSync(dataPath)) {
  console.error(`✗ mobile/data.json not found at ${dataPath}. Run \`npm run sync-data\` first.`);
  process.exit(1);
}
const data: AppData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

const failures: string[] = [];
function assert(cond: unknown, msg: string): void {
  if (cond) {
    console.log(`  ✓ ${msg}`);
  } else {
    console.log(`  ✗ ${msg}`);
    failures.push(msg);
  }
}
function section(title: string): void {
  console.log(`\n━━━ ${title} ━━━`);
}

// Deterministic RNG so pickQuestions output is reproducible across runs.
function mulberry32(seed: number): () => number {
  let t = seed;
  return () => {
    t = (t + 0x6D2B79F5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

section('Data loads');
assert(data !== null && typeof data === 'object', 'data.json parses to object');
assert(data.schemaVersion === 1, `schemaVersion === 1 (got ${data.schemaVersion})`);
assert(typeof data.contentVersion === 'string' && data.contentVersion.length > 0, 'contentVersion present');
assert(typeof data.generatedAt === 'string' && data.generatedAt.length > 0, 'generatedAt present');

section('Counts');
assert(data.questions2025.length === 128, `questions2025.length === 128 (got ${data.questions2025.length})`);
assert(data.questions2008.length === 100, `questions2008.length === 100 (got ${data.questions2008.length})`);
assert(Object.keys(data.langMeta).length === 14, `langMeta keys === 14 (got ${Object.keys(data.langMeta).length})`);
assert(Object.keys(data.routeConfig).length === 6, `routeConfig keys === 6 (got ${Object.keys(data.routeConfig).length})`);
assert(Object.keys(data.stateData).length === 51, `stateData keys === 51 (got ${Object.keys(data.stateData).length})`);

section('routeConfig askCount values');
assert(data.routeConfig['2025']?.askCount === 20, `2025.askCount === 20 (got ${data.routeConfig['2025']?.askCount})`);
assert(data.routeConfig['2008']?.askCount === 10, `2008.askCount === 10 (got ${data.routeConfig['2008']?.askCount})`);
assert(data.routeConfig['6520_2025']?.askCount === 10, `6520_2025.askCount === 10`);
assert(data.routeConfig['6520_2008']?.askCount === 10, `6520_2008.askCount === 10`);
assert(data.routeConfig['5020']?.askCount === 20, `5020.askCount === 20`);
assert(data.routeConfig['5515']?.askCount === 20, `5515.askCount === 20`);

section('norm() parity with web index.html line 6056');
assert(norm('Hello, World!') === 'helloworld', 'norm strips punctuation');
assert(norm('  The   Constitution  ') === 'theconstitution', 'norm strips whitespace');
assert(norm('Twenty-Seven (27)') === 'twentyseven27', 'norm preserves digits');
assert(norm('café') === 'caf', 'norm drops non-ASCII (caf only — é stripped)');
assert(norm('') === '', 'norm of empty is empty');

section('getQuestionBankFromData — per-route filter');
const bank2025 = getQuestionBankFromData('2025', data);
const bank2008 = getQuestionBankFromData('2008', data);
const bank6520_25 = getQuestionBankFromData('6520_2025', data);
const bank6520_08 = getQuestionBankFromData('6520_2008', data);
const bank5020 = getQuestionBankFromData('5020', data);
const bank5515 = getQuestionBankFromData('5515', data);

assert(bank2025.length === 127, `2025 bank size 127 after excluded filter (got ${bank2025.length})`);
assert(bank2008.length === 99, `2008 bank size 99 after excluded filter (got ${bank2008.length})`);
assert(bank6520_25.length > 0 && bank6520_25.every((q) => q.starred_6520 === true && !q.excluded), `6520_2025 bank ${bank6520_25.length} items, all starred + not excluded`);
assert(bank6520_08.length > 0 && bank6520_08.every((q) => q.starred_6520 === true && !q.excluded), `6520_2008 bank ${bank6520_08.length} items, all starred + not excluded`);
assert(bank5020.length === bank2025.length, '5020 bank === 2025 bank (English exemption only)');
assert(bank5515.length === bank2025.length, '5515 bank === 2025 bank (English exemption only)');

section('pickQuestions — deterministic with seeded RNG');
const seq2025 = pickQuestions('2025', data, { rng: mulberry32(42) });
const seq2008 = pickQuestions('2008', data, { rng: mulberry32(42) });
const seq6520_25 = pickQuestions('6520_2025', data, { rng: mulberry32(42) });

const gradable2025 = seq2025.filter((q) => !isInfoCardQuestion(q));
const info2025 = seq2025.filter((q) => isInfoCardQuestion(q));
assert(gradable2025.length === 20, `2025 sequence has 20 gradable (got ${gradable2025.length})`);
assert(info2025.length >= 0 && info2025.length <= 2, `2025 sequence has 0-2 info-cards (got ${info2025.length})`);

const gradable2008 = seq2008.filter((q) => !isInfoCardQuestion(q));
const info2008 = seq2008.filter((q) => isInfoCardQuestion(q));
assert(gradable2008.length === 10, `2008 sequence has 10 gradable (got ${gradable2008.length})`);
assert(info2008.length >= 0 && info2008.length <= 2, `2008 sequence has 0-2 info-cards (got ${info2008.length})`);

const gradable6520_25 = seq6520_25.filter((q) => !isInfoCardQuestion(q));
assert(gradable6520_25.length === 10, `6520_2025 sequence has 10 gradable (got ${gradable6520_25.length})`);

assert(seq2025[0] !== undefined && !isInfoCardQuestion(seq2025[0]), 'first item of 2025 sequence is gradable');
assert(seq2008[0] !== undefined && !isInfoCardQuestion(seq2008[0]), 'first item of 2008 sequence is gradable');

section('gradeAnswer — ≥5 known correct answers accepted');
let correctPass = 0;
const correctIds: number[] = [];
for (const q of bank2025) {
  if (isInfoCardQuestion(q)) continue;
  if (!Array.isArray(q.a) || q.a.length === 0) continue;
  const accepted = q.a[0];
  if (typeof accepted !== 'string') continue;
  if (gradeAnswer(accepted, q)) {
    correctPass++;
    correctIds.push(q.id);
    if (correctPass >= 5) break;
  }
}
assert(correctPass >= 5, `≥5 correct answers grade true (got ${correctPass}, IDs ${correctIds.join(',')})`);

section('gradeAnswer — ≥5 distractors rejected');
let wrongReject = 0;
const wrongIds: number[] = [];
for (const q of bank2025) {
  if (isInfoCardQuestion(q)) continue;
  if (!Array.isArray(q.distractors) || q.distractors.length === 0) continue;
  if (!Array.isArray(q.a) || q.a.length === 0) continue;
  const distractor = q.distractors[0];
  if (typeof distractor !== 'string') continue;
  // Skip distractor that accidentally substring-matches an accepted answer
  // (CLAUDE.md "answer-matching gotcha" — those would be DATA bugs, not engine bugs).
  if (gradeAnswer(distractor, q)) continue;
  wrongReject++;
  wrongIds.push(q.id);
  if (wrongReject >= 5) break;
}
assert(wrongReject >= 5, `≥5 distractors grade false (got ${wrongReject}, IDs ${wrongIds.join(',')})`);

section('resolveQuestion — classifies every 2025 bank question safely');
let mcqOk = 0;
let infoCard = 0;
let needsState = 0;
let unsupported = 0;
const unsupportedIds: number[] = [];
const badFieldIds: number[] = [];
for (const q of bank2025) {
  const r = resolveQuestion(q);
  if (r.kind === 'mcq') {
    mcqOk++;
    if (
      typeof r.question.id !== 'number' ||
      Number.isNaN(r.question.id) ||
      typeof r.question.q !== 'string' ||
      r.question.q.length === 0 ||
      !Array.isArray(r.accepted) ||
      r.accepted.length === 0 ||
      !Array.isArray(r.distractors) ||
      r.distractors.length < 3
    ) {
      badFieldIds.push(r.question.id);
    }
  } else if (r.kind === 'needsInfoCard') {
    infoCard++;
  } else if (r.kind === 'needsState') {
    needsState++;
  } else {
    unsupported++;
    unsupportedIds.push(r.question.id);
  }
}
assert(mcqOk > 0, `2025 bank: ${mcqOk} mcq classified`);
assert(infoCard >= 4, `2025 bank: ≥4 info-card (≥1 of each: dynamic + state-senators + state-governor) — got ${infoCard}`);
assert(needsState >= 1, `2025 bank: ≥1 needsState (capital) — got ${needsState}`);
assert(badFieldIds.length === 0, `0 mcq view models with bad fields (got ${badFieldIds.length}, IDs ${badFieldIds.join(',')})`);
if (unsupported > 0) {
  console.log(`  ℹ 2025 bank: ${unsupported} unsupported question(s): IDs ${unsupportedIds.join(',')}`);
}

section('Bank totals reconcile');
const total = mcqOk + infoCard + needsState + unsupported;
assert(total === bank2025.length, `mcq(${mcqOk}) + info(${infoCard}) + state(${needsState}) + unsup(${unsupported}) === bank(${bank2025.length})`);

section('Picked 2025 sequence — no NaN/null/undefined in resolved view models');
let badFields = 0;
let mcqInSeq = 0;
for (const q of seq2025) {
  const r = resolveQuestion(q);
  if (r.kind !== 'mcq') continue;
  mcqInSeq++;
  for (const s of r.accepted) {
    if (typeof s !== 'string' || s.length === 0) badFields++;
  }
  for (const s of r.distractors) {
    if (typeof s !== 'string' || s.length === 0) badFields++;
  }
  if (typeof r.question.q !== 'string' || r.question.q.length === 0) badFields++;
  if (typeof r.question.id !== 'number' || Number.isNaN(r.question.id)) badFields++;
}
assert(mcqInSeq > 0, `picked 2025 sequence has ${mcqInSeq} mcq question(s) resolved`);
assert(badFields === 0, `0 bad fields in resolved 2025 sequence view models (got ${badFields})`);

section('Picked 2025 sequence — info-card/state questions explicitly tagged');
let seqInfo = 0;
let seqState = 0;
let seqMcq = 0;
let seqUnsup = 0;
for (const q of seq2025) {
  const r = resolveQuestion(q);
  switch (r.kind) {
    case 'mcq': seqMcq++; break;
    case 'needsInfoCard': seqInfo++; break;
    case 'needsState': seqState++; break;
    case 'unsupportedInPhase3A': seqUnsup++; break;
  }
}
assert(seqMcq + seqInfo + seqState + seqUnsup === seq2025.length, 'sequence totals match');
console.log(`  ℹ 2025 sequence breakdown: mcq=${seqMcq}, info=${seqInfo}, state=${seqState}, unsupported=${seqUnsup}`);

section('Invariant IV — no officeholder names in any resolved MCQ output');
// Defense in depth: build-app-data already enforces this on data.json. Smoke
// re-asserts at engine output so any future regression is caught here too.
const IV_FORBIDDEN: { pat: RegExp; label: string }[] = [
  { pat: /\b(Donald )?Trump\b/i, label: 'Trump' },
  { pat: /\b(JD |J\.?D\.? )?Vance\b/i, label: 'Vance' },
  { pat: /\bMike Johnson\b/i, label: 'Mike Johnson' },
  { pat: /\b(John )?(G\.? )?Roberts\b/i, label: 'Roberts' },
  { pat: /\bBiden\b/i, label: 'Biden' },
  { pat: /\bHarris\b/i, label: 'Harris' },
  { pat: /\bPelosi\b/i, label: 'Pelosi' },
  { pat: /\bMcCarthy\b/i, label: 'McCarthy' },
  { pat: /\bJeffries\b/i, label: 'Jeffries' },
];
const ivHits: { id: number; label: string; text: string }[] = [];
for (const q of bank2025) {
  const r = resolveQuestion(q);
  if (r.kind !== 'mcq') continue;
  for (const s of [...r.accepted, ...r.distractors]) {
    for (const { pat, label } of IV_FORBIDDEN) {
      if (pat.test(s)) ivHits.push({ id: r.question.id, label, text: s });
    }
  }
}
assert(ivHits.length === 0, `Invariant IV — 0 officeholder names in MCQ output (got ${ivHits.length})`);
for (const h of ivHits.slice(0, 5)) console.log(`     #${h.id} matched /${h.label}/ in "${h.text}"`);

section('Done');
if (failures.length > 0) {
  console.log(`\n✗ ${failures.length} failure(s):`);
  for (const f of failures) console.log(`   - ${f}`);
  process.exit(1);
}
console.log('\n✅ All smoke checks passed.');
