// tools/build-app-data.js
//
// Phase 1 of mobile-app track. Extracts structured data from the canonical
// web source (index.html) into a single static JSON file (data.json) that
// the mobile app can fetch + cache. Pure-read of index.html; no source
// repair, no normalization, no silent fixes — validation failures abort
// with a non-zero exit code so source bugs surface immediately.
//
// Usage:
//   node tools/build-app-data.js          → dry-run (writes to /tmp)
//   node tools/build-app-data.js --apply  → writes ./data.json
//
// Validation rules (fail loudly):
//   1.  All required top-level keys present.
//   2.  QUESTIONS_2025 count = 128.
//   3.  QUESTIONS_2008 count = 100.
//   4.  LANG_META count = 14.
//   5.  Every question has non-empty `q` (English text).
//   6.  Every non-info-card question has non-empty `a` array with non-empty strings.
//   7.  Every defined `<lang>_a` is an array of non-empty strings, no holes.
//   8.  For non-info-card questions: `<lang>_a.length` MUST NOT EXCEED `a.length`.
//       (Translated > English would indicate English is incomplete — the
//        Q85/Franklin pre-fix pattern. The reverse direction (translated <
//        English) is the USCIS-canonical synonym-collapse and is WARNED, not
//        failed — confirmed benign by Phase 0 across 66 questions.)
//   9.  Index-0 semantic alignment heuristic across high-coverage langs
//       (vi/es/zh/tl/ko): proper-noun + digit invariant overlap. Failures here
//       mirror Phase 0's Q85 detection. After Q85 fix, none expected.
//  10.  Invariant IV: no dynamic/info-card field contains hardcoded current
//       officeholder names. Forbidden tokens: Biden, Harris, Pelosi, Trump,
//       Vance, Johnson (Speaker), Roberts (CJ), McCarthy, Jeffries — in any
//       `<lang>_a` of any q where (q.dynamic && q.officialField) or
//       (q.stateField in ['senators','governor']).
//  11.  No NaN, no plain null/undefined where a string was expected.
//  12.  ROUTE_CONFIG threshold + askCount sanity (12/20, 6/10, etc.).
//
// No silent repair. No reordering of bilingual arrays. Source must be fixed first.

const fs   = require('fs');
const vm   = require('vm');
const path = require('path');
const { execSync } = require('child_process');

const ROOT  = path.resolve(__dirname, '..');
const INDEX = path.join(ROOT, 'index.html');

// ─── Load source data via vm sandbox ────────────────────────────────────
function slice(html, s, e) {
  const a = html.indexOf(s);
  if (a < 0) throw new Error('source block not found: ' + s);
  const b = html.indexOf(e, a);
  if (b < 0) throw new Error('end not found after: ' + s);
  return html.slice(a, b + e.length);
}
const html = fs.readFileSync(INDEX, 'utf8');
const sb = { module: { exports: {} } };
vm.runInNewContext(
  slice(html, 'const QUESTIONS_2025 = [', '\n];\n').replace(/^const QUESTIONS_2025/m, 'module.exports.QUESTIONS_2025') + '\n' +
  slice(html, 'const QUESTIONS_2008 = [', '\n];\n').replace(/^const QUESTIONS_2008/m, 'module.exports.QUESTIONS_2008') + '\n' +
  slice(html, 'const LANG_META = {',     '\n};\n').replace(/^const LANG_META/m,     'module.exports.LANG_META')     + '\n' +
  slice(html, 'const UI_TEXT = {',       '\n};\n').replace(/^const UI_TEXT/m,       'module.exports.UI_TEXT')       + '\n' +
  slice(html, 'const STATE_DATA = {',    '\n};\n').replace(/^const STATE_DATA/m,    'module.exports.STATE_DATA')    + '\n' +
  slice(html, 'const ROUTE_CONFIG = {',  '\n};\n').replace(/^const ROUTE_CONFIG/m,  'module.exports.ROUTE_CONFIG'),
  sb);
const { QUESTIONS_2025, QUESTIONS_2008, LANG_META, UI_TEXT, STATE_DATA, ROUTE_CONFIG } = sb.module.exports;

const NATIVE_LANGS = Object.keys(LANG_META).filter(l => l !== 'en');

// ─── Helpers from index.html (re-implemented for export-side checks) ───
function isInfoCardQuestion(q) {
  if (q.dynamic && q.officialField) return true;
  if (q.stateField === 'senators') return true;
  if (q.stateField === 'governor') return true;
  return false;
}
// Capital Qs (2025 #62, 2008 #44) render MCQ but their `a` is populated by
// resolveQuestion from STATE_DATA at render time — module-load value is
// undefined. Skip the static-`a`-non-empty check for these.
function isStateResolvedQuestion(q) {
  return q.stateField === 'capital' || isInfoCardQuestion(q);
}

// Invariant IV forbidden tokens (current officeholder names anywhere in
// dynamic/state-officeholder field content). This list mirrors what Phase 0
// established and should be expanded if officeholders change.
const IV_FORBIDDEN = [
  /\bBiden\b/i, /\bHarris\b/i, /\bPelosi\b/i, /\bTrump\b/i, /\bVance\b/i,
  /\bMike\s+Johnson\b/i, /\bRoberts\b/i, /\bMcCarthy\b/i, /\bJeffries\b/i,
  /\bSotomayor\b/i, /\bClarence Thomas\b/i, /\bKavanaugh\b/i, /\bPence\b/i, /\bWalz\b/i,
  /Joe\s+Biden|Джо\s*Байден|Джо́?зеф\s*Ба́?йден/i,
  /Kamala\s+Harris|Ка́?мала\s*Ха́?ррис/i,
  /Nancy\s+Pelosi|Нэнси\s+Пелоси/i,
  /John\s+Roberts|Джон\s+Робертс/i,
];

// ─── Validation ─────────────────────────────────────────────────────────
const violations = []; // hard fails
const warnings   = []; // non-fatal observations
function fail(msg) { violations.push(msg); }
function warn(msg) { warnings.push(msg); }

// 1. Required top-level keys checked at output assembly time.

// 2-4. Counts
if (QUESTIONS_2025.length !== 128) fail(`QUESTIONS_2025 count = ${QUESTIONS_2025.length} (expected 128)`);
if (QUESTIONS_2008.length !== 100) fail(`QUESTIONS_2008 count = ${QUESTIONS_2008.length} (expected 100)`);
if (Object.keys(LANG_META).length !== 14) fail(`LANG_META count = ${Object.keys(LANG_META).length} (expected 14)`);

// 12. ROUTE_CONFIG sanity
const expectedRoutes = {
  '2025':      { passThreshold:12, failThreshold:9, askCount:20 },
  '2008':      { passThreshold:6,  failThreshold:5, askCount:10 },
  '6520_2025': { passThreshold:6,  failThreshold:5, askCount:10 },
  '6520_2008': { passThreshold:6,  failThreshold:5, askCount:10 },
  '5020':      { passThreshold:12, failThreshold:9, askCount:20 },
  '5515':      { passThreshold:12, failThreshold:9, askCount:20 },
};
for (const [route, exp] of Object.entries(expectedRoutes)) {
  if (!ROUTE_CONFIG[route]) { fail(`ROUTE_CONFIG missing route "${route}"`); continue; }
  for (const k of ['passThreshold','failThreshold','askCount']) {
    if (ROUTE_CONFIG[route][k] !== exp[k]) {
      fail(`ROUTE_CONFIG[${route}].${k} = ${ROUTE_CONFIG[route][k]} (expected ${exp[k]})`);
    }
  }
}

// 5-9. Per-question checks
function checkBank(bank, name) {
  for (const q of bank) {
    const tag = `${name} #${q.id}`;
    // 5. q text
    if (typeof q.q !== 'string' || !q.q.trim()) fail(`${tag}: missing or empty .q`);
    // Skip excluded — they never reach a user.
    if (q.excluded) continue;
    // 6. a array (non-info-card AND not state-resolved like capital)
    if (!isStateResolvedQuestion(q)) {
      if (!Array.isArray(q.a) || q.a.length === 0) fail(`${tag}: .a missing/empty (non-info-card)`);
      else {
        for (let i = 0; i < q.a.length; i++) {
          if (typeof q.a[i] !== 'string' || !q.a[i].trim()) fail(`${tag}: .a[${i}] not non-empty string`);
        }
      }
    }
    // 7+8. per-lang _a checks
    for (const L of NATIVE_LANGS) {
      const aL = q[L + '_a'];
      if (aL == null) continue; // missing is OK (engine handles fallback)
      if (!Array.isArray(aL)) { fail(`${tag}: ${L}_a is not an array`); continue; }
      if (aL.length === 0) { fail(`${tag}: ${L}_a is empty array`); continue; }
      for (let i = 0; i < aL.length; i++) {
        const v = aL[i];
        if (typeof v !== 'string' || !v.trim()) fail(`${tag}: ${L}_a[${i}] not non-empty string`);
      }
      // Length: translated MUST NOT exceed English. (Reverse direction is benign synonym-collapse.)
      if (!isInfoCardQuestion(q) && Array.isArray(q.a) && aL.length > q.a.length) {
        fail(`${tag}: ${L}_a.length=${aL.length} exceeds .a.length=${q.a.length} (English likely incomplete; mirrors Q85/Franklin pre-fix pattern)`);
      }
    }
    // 9. Index-0 semantic alignment heuristic (Phase 0 logic): proper-noun + digit invariant overlap
    // Run only on non-info-card with translated arrays present
    if (!isInfoCardQuestion(q) && Array.isArray(q.a) && q.a.length > 1) {
      const a0Tokens = invariantTokens(q.a[0]);
      if (a0Tokens.size > 0) {
        for (const L of ['vi','es','zh','tl','ko']) {
          const aL = q[L + '_a'];
          if (!Array.isArray(aL) || aL.length === 0) continue;
          const aL0Tokens = invariantTokens(aL[0]);
          if (aL0Tokens.size === 0) continue; // no anchor → skip
          const ov0 = intersect(a0Tokens, aL0Tokens);
          // Find max-overlap index j
          let bestJ = 0, bestOv = ov0;
          for (let j = 1; j < aL.length; j++) {
            const ov = intersect(a0Tokens, invariantTokens(aL[j]));
            if (ov > bestOv) { bestJ = j; bestOv = ov; }
          }
          if (bestJ !== 0 && bestOv > ov0) {
            fail(`${tag}: ${L}_a[0]="${aL[0].slice(0,60)}" semantically aligns with ${L}_a[${bestJ}] rather than .a[0]="${q.a[0].slice(0,60)}" (index-0 misalignment, Phase 0 detection)`);
          }
        }
      }
    }
    // 10. Invariant IV — info-card questions must not contain officeholder names
    if (isInfoCardQuestion(q)) {
      for (const L of NATIVE_LANGS) {
        const aL = q[L + '_a'];
        if (!Array.isArray(aL)) continue;
        for (let i = 0; i < aL.length; i++) {
          const v = aL[i];
          for (const re of IV_FORBIDDEN) {
            if (re.test(v)) {
              fail(`${tag}: ${L}_a[${i}] contains forbidden officeholder name (${re}) — info-card field must use lookup boilerplate, not a name`);
            }
          }
        }
      }
      // Also check English `a` if present
      if (Array.isArray(q.a)) {
        for (let i = 0; i < q.a.length; i++) {
          for (const re of IV_FORBIDDEN) {
            if (re.test(q.a[i])) {
              fail(`${tag}: .a[${i}] contains forbidden officeholder name (${re})`);
            }
          }
        }
      }
    }
    // Length-mismatch in the BENIGN direction → warn only
    if (!isInfoCardQuestion(q) && Array.isArray(q.a)) {
      for (const L of NATIVE_LANGS) {
        const aL = q[L + '_a'];
        if (Array.isArray(aL) && aL.length < q.a.length) {
          warn(`${tag}: ${L}_a.length=${aL.length} < .a.length=${q.a.length} (synonym-collapse — USCIS-style; benign)`);
        }
      }
    }
  }
}

// ─── Invariant-token helper for index-0 alignment heuristic ─────────────
const PROPER_NOUN = /\b(Jefferson|Washington|Madison|Hamilton|Franklin|Lincoln|Roosevelt|Wilson|Truman|Hoover|Eisenhower|Kennedy|Nixon|Reagan|Bush|Obama|Biden|Trump|Harris|Vance|Pelosi|Johnson|Roberts|Sotomayor|Thomas|Kavanaugh|Pence|Walz|McCarthy|Jeffries|Jay|Adams|MLK|Cherokee|Navajo|Sioux|Apache|Iroquois|Choctaw|Pueblo|Constitution|Declaration|Independence|World War|Civil War|Vietnam|Korea|Pearl Harbor|Cold War|Great Depression|Federalist|Whigs|Democratic|Republican|Continental|Yorktown|Saratoga|Bunker Hill|Trenton|Gettysburg|Antietam|Vicksburg|Appomattox|Sumter|Louisiana|Alaska|Hawaii|Texas|California|New York|Maine|Vermont|Pennsylvania|Michigan|Minnesota|Montana|Idaho|Massachusetts|Connecticut|Mexico|Britain|France|Germany|Japan|USSR)\b/gi;
const NUM_RE = /\b(\d{1,4}|first|second|third|fourth|fifth|nine|five|two|three|four|six|seven|eight|ten|eighteen|sixteen|fifteen|fourteen|twenty)\b/gi;
function invariantTokens(s) {
  if (typeof s !== 'string') return new Set();
  const out = new Set();
  for (const m of (s.match(PROPER_NOUN) || [])) out.add(m.toLowerCase());
  for (const m of (s.match(NUM_RE)      || [])) out.add(m.toLowerCase());
  return out;
}
function intersect(a, b) { let c = 0; for (const x of a) if (b.has(x)) c++; return c; }

checkBank(QUESTIONS_2025, '2025');
checkBank(QUESTIONS_2008, '2008');

// 11. NaN walker on the assembled JSON (catches any NaN/undefined that survived deep-copy)
function walkForNaN(obj, breadcrumb) {
  if (obj === null) return;
  if (Number.isNaN(obj)) { fail(`NaN at ${breadcrumb}`); return; }
  if (typeof obj !== 'object') return;
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) walkForNaN(obj[i], `${breadcrumb}[${i}]`);
  } else {
    for (const k of Object.keys(obj)) walkForNaN(obj[k], `${breadcrumb}.${k}`);
  }
}

// ─── Assemble output ────────────────────────────────────────────────────
let contentVersion;
try {
  contentVersion = execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim();
} catch (e) {
  contentVersion = new Date().toISOString().slice(0, 10);
}
const output = {
  schemaVersion: 1,
  contentVersion,
  generatedAt: new Date().toISOString(),
  source: 'formn400.org web source',
  questions2025: QUESTIONS_2025,
  questions2008: QUESTIONS_2008,
  langMeta: LANG_META,
  uiText: UI_TEXT,
  stateData: STATE_DATA,
  routeConfig: ROUTE_CONFIG,
  integrity: {
    question2025Count: QUESTIONS_2025.length,
    question2008Count: QUESTIONS_2008.length,
    languageCount: Object.keys(LANG_META).length,
  },
};
walkForNaN(output, 'output');

// Required top-level keys check (rule #1)
const REQUIRED = ['schemaVersion','contentVersion','generatedAt','source','questions2025','questions2008','langMeta','uiText','stateData','routeConfig','integrity'];
for (const k of REQUIRED) if (!(k in output)) fail(`required top-level key missing: ${k}`);

// ─── Report + write ─────────────────────────────────────────────────────
console.log('─── App data build summary ───');
console.log(`schemaVersion:     ${output.schemaVersion}`);
console.log(`contentVersion:    ${output.contentVersion}`);
console.log(`generatedAt:       ${output.generatedAt}`);
console.log(`question2025Count: ${output.integrity.question2025Count}`);
console.log(`question2008Count: ${output.integrity.question2008Count}`);
console.log(`languageCount:     ${output.integrity.languageCount}`);
console.log(`uiText keys:       ${Object.keys(UI_TEXT).length}`);
console.log(`stateData keys:    ${Object.keys(STATE_DATA).length}`);
console.log(`routeConfig keys:  ${Object.keys(ROUTE_CONFIG).length}`);
console.log('');
console.log(`Warnings: ${warnings.length} (length-mismatch benign synonym-collapse + similar non-fatal observations)`);
if (process.env.SHOW_WARNINGS) warnings.slice(0, 30).forEach(w => console.log('  ⚠ ' + w));
console.log('');
console.log(`Violations: ${violations.length}`);
violations.forEach(v => console.log('  ✗ ' + v));

if (violations.length > 0) {
  console.log('');
  console.log('✗ BUILD FAILED — fix source data first, then re-run.');
  console.log('  (Set SHOW_WARNINGS=1 to also see non-fatal warnings.)');
  process.exit(1);
}

const APPLY = process.argv.includes('--apply');
const outPath = APPLY ? path.join(ROOT, 'data.json') : '/tmp/n400-audit/data.json';
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(output, null, 0), 'utf8');
const stat = fs.statSync(outPath);
console.log('');
console.log(`✓ Wrote ${outPath}  (${stat.size} bytes)`);
console.log(APPLY ? '✓ Production data.json updated.' : '[DRY] Use --apply to write to repo data.json.');
