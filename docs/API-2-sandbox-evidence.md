# API-2 — USCIS Sandbox Evidence Log

Evidence trail for the USCIS **production access gate**: USCIS requires
**≥5 consecutive calendar days** of sandbox traffic with **both 200 and 4xx**
responses demonstrably tested before granting production access.

- **Worker:** `workers/api/` (`formn400-api`) — public contract `POST /case-status` (receipt in body).
- **Test runner:** `workers/api/scripts/sandbox-test-plan.mjs` (tests through the Worker's own logic).
- **Sandbox endpoints:** token `https://api-int.uscis.gov/oauth/accesstoken` · case `https://api-int.uscis.gov/case-status/{receiptNumber}`.
- **Sandbox quota:** 5 TPS / 1,000 per day — runner throttles to 1 req / 250 ms, ~7 upstream calls per run.
- **PII:** only official sandbox sample receipts (fake) are used. No real user receipt appears here, ever.

## How to run (Long runs these)

```bash
cd workers/api
# one-time: create .dev.vars (gitignored) OR export the two vars for the shell
USCIS_CLIENT_ID=... USCIS_CLIENT_SECRET=... node scripts/sandbox-test-plan.mjs
```

The runner prints a PASS/FAIL table, a token-reuse count (expect 1), and class
coverage (hist / nohist / 404 / 422). It exits non-zero on any failure.

After each live run, append a row to the **Gate log** below (date, classes seen,
status codes, pass/fail, notes). Five consecutive dated rows with 200 + 4xx
satisfy the gate.

## Diagnosing a 503 from the runner

The Worker maps upstream 401 / 5xx / timeout → **503**, so a 503 in the table is
ambiguous. Do **not** retry-storm. To see the raw upstream status, run the
lower-level probe (it surfaces 401/404/422/429/502 directly):

```bash
cd workers/api
USCIS_CLIENT_ID=... USCIS_CLIENT_SECRET=... npm run test:uscis-sandbox
```

- Raw **502/503** from USCIS → log as **UPSTREAM OUTAGE** (USCIS posted a
  "502 Gateway Errors for Case Status API (Sandbox)" notice). Not a Worker bug.
- Raw **401/403** → credential or app-subscription problem. **Stop and report** —
  do not loop.

## Gate log

| Day | Date (YYYY-MM-DD) | Mode | 200 hist | 200 no-hist | 404 | 422 | Token fetches | Upstream issues | Pass/Fail | Notes |
|-----|-------------------|------|----------|-------------|-----|-----|---------------|-----------------|-----------|-------|
| 0   | 2026-06-15        | MOCK (dry run) | ✅ 3/3 | ✅ 3/3 | ✅ 1/1 | ✅ 2/2 | 0 (mock) | none | **PASS** | Wiring check only — no creds, no USCIS calls. Does **not** count toward the 5-day gate. Confirms the runner matrix + Worker contract are correct. |
| 1   |                   | LIVE |          |             |     |     |               |                 |           | First real sandbox run — start of the 5-day gate. |
| 2   |                   | LIVE |          |             |     |     |               |                 |           |       |
| 3   |                   | LIVE |          |             |     |     |               |                 |           |       |
| 4   |                   | LIVE |          |             |     |     |               |                 |           |       |
| 5   |                   | LIVE |          |             |     |     |               |                 |           |       |

> Gate met when Days 1–5 are consecutive calendar days, each PASS, with at least
> one 200 and one 4xx observed across the window (the runner covers both every run).

## 200 shape deltas vs. the API-1 mock

The runner diffs each live 200's `case_status` keys against the mock's modeled
fields and prints `SHAPE DELTA extra:` / `missing:` notes. Record any deltas here
so we decide together whether to adjust the mock / frontend (do **not** reshape
the mock without sign-off).

| Date | Receipt class | Delta observed | Decision |
|------|---------------|----------------|----------|
| _none yet_ | | | |

## Day 1 — 2026-06-16 (HST)
- Run: `npm run test:sandbox-plan` (LIVE sandbox, in-window)
- Result: 9/9 ALL PASS
- Classes: hist (200, hist=2), nohist (200, hist=null), 404, 422
- Token fetches: 1 (reused)
- Status codes observed: 200, 404, 422 (both 200 and 4xx ✓)
- Shape delta: none
- Notes: First valid run. Post hist_case_status null-fix (commit db988a2).
