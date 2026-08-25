#!/usr/bin/env node
// demo-traffic-check.mjs — small evidence runner for the USCIS Torch API demo.
//
// Sends a handful of POST /case-status requests through our deployed Worker and
// prints, for each one, a UTC + HST timestamp, the request, and the response
// status — so exact times can be quoted to the USCIS team when they confirm they
// saw our `demo_id` traffic.
//
// SCREENSHOT-SAFE BY CONSTRUCTION:
//   * This file contains NO receipt numbers. They are read at runtime from the
//     RECEIPTS env var, or extracted from docs/API-2-sandbox-evidence.md.
//   * Every receipt is MASKED in all output (EAC*******694).
//   * This script never sees, sends, or prints a token or credential — the
//     Worker holds those. Response bodies are never dumped; only the `error`
//     field / a shape marker is shown.
//   * Receipts travel in the JSON BODY, never a URL (API Invariant II).
//
// Usage:
//   node scripts/demo-traffic-check.mjs
//   BASE_URL=https://... COUNT=5 node scripts/demo-traffic-check.mjs
//   RECEIPTS="<receipt>,<receipt>" node scripts/demo-traffic-check.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const EVIDENCE_DOC = resolve(HERE, '../../../docs/API-2-sandbox-evidence.md');

const BASE_URL = (process.env.BASE_URL || 'https://api.formn400.org').replace(/\/+$/, '');
const COUNT = Math.max(1, Math.min(8, Number(process.env.COUNT || 4)));
const THROTTLE_MS = Number(process.env.THROTTLE_MS || 400); // sandbox quota is 5 TPS
const RECEIPT_RE = /\b[A-Z]{3}[0-9]{10}\b/g;

// ---------------------------------------------------------------- receipts ---
function loadReceipts() {
  const fromEnv = (process.env.RECEIPTS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (fromEnv.length) return { source: 'RECEIPTS env var', list: fromEnv.slice(0, COUNT) };
  let doc;
  try {
    doc = readFileSync(EVIDENCE_DOC, 'utf8');
  } catch {
    console.error(`FATAL: no RECEIPTS env var and could not read ${EVIDENCE_DOC}`);
    process.exit(2);
  }
  const uniq = [...new Set(doc.match(RECEIPT_RE) || [])];
  if (!uniq.length) {
    console.error('FATAL: no sandbox receipts found in the evidence doc; set RECEIPTS instead.');
    process.exit(2);
  }
  return { source: 'docs/API-2-sandbox-evidence.md', list: uniq.slice(0, COUNT) };
}

// ABC1234567890 -> ABC*******890. Never print an unmasked receipt.
const mask = (r) =>
  typeof r === 'string' && r.length > 6 ? `${r.slice(0, 3)}${'*'.repeat(r.length - 6)}${r.slice(-3)}` : '***';

// -------------------------------------------------------------- timestamps ---
const HST = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Pacific/Honolulu',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
  hour12: false,
});

function stamps(d = new Date()) {
  const utc = d.toISOString().replace(/\.\d{3}Z$/, 'Z');
  const parts = Object.fromEntries(HST.formatToParts(d).map((p) => [p.type, p.value]));
  const hst = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
  return { utc, hst, line: `${utc} UTC  |  ${hst} HST` };
}

// ------------------------------------------------------------------- probe ---
async function probe(label, receipt) {
  const t = stamps();
  const shown = receipt === null ? '(deliberately malformed, no receipt)' : mask(receipt);
  console.log(`\n[${t.line}]`);
  console.log(`  → POST ${BASE_URL}/case-status   body: { receiptNumber: "${shown}" }   (${label})`);

  const started = Date.now();
  let res, bodyText;
  try {
    res = await fetch(`${BASE_URL}/case-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ receiptNumber: receipt === null ? 'NOT-A-RECEIPT' : receipt }),
    });
    bodyText = await res.text();
  } catch (err) {
    console.log(`  ← TRANSPORT FAILURE after ${Date.now() - started}ms: ${err?.message || 'unknown'}`);
    return { label, status: 0, ok: false };
  }
  const ms = Date.now() - started;

  // Never dump the body. Show only the error code, or a 200 shape marker.
  let detail;
  try {
    const j = JSON.parse(bodyText);
    detail = res.status === 200
      ? `case_status present: ${Object.prototype.hasOwnProperty.call(j, 'case_status') ? 'yes' : 'no'}`
      : `error: ${j?.error ?? '(none)'}`;
  } catch {
    detail = 'body not JSON';
  }
  console.log(`  ← HTTP ${res.status}  (${ms}ms)  ${detail}`);
  return { label, status: res.status, detail, at: t };
}

// -------------------------------------------------------------------- main ---
const start = stamps();
console.log('USCIS demo traffic check — formn400-api');
console.log(`Base URL : ${BASE_URL}`);
console.log(`Started  : ${start.line}`);

// Preflight: if the Worker is in MOCK_MODE nothing reaches USCIS and no demo_id
// header is ever sent, so the run proves nothing to the USCIS team.
let mock = null;
try {
  const h = await fetch(`${BASE_URL}/health`);
  const j = await h.json();
  mock = j?.mock === true;
  console.log(`Health   : HTTP ${h.status}  service=${j?.service} version=${j?.version} mock=${j?.mock}`);
} catch (err) {
  console.error(`Health   : UNREACHABLE — ${err?.message || 'unknown'}`);
  process.exit(2);
}

if (mock) {
  console.log('\n' + '!'.repeat(72));
  console.log('!! MOCK_MODE IS ON. The Worker short-circuits to canned responses and');
  console.log('!! NEVER calls USCIS — so the demo_id header is NEVER sent upstream.');
  console.log('!! This run does NOT constitute demo evidence. Set MOCK_MODE = "0" in');
  console.log('!! wrangler.toml, redeploy, and re-run.');
  console.log('!'.repeat(72));
}

const { source, list } = loadReceipts();
console.log(`\nReceipts : ${list.length} from ${source} → ${list.map(mask).join(', ')}`);
console.log(`Throttle : ${THROTTLE_MS}ms between requests (sandbox quota 5 TPS)`);

const results = [];
for (let i = 0; i < list.length; i++) {
  results.push(await probe(`sandbox receipt #${i + 1}`, list[i]));
  await new Promise((r) => setTimeout(r, THROTTLE_MS));
}
// Worker-side validation probe: rejected locally with 422, never reaches USCIS.
results.push(await probe('malformed input (local 422 check)', null));

const end = stamps();
console.log('\n' + '-'.repeat(72));
console.log('SUMMARY');
for (const r of results) {
  const reached = mock
    ? 'no (mock mode)'
    : r.status === 422 ? 'no (rejected by Worker)'
    : r.status === 0 ? 'unknown (transport failure)'
    : 'yes — demo_id sent';
  console.log(`  HTTP ${String(r.status).padEnd(4)} ${r.label.padEnd(34)} upstream: ${reached}`);
}
console.log(`\nWindow   : ${start.line}`);
console.log(`         → ${end.line}`);
console.log(mock
  ? '\nRESULT: NOT valid demo evidence — mock mode was on.'
  : '\nRESULT: rows marked "demo_id sent" carry the demo_id header to USCIS.');
process.exit(mock ? 1 : 0);
