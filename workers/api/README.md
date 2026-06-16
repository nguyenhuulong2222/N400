# formn400-api (Cloudflare Worker)

Proxies the official **USCIS Case Status API** so the USCIS Client ID / Client
Secret never reach the browser or the mobile app. This Worker serves **no**
question / quiz / civics data — that lives in the pure-static web app.

> The receipt number travels in the **POST body**, never in the URL
> (API Invariant II). It is never logged, stored, cached, or echoed back in any
> error.

## Routes

| Method | Path           | Body                       | Response |
|--------|----------------|----------------------------|----------|
| GET    | `/health`      | —                          | `{ ok, service, version, mock }` |
| GET    | `/`            | —                          | `{ ok, service, message, mock }` |
| POST   | `/case-status` | `{ "receiptNumber": "…" }` | upstream `case_status` payload, or a clean error envelope |
| OPTIONS| *              | —                          | CORS preflight (204) |

`POST /case-status` status codes: `200` (case found), `422` (bad/empty receipt
format), `404` (no case for that receipt), `429` (rate limited), `503` (token or
upstream problem — never the client's fault, never leaks detail).

## Local run (no credentials needed — MOCK_MODE)

```bash
cd workers/api
npm install
npm run dev        # wrangler dev; MOCK_MODE=1 from wrangler.toml [vars]
```

Smoke-test the mock (in another shell):

```bash
# health
curl -s localhost:8787/health

# 200 WITH history
curl -s -X POST localhost:8787/case-status \
  -H 'Content-Type: application/json' -d '{"receiptNumber":"EAC9999103403"}'

# 200 WITHOUT history
curl -s -X POST localhost:8787/case-status \
  -H 'Content-Type: application/json' -d '{"receiptNumber":"EAC9999103400"}'

# 422 bad format (receipt NOT echoed)
curl -s -X POST localhost:8787/case-status \
  -H 'Content-Type: application/json' -d '{"receiptNumber":"ABC123"}'

# 404 valid format, not a known sandbox receipt
curl -s -X POST localhost:8787/case-status \
  -H 'Content-Type: application/json' -d '{"receiptNumber":"EAC0000000000"}'
```

## Tests (no network, no creds)

```bash
cd workers/api
npm test          # pure receipt classifier + direct worker.fetch() handler tests
```

## Going live (Long runs these — not the agent)

1. Set the secrets (never committed, never logged):
   ```bash
   cd workers/api
   npx wrangler secret put USCIS_CLIENT_ID
   npx wrangler secret put USCIS_CLIENT_SECRET
   ```
2. Verify the OAuth + sandbox lookup end-to-end (local script, redacted output):
   ```bash
   USCIS_CLIENT_ID=… USCIS_CLIENT_SECRET=… npm run test:uscis-sandbox
   ```
3. Turn off mock and deploy (only on explicit approval):
   ```bash
   # set MOCK_MODE = "0" in wrangler.toml [vars], then:
   npx wrangler deploy
   curl https://api.formn400.org/health   # → { "ok": true, ..., "mock": false }
   ```

## Files

| File | Purpose |
|------|---------|
| `src/index.ts`      | Router, CORS wiring, validation, mock vs live dispatch, error mapping |
| `src/env.ts`        | `Env` shape + `isMockMode()` |
| `src/receipt.ts`    | Pure receipt validation/normalization (synced with `index.html`'s `csClassifyReceipt`) |
| `src/cors.ts`       | Hardcoded origin allowlist + JSON/preflight helpers |
| `src/mock.ts`       | Canned sandbox responses for MOCK_MODE |
| `src/auth.ts`       | OAuth client-credentials token manager (in-memory cache) |
| `src/caseStatus.ts` | Upstream `GET {base}/{receipt}` call |
| `scripts/test-uscis-sandbox.mjs` | Local-only sandbox smoke test (redacted) |
| `test/*.test.mjs`   | Unit + handler tests (no network) |
