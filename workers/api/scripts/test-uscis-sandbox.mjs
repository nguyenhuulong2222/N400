// Local-only smoke test for the USCIS Case Status API **sandbox**.
//
// Purpose: verify the OAuth client-credentials flow and a single sandbox
// case-status lookup work end-to-end, BEFORE wiring any of this into the Worker
// (src/uscis.ts) or the frontend. This file is never bundled into the Worker and
// never deployed.
//
// SECURITY (API Invariants I & II):
//   - Secrets come from env only (USCIS_CLIENT_ID / USCIS_CLIENT_SECRET).
//   - The Client Secret is NEVER printed.
//   - The access token is NEVER printed in full — only a redacted preview.
//   - Only the OFFICIAL sandbox sample receipt (EAC9999103403) is used. Never a
//     real user's receipt number.
//
// Run (env vars required — do NOT commit them):
//   cd workers/api
//   USCIS_CLIENT_ID=... USCIS_CLIENT_SECRET=... npm run test:uscis-sandbox

// ---- Confirmed official sandbox values (from the USCIS Developer Portal) ----
const TOKEN_URL = 'https://api-int.uscis.gov/oauth/accesstoken';
const CASE_STATUS_BASE = 'https://api-int.uscis.gov/case-status';
const SCOPE = 'read';
// Official sandbox sample receipt — safe to use. NOT a real user's number.
const SAMPLE_RECEIPT = 'EAC9999103403';

/** Redact a token for logging: first 6 chars + "...redacted". Never log the rest. */
function redactToken(token) {
  if (typeof token !== 'string' || token.length === 0) return '(empty)';
  return `${token.slice(0, 6)}...redacted`;
}

/** Human-readable hint for the documented sandbox error codes. */
function errorHint(status) {
  switch (status) {
    case 401: return 'invalid/expired token';
    case 404: return 'receipt not recognized or protected case';
    case 422: return 'invalid receipt format/prefix';
    case 429: return 'quota exceeded (5 TPS / 1,000 daily sandbox)';
    case 503: return 'sandbox unavailable outside M–F 7 AM–8 PM EST';
    default:  return '';
  }
}

async function getAccessToken(clientId, clientSecret) {
  // OAuth 2.0 client-credentials grant. Credentials are sent via HTTP Basic auth
  // (base64 of "id:secret") per RFC 6749 — never echoed back in any log.
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const body = new URLSearchParams({ grant_type: 'client_credentials', scope: SCOPE });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body,
  });

  console.log(`OAuth token request → HTTP ${res.status}${errorHint(res.status) ? ` (${errorHint(res.status)})` : ''}`);

  if (!res.ok) {
    // Print status only — never the response body (it can echo credentials).
    throw new Error(`Token request failed with HTTP ${res.status}`);
  }

  const json = await res.json();
  const token = json.access_token ?? json.accessToken;
  if (!token) {
    throw new Error('Token response did not contain an access_token field.');
  }
  console.log(`Access token acquired: ${redactToken(token)}`);
  return token;
}

async function getCaseStatus(token) {
  // Receipt numbers are sensitive immigration identifiers; this is the OFFICIAL
  // sandbox sample only, so it is safe to place in the URL here. Never do this
  // with a real user's receipt number.
  const url = `${CASE_STATUS_BASE}/${SAMPLE_RECEIPT}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`, // token value never logged
      Accept: 'application/json',
    },
  });

  console.log(`Case status request → HTTP ${res.status}${errorHint(res.status) ? ` (${errorHint(res.status)})` : ''}`);

  if (!res.ok) {
    throw new Error(`Case status request failed with HTTP ${res.status}`);
  }

  const json = await res.json();
  const cs = json.case_status ?? {};
  const history = Array.isArray(cs.hist_case_status) ? cs.hist_case_status : [];

  // Minimal response shape — no full dump, no secrets, no token.
  console.log('\nMinimal response shape:');
  console.log(`  formType:                    ${cs.formType ?? '(none)'}`);
  console.log(`  current_case_status_text_en: ${cs.current_case_status_text_en ?? '(none)'}`);
  console.log(`  submittedDate:               ${cs.submittedDate ?? '(none)'}`);
  console.log(`  modifiedDate:                ${cs.modifiedDate ?? '(none)'}`);
  console.log(`  history count:               ${history.length}`);
}

async function main() {
  const clientId = process.env.USCIS_CLIENT_ID;
  const clientSecret = process.env.USCIS_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('Missing credentials. Set USCIS_CLIENT_ID and USCIS_CLIENT_SECRET in the environment.');
    console.error('Example:');
    console.error('  USCIS_CLIENT_ID=... USCIS_CLIENT_SECRET=... npm run test:uscis-sandbox');
    process.exit(1);
  }

  console.log('USCIS Case Status API — sandbox smoke test');
  console.log(`Token endpoint:  ${TOKEN_URL}`);
  console.log(`Case endpoint:   ${CASE_STATUS_BASE}/${SAMPLE_RECEIPT}`);
  console.log(`Scope:           ${SCOPE}\n`);

  const token = await getAccessToken(clientId, clientSecret);
  await getCaseStatus(token);

  console.log('\nDone. (No secret or full token was printed.)');
}

main().catch((err) => {
  // err.message is constructed from status codes only — never includes secrets/token.
  console.error(`\nError: ${err.message}`);
  process.exit(1);
});
