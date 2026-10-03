#!/usr/bin/env node
// Demonstrate rate limiting: fire N concurrent POST /case-status requests and
// print one line per response.
//
// WHY THE DEFAULT IS 25, NOT 8
// The limiter allows 20 requests per 60 seconds per connection
// (wrangler.toml [[ratelimits]]). A burst of 8 can never exceed 20, so a
// smaller default would print eight successes and prove nothing. 25 clears the
// limit by five.
//
// Cloudflare counts rate limits PER LOCATION, not globally, so this must be run
// from one machine; requests spread across several Cloudflare colos would be
// counted separately and might all succeed.
//
// AFTER A BURST: wait a full 60 seconds before the next lookup from the same
// connection, or it will still be throttled.
//
// PRIVACY (API Invariant II): the receipt comes from the RECEIPT env var, goes
// straight into the POST body, and is never printed, never logged, and never
// placed in a URL. Only the timestamp, HTTP status, `source` and
// `errors[0].code` are printed — never a response body.

const BASE_URL = process.env.BASE_URL ?? 'https://api.formn400.org';
const RECEIPT = process.env.RECEIPT ?? '';
const N = Number(process.env.N ?? process.argv[2] ?? 25);

if (!RECEIPT) {
  console.error('RECEIPT is required. Use an official USCIS sandbox sample, e.g.:');
  console.error('  RECEIPT=EAC9999103403 npm run demo:429');
  process.exit(2);
}
if (!Number.isInteger(N) || N < 1 || N > 200) {
  console.error(`N must be an integer between 1 and 200 (got ${process.env.N ?? process.argv[2]}).`);
  process.exit(2);
}

console.log(`POST ${BASE_URL}/case-status  ×${N} concurrent`);
console.log('limiter: 20 per 60s per connection, counted per Cloudflare location');
console.log('');
console.log('timestamp                 status  source  code');
console.log('------------------------- ------- ------- --------------------');

const one = async () => {
  const sentAt = new Date().toISOString();
  try {
    const res = await fetch(`${BASE_URL}/case-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Receipt in the BODY only.
      body: JSON.stringify({ receiptNumber: RECEIPT }),
    });
    let source = '-';
    let code = '-';
    try {
      const json = await res.json();
      // Only these two fields are ever read out of the body.
      if (typeof json?.source === 'string') source = json.source;
      const first = Array.isArray(json?.errors) ? json.errors[0] : null;
      if (first && (typeof first.code === 'string' || typeof first.code === 'number')) {
        code = String(first.code);
      }
    } catch {
      /* 200 bodies and non-JSON bodies are deliberately not inspected. */
    }
    return { sentAt, status: String(res.status), source, code };
  } catch {
    // Network/DNS failure. The error object can reference the request, so it is
    // never printed or logged.
    return { sentAt, status: 'ERR', source: '-', code: 'network' };
  }
};

const results = await Promise.all(Array.from({ length: N }, one));
for (const r of results) {
  console.log(`${r.sentAt} ${r.status.padStart(7)} ${r.source.padEnd(7)} ${r.code}`);
}

const tally = results.reduce((acc, r) => {
  const k = `${r.status} ${r.source}/${r.code}`;
  acc[k] = (acc[k] ?? 0) + 1;
  return acc;
}, {});
console.log('');
console.log('tally:');
for (const [k, n] of Object.entries(tally).sort()) console.log(`  ${n.toString().padStart(3)} × ${k}`);

const limited = results.filter((r) => r.status === '429');
const worker429 = limited.filter((r) => r.source === 'worker').length;
const uscis429 = limited.filter((r) => r.source === 'uscis').length;
console.log('');
console.log(`429 total: ${limited.length}  (worker RATE_LIMITED: ${worker429}, USCIS Spike Arrest: ${uscis429})`);
if (limited.length === 0) {
  console.log('No 429 seen. Either N is below the limit, the window had already reset,');
  console.log('or the requests were spread across more than one Cloudflare location.');
}
console.log('Wait 60 seconds before the next lookup from this connection.');
