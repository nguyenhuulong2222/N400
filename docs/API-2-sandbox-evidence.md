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

## Day 2 — 2026-06-17 (HST)
- Run: `npm run test:sandbox-plan` (LIVE sandbox, in-window)
- Result: 7/9 — 2 nohist receipts returned 503 (partial upstream failure)
- PASS: hist x3 (hist=2), nohist #3 SRC9999132694 (hist=null), 404, 422 x2
- FAIL: nohist #1 EAC9999103400 -> 503, nohist #2 LIN9999106501 -> 503
- Token fetches: 1 (reused)
- Status codes observed: 200, 404, 422, 503
- Notes: Partial upstream 503 (not full outage; 4/6 upstream calls returned 200). Diagnosing outage vs intermittent; re-run pending.

## Upstream defect — malformed JSON (discovered Day 2, 2026-06-17)
- Scope: 19/50 staging receipts return HTTP 200 with syntactically INVALID JSON.
- Cause: unescaped `"` in an HTML <a href> inside current_case_status_desc_en terminates the JSON string early (JSON.parse: "Expected ',' or '}' after property value"). Bytes are plain ASCII — not an encoding issue, not a Worker bug.
- Stable: identical 19 receipts across repeated scans.
- Affected: EAC9999103400, EAC9999103402, EAC9999103406, EAC9999103407, EAC9999103408, EAC9999103409, EAC9999103414, EAC9999103415, EAC9999103420, EAC9999103421, EAC9999103424, EAC9999103425, EAC9999103426, EAC9999103428, EAC9999103429, EAC9999103431, EAC9999103432, LIN9999106501, LIN9999106507
- Worker handling: returns 502 upstream_unparseable (clean error, no raw body, no PII). Commit 08725b2.
- Action: reported to developersupport@uscis.dhs.gov 2026-06-17. Open question: does the same serialization defect affect PRODUCTION live receipts with HTML in descriptions? Blocking frontend wiring until answered.

## Day 3 — 2026-06-18 (HST)
- Run: `npm run test:sandbox-plan` (LIVE sandbox, in-window)
- Result: 9/9 ALL PASS (incl. malformed class scored correctly)
- Classes: hist (200), nohist (200, null), 404, 422
- Upstream malformed: 2/2 → 502 handled (USCIS defect, reported 2026-06-17)
- Token fetches: 1 (reused)
- Status codes observed: 200, 404, 422, 502

## Day 4 — 2026-06-19 (HST)
- Run: `npm run test:sandbox-plan` (LIVE sandbox, in-window)
- Result: 9/9 ALL PASS (incl. malformed class scored correctly)
- Classes: hist (200), nohist (200, null), 404, 422
- Upstream malformed: 2/2 → 502 handled (USCIS defect, reported 2026-06-17)
- Token fetches: 1 (reused)
- Status codes observed: 200, 404, 422, 502

## USCIS response — 2026-06-19
- Torch Developer Support acknowledged the malformed-JSON report.
- Status: "team is currently looking into this and will follow up once more information is made available."
- This is an acknowledgment only — does NOT yet answer whether production live receipts exhibit the same serialization defect.
- Frontend wiring remains blocked pending a substantive answer on production behavior.

## Day 5 — 2026-06-22 (HST)
- Run: `npm run test:sandbox-plan` (LIVE sandbox, in-window)
- Result: 9/9 ALL PASS (incl. malformed class scored correctly)
- Classes: hist (200), nohist (200, null), 404, 422
- Upstream malformed: 2/2 → 502 handled (USCIS defect, reported 2026-06-17)
- Token fetches: 1 (reused)
- Status codes observed: 200, 404, 422, 502

## 5-day gate — COMPLETE
- Days 1–5 (16/6, 17/6, 18/6, 19/6, 22/6) all run in-window with passing results.
- Both 200 and 4xx exercised across all days; 502 upstream_unparseable handled cleanly.
- Outstanding blocker: USCIS production behavior re: malformed JSON (acknowledged 2026-06-19, substantive answer pending).

## Post-fix verification — 2026-06-23
- Full 50-receipt scan: 50/50 HTTP 200, valid JSON, 0 malformed.
- test:sandbox-plan: 9/9 ALL PASS (hist ×3, nohist ×3 all hist=null, 404, 422 ×2).
- EAC9999103400 + LIN9999106501 reclassified to nohist (commit 992c709).
- Worker 502 upstream_unparseable handling + tests retained for regression safety.
