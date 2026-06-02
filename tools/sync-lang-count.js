// tools/sync-lang-count.js
//
// Reads LANG_META from index.html, validates its count, and patches every
// marketing artifact that references the language count or list:
//
//   - 8 meta tags / JSON-LD fields in <head>
//   - The hreflang link block (regenerated from LANG_META keys)
//   - The visible "Data sources" list item in the About screen
//   - og-image.svg subtitle text
//
// After updating, regenerates og-image.png via `sips` (macOS built-in).
//
// Idempotent: re-running on already-synced files reports zero changes.
// Source of truth: LANG_META — single edit point.
//
// Usage:
//   node tools/sync-lang-count.js           → dry-run (writes to /tmp)
//   node tools/sync-lang-count.js --apply   → write to repo + regen PNG

const fs   = require('fs');
const vm   = require('vm');
const path = require('path');
const { execSync } = require('child_process');

const ROOT  = path.resolve(__dirname, '..');
const INDEX = path.join(ROOT, 'index.html');
const SVG   = path.join(ROOT, 'og-image.svg');
const PNG   = path.join(ROOT, 'og-image.png');

// ─── Load LANG_META → array of language codes ─────────────────────────
function loadLangs() {
  const html = fs.readFileSync(INDEX, 'utf8');
  const start = html.indexOf('const LANG_META = {');
  if (start < 0) throw new Error('LANG_META declaration not found in index.html');
  const end = html.indexOf('\n};', start);
  if (end < 0) throw new Error('LANG_META block end not found');
  const block = html.slice(start, end + 3);
  const sb = { module: { exports: {} } };
  vm.runInNewContext(block.replace('const LANG_META', 'module.exports.LANG_META'), sb);
  return Object.keys(sb.module.exports.LANG_META);
}

const LANGS = loadLangs();
const N = LANGS.length;
console.log(`LANG_META: ${N} languages → [${LANGS.join(', ')}]\n`);

// ─── Substitution rules for index.html ────────────────────────────────
// Each rule's regex captures the count via `\d+` so the script remains
// useful when LANG_META later grows or shrinks.
const indexSubs = [
  {
    name: 'meta description',
    re: /<meta name="description" content="[^"]*">/,
    replace: () => `<meta name="description" content="Free practice for the U.S. naturalization civics test. 128 official USCIS questions, translated into ${N} languages, with state-specific answers and interview simulation. 100% free, no account.">`,
  },
  {
    name: 'og:title',
    re: /(<meta property="og:title" content="Free U\.S\. Citizenship Civics Test 2025 — )\d+( Languages">)/,
    replace: (_, pre, post) => `${pre}${N}${post}`,
  },
  {
    name: 'og:description',
    re: /<meta property="og:description" content="[^"]*">/,
    replace: () => `<meta property="og:description" content="Practice the official USCIS naturalization civics test for free. 128 questions, available in ${N} languages, with state-specific answers and interview simulation.">`,
  },
  {
    name: 'twitter:title',
    re: /(<meta name="twitter:title" content="Free U\.S\. Citizenship Test Practice — )\d+( Languages">)/,
    replace: (_, pre, post) => `${pre}${N}${post}`,
  },
  {
    name: 'twitter:description',
    re: /<meta name="twitter:description" content="[^"]*">/,
    replace: () => `<meta name="twitter:description" content="128 USCIS civics questions, available in ${N} languages. Interview simulation. State-specific answers. 100% free.">`,
  },
  {
    name: 'JSON-LD description',
    re: /("description": "Free practice app for the U\.S\. naturalization civics test\. Official USCIS questions in )\d+( languages\.")/,
    replace: (_, pre, post) => `${pre}${N}${post}`,
  },
  {
    name: 'JSON-LD featureList (lang count)',
    re: /"\d+ languages(?:: [^"]+)?"/,
    replace: () => `"${N} languages"`,
  },
  {
    name: 'about.sources.translations (English fallback)',
    re: /(<li data-i18n-html="about\.sources\.translations">)[^<]+(<\/li>)/,
    replace: (_, pre, post) =>
      `${pre}USCIS official translations (English, Vietnamese, Spanish, Chinese, Filipino, Korean, Haitian Creole) + CLINIC multilingual translations (Hindi, Thai, Lao, Hmong, Burmese, Portuguese, Russian)${post}`,
  },
  {
    name: 'hreflang block',
    // Matches the comment marker, all existing <link rel="alternate"> entries,
    // and the x-default. Regenerates the block from LANGS so adding a new
    // language to LANG_META auto-publishes a hreflang link.
    re: /(<!--[^>]*multilingual SEO[^>]*-->\n)(?:<link rel="alternate" hreflang="[^"]+" href="[^"]+">\n)+(<link rel="alternate" hreflang="x-default" href="[^"]+">)/,
    replace: (_, header, xDefault) =>
      header +
      LANGS.map(L =>
        `<link rel="alternate" hreflang="${L}" href="https://formn400.org${L === 'en' ? '' : '/?lang=' + L}">`
      ).join('\n') + '\n' + xDefault,
  },
];

// Apply rules
let html = fs.readFileSync(INDEX, 'utf8');
const log = [];
for (const sub of indexSubs) {
  const newHtml = html.replace(sub.re, sub.replace);
  if (newHtml === html) log.push(`  ⚠ ${sub.name}: no change (already synced or anchor not found)`);
  else                 { log.push(`  ✓ ${sub.name}: updated`); html = newHtml; }
}

// SVG subtitle
let svg = fs.readFileSync(SVG, 'utf8');
const svgNew = svg.replace(/(Free Practice — )\d+( Languages?)/, (_, a, b) => `${a}${N}${b}`);
if (svgNew !== svg) { log.push('  ✓ og-image.svg subtitle: updated'); svg = svgNew; }
else                log.push('  ⚠ og-image.svg: no change');

console.log('Substitutions:');
log.forEach(l => console.log(l));

const APPLY = process.argv.includes('--apply');

if (!APPLY) {
  fs.mkdirSync('/tmp/n400-audit', { recursive: true });
  fs.writeFileSync('/tmp/n400-audit/sync-index.html', html, 'utf8');
  fs.writeFileSync('/tmp/n400-audit/sync-og-image.svg', svg, 'utf8');
  console.log('\n[DRY] Outputs:');
  console.log('  /tmp/n400-audit/sync-index.html');
  console.log('  /tmp/n400-audit/sync-og-image.svg');
  console.log('\nRun with --apply to write to repo + regenerate PNG.');
  process.exit(0);
}

// APPLY
fs.writeFileSync(INDEX, html, 'utf8');
fs.writeFileSync(SVG, svg, 'utf8');
console.log('\n✓ Wrote index.html + og-image.svg');

try {
  execSync(`sips -s format png "${SVG}" --out "${PNG}"`, { stdio: ['ignore', 'pipe', 'pipe'] });
  const stat = fs.statSync(PNG);
  console.log(`✓ Regenerated og-image.png via sips (${stat.size} bytes)`);
} catch (e) {
  console.log('✗ sips failed:', e.message);
  console.log(`  Run manually: sips -s format png ${SVG} --out ${PNG}`);
  process.exit(1);
}
