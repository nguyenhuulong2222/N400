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

### `POST /case-status` status codes

A non-200 upstream status is **passed through**, not collapsed. The response
envelope is the same in every case:

```json
{ "ok": false, "error": "<our code>", "message": "<our fallback>",
  "status": 404, "source": "uscis", "errors": [ /* whitelisted USCIS items */ ] }
```

`ok` / `error` / `message` are retained for the already-deployed frontend;
`status` / `source` / `errors` are additive. `source` is `"uscis"` when the
status came from upstream and `"worker"` when we produced it ourselves — which
is what tells a USCIS 429 (`Spike Arrest Violation`) apart from our own
rate limiter.

| Status | `source` | `error` | When |
|---|---|---|---|
| 200 | — | — | Case found. Upstream body passed through verbatim. |
| 401 | `uscis` | `uscis_auth_failed` | Upstream rejected the token. The cached token is dropped so the next lookup re-authenticates. |
| 401 | `worker` | `uscis_auth_failed` | The OAuth token request itself failed 400/401. The token response body is never read. |
| 404 | `uscis` | `case_not_found` | No case for that receipt. Also returned by USCIS for individuals protected under 8 U.S.C. 1367. |
| 422 | `worker` | `invalid_receipt_format` | Our own validation rejected the format before any upstream call. |
| 422 | `uscis` | `invalid_receipt_format` | Upstream rejected the format (e.g. an unrecognised 3-letter prefix). |
| 429 | `worker` | `rate_limited` | Our rate limiter: more than 20 lookups in 60s from one connection. |
| 429 | `uscis` | `rate_limited` | USCIS TPS or daily quota exceeded. |
| 502 | `worker` | `upstream_unparseable` | Upstream returned 200 with syntactically invalid JSON (a known USCIS sandbox defect). |
| 503 | `uscis` | `service_unavailable` | Sandbox closed, or upstream outage. |
| 503 | `worker` | `service_unavailable` | Misconfiguration, or we could not reach USCIS at all. |
| 504 | `worker` | `upstream_timeout` | Upstream did not answer within 10 seconds. |

The published spec documents exactly six responses — **200, 401, 404, 422, 429,
503** (`https://developer.uscis.gov/sites/default/files/apidoc_specs/swagger_3.yaml`).
Anything else, including 500, is undocumented; it is still passed through rather
than hidden, because an unexplained status is more useful to us than a
misleading one.

Every string passed through from upstream is whitelisted to `code`, `message`,
`category`, `reference`, `status`, `traceId` (max 10 items) and
receipt-masked — `EAC9999103403` becomes `EAC*******403`.

### Error body shapes

USCIS does not use one error envelope. All of these normalise to `errors[]`:

| Shape | Where it came from |
|---|---|
| `{ "code": 503, "message": "…" }` | the published spec's own examples |
| `{ "errors": [ … ] }` | the Torch Production Access page (RFC 9457) |
| `{ "error": { "code": "503", "message": "…" } }` | **the live sandbox** — captured 2026-10-03 09:34 UTC. `code` is a string here, not an int |
| `{ "error": [ … ] }` | defensive, not observed |
| `{ "error": "invalid_token" }` | defensive, not observed — the string becomes `message`, no code is invented |

An unrecognised body degrades to `errors: []` plus our own message — never a
crash, never a guess.

## CORS

The allowlist is hardcoded in `src/cors.ts` (API Invariant V). No environment
variable, binding or `wrangler.toml` value can widen it.

| Origin | On `api.formn400.org` | On a local Worker |
|---|---|---|
| `https://formn400.org` | allowed | allowed |
| `https://www.formn400.org` | allowed | allowed |
| `http://localhost:8765` | **refused** | allowed |
| anything else | refused | refused |

"Local Worker" means the request's own hostname is `localhost` or `127.0.0.1`,
which is true under `wrangler dev` and never true in production. A request with
no `Origin` header — native mobile, which is not governed by browser CORS — is
served normally and simply gets no `Access-Control-Allow-Origin`.

## Demonstrating each response code locally

### 429 — our rate limiter

```bash
RECEIPT=EAC9999103403 npm run demo:429
```

25 concurrent requests against a limit of 20 per 60 seconds. It prints
timestamp, status, `source` and `errors[0].code` per response — never a body and
never the receipt. **Wait a full 60 seconds before the next lookup from the same
connection**, or it will still be throttled. Cloudflare counts limits per
location, so run it from one machine. Point it at a local Worker with
`BASE_URL=http://localhost:8787` to avoid spending the USCIS quota.

### 401 — a real authentication failure

```bash
cd workers/api
# .dev.vars (gitignored). Use a deliberately WRONG secret:
#   USCIS_CLIENT_ID=<real id>
#   USCIS_CLIENT_SECRET=deliberately-wrong
# and set MOCK_MODE = "0" in wrangler.toml [vars] for the session.
npm run dev
curl -s -X POST localhost:8787/case-status \
  -H 'Content-Type: application/json' -d '{"receiptNumber":"EAC9999103403"}'
# → 401 { "source": "worker", "errors": [{ "code": "USCIS_AUTH_FAILED", … }] }
```

The token response body is never read, so a wrong secret can never be echoed
back. An upstream 401 on the case-status call (rather than the token call)
reports `source: "uscis"` and carries USCIS's own `Invalid Access Token`
message.

### 404 / 429 / 503 — canned USCIS-shaped errors (MOCK_MODE only)

With `MOCK_MODE = "1"`, these reserved receipts return the spec's own example
bodies, each suffixed `(Mock — simulated USCIS error)`, routed through the real
passthrough code:

| Receipt | Result |
|---|---|
| `MCK0000000401` | 401 `Invalid Access Token` |
| `MCK0000000404` | 404 `Case Status Online does not recognize the receipt number entered.…` |
| `MCK0000000429` | 429 `Spike Arrest Violation` |
| `MCK0000000503` | 503 — the **real captured sandbox body**, `{"error":{…}}` with its leading whitespace: "The Case Status API Sandbox is unavailable at this time…" |
| `MCK0000009457` | 400 in the RFC 9457 `errors[]` shape; its message contains a receipt, which must come back masked as `EAC*******403` |
| `MCK0000000500` | 500 — **undocumented code, for tests only. Not part of the demo.** |

```bash
curl -s -X POST localhost:8787/case-status \
  -H 'Content-Type: application/json' -d '{"receiptNumber":"MCK0000000503"}'
```

Production sets `MOCK_MODE = "0"`, so none of these are reachable there.

## Local run (no credentials needed — MOCK_MODE)

`wrangler.toml` ships `MOCK_MODE = "0"` (the live USCIS path), so pass the
override to run without credentials:

```bash
cd workers/api
npm install
npm run dev -- --var MOCK_MODE:1
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
3. Deploy (only on explicit approval):
   ```bash
   npx wrangler deploy
   curl https://api.formn400.org/health   # → { "ok": true, ..., "mock": false }
   ```

## Files

| File | Purpose |
|------|---------|
| `src/index.ts`      | Router, CORS wiring, validation, mock vs live dispatch, error mapping |
| `src/env.ts`        | `Env` shape + `isMockMode()` |
| `src/receipt.ts`    | Pure receipt validation and normalization |
| `src/cors.ts`       | Hardcoded origin allowlist + JSON/preflight helpers |
| `src/mock.ts`       | Canned sandbox responses + reserved MOCK_MODE demo receipts |
| `src/errors.ts`     | Upstream error whitelist, receipt masking, client envelope |
| `src/auth.ts`       | OAuth client-credentials token manager (in-memory cache) |
| `src/caseStatus.ts` | Upstream `GET {base}/{receipt}` call |
| `scripts/test-uscis-sandbox.mjs` | Local-only sandbox smoke test (redacted) |
| `scripts/demo-429-burst.mjs` | Rate-limit demonstration (`npm run demo:429`) |
| `test/*.test.mjs`   | Unit + handler tests (no network) |
