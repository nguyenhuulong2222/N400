// Correct-option alignment test (Phase 1 — "Franklin VI mismatch" regression guard).
//
// Asserts the contract documented at the top of `src/store/buildViewModel.ts`:
//
//   For EVERY (question, language) pair in both banks:
//     1. The displayed correct option's English text === q.a[0].
//     2. Its localized text === q.<lang>_a[0] when that string exists.
//     3. When q.<lang>_a[0] does not exist, the option is English-ONLY —
//        no localized side at all. Fallback is all-or-nothing per option;
//        an option must never pair a localized string with a non-
//        corresponding English one (the bug this test exists to catch).
//     4. No option, correct or distractor, is ever half-localized.
//
// This is the mobile-side equivalent of the web app pinning index 0 at
// index.html:6417 / :6426. It is deliberately run against a deterministic
// RNG sweep so that every reachable shuffle ordering is exercised.
//
// Run: npm run test:alignment      (from mobile/)

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveQuestion } from '../src/quiz/resolve.ts';
import { buildQuizViewModel } from '../src/store/buildViewModel.ts';
import type { AppData, LangCode, Question, Rng } from '../src/types/quiz.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.resolve(here, '..', 'data.json');
if (!fs.existsSync(dataPath)) {
  console.error(`✗ mobile/data.json not found at ${dataPath}. Run \`npm run sync-data\` first.`);
  process.exit(1);
}
const data: AppData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

const LANGS: LangCode[] = [
  'en', 'vi', 'es', 'zh', 'tl', 'ko',
  'hi', 'ht', 'th', 'lo', 'hmn', 'my', 'pt', 'ru',
];

const failures: string[] = [];
let checked = 0;
let localizedOk = 0;
let englishFallback = 0;

function fail(msg: string): void {
  failures.push(msg);
}

// Deterministic RNG so a failure is reproducible from the seed alone.
function makeRng(seed: number): Rng {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function readStringArray(q: Question, key: string): string[] | undefined {
  const v = (q as unknown as Record<string, unknown>)[key];
  return Array.isArray(v) ? (v as unknown[]).filter((x): x is string => typeof x === 'string') : undefined;
}

function checkBank(bank: Question[], bankName: string): void {
  for (const q of bank) {
    if (q.excluded) continue;
    const resolved = resolveQuestion(q, {});
    // Only MCQ questions produce options. Info cards / state cards are
    // covered by the Invariant IV checks in the smoke suite.
    if (resolved.kind !== 'mcq') continue;

    for (const lang of LANGS) {
      // Sweep several seeds — the correct option must land on a[0] under
      // every one of them, regardless of where the shuffle places it.
      for (let seed = 1; seed <= 8; seed++) {
        const vm = buildQuizViewModel(resolved, { lang, rng: makeRng(seed) });
        const tag = `${bankName} #${q.id} lang=${lang} seed=${seed}`;
        if (vm === null) {
          fail(`${tag}: buildQuizViewModel returned null for a resolved MCQ`);
          continue;
        }
        checked++;

        const correct = vm.options[vm.correctIndex];
        if (!correct) {
          fail(`${tag}: correctIndex ${vm.correctIndex} does not address an option`);
          continue;
        }

        // 1. English text is pinned to a[0].
        const expectedEn = resolved.accepted[0];
        if (correct.english !== expectedEn) {
          fail(`${tag}: correct option EN = ${JSON.stringify(correct.english)} but a[0] = ${JSON.stringify(expectedEn)}`);
        }

        // 2 + 3. Localized side matches <lang>_a[0], or is absent entirely.
        const localizedArr = lang === 'en' ? undefined : readStringArray(q, `${lang}_a`);
        const expectedLocalized =
          localizedArr && typeof localizedArr[0] === 'string' && localizedArr[0].length > 0
            ? localizedArr[0]
            : undefined;

        if (expectedLocalized === undefined) {
          if (correct.localized !== undefined) {
            fail(`${tag}: no ${lang}_a[0] in source but option carries localized text ${JSON.stringify(correct.localized)}`);
          } else {
            englishFallback++;
          }
        } else {
          if (correct.localized !== expectedLocalized) {
            fail(`${tag}: correct option localized = ${JSON.stringify(correct.localized)} but ${lang}_a[0] = ${JSON.stringify(expectedLocalized)}`);
          } else {
            localizedOk++;
          }
        }

        // 4. No option anywhere is half-localized (empty-string localized,
        //    or a localized value that is not a usable string).
        for (let i = 0; i < vm.options.length; i++) {
          const o = vm.options[i];
          if (!o) { fail(`${tag}: option ${i} is missing`); continue; }
          if (typeof o.english !== 'string' || o.english.length === 0) {
            fail(`${tag}: option ${i} has empty English text`);
          }
          if (o.localized !== undefined && (typeof o.localized !== 'string' || o.localized.length === 0)) {
            fail(`${tag}: option ${i} has a present-but-empty localized string`);
          }
        }

        if (vm.options.length !== 4) {
          fail(`${tag}: expected 4 options, got ${vm.options.length}`);
        }
      }
    }
  }
}

// ─── Targeted regression case: 2025 Q85, Benjamin Franklin ──────────────
function checkFranklin(): void {
  const q = data.questions2025.find((x) => x.id === 85);
  if (!q) { fail('2025 #85 (Benjamin Franklin) not found in bank'); return; }
  const resolved = resolveQuestion(q, {});
  if (resolved.kind !== 'mcq') { fail('2025 #85 did not resolve to MCQ'); return; }

  console.log('\n━━━ 2025 #85 — Benjamin Franklin (the reported bug) ━━━');
  console.log(`  a.length = ${(q.a ?? []).length}   vi_a.length = ${(readStringArray(q, 'vi_a') ?? []).length}`);
  for (let seed = 1; seed <= 5; seed++) {
    const vm = buildQuizViewModel(resolved, { lang: 'vi', rng: makeRng(seed) });
    if (!vm) { fail('2025 #85: null view model'); continue; }
    const c = vm.options[vm.correctIndex];
    console.log(`  seed=${seed} correctIndex=${vm.correctIndex}`);
    console.log(`    EN: ${c?.english}`);
    console.log(`    VI: ${c?.localized ?? '(English-only fallback)'}`);
    const mixedCount = vm.options.filter((o) => o.localized === undefined).length;
    console.log(`    options without a VI side: ${mixedCount} of 4`);
  }
}

console.log('━━━ Correct-option alignment — all questions × 14 languages × 8 seeds ━━━');
checkBank(data.questions2025, '2025');
checkBank(data.questions2008, '2008');
checkFranklin();

console.log('\n━━━ Summary ━━━');
console.log(`  view models checked      : ${checked}`);
console.log(`  correct option localized : ${localizedOk}`);
console.log(`  correct option EN-only   : ${englishFallback}`);
console.log(`  failures                 : ${failures.length}`);

if (failures.length > 0) {
  console.log('');
  failures.slice(0, 40).forEach((f) => console.log('  ✗ ' + f));
  if (failures.length > 40) console.log(`  … and ${failures.length - 40} more`);
  console.log('\n❌ Alignment test FAILED.');
  process.exit(1);
}
console.log('\n✅ Alignment test passed.');
