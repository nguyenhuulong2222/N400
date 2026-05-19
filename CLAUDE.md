# CLAUDE.md

Guidance for Claude Code working in this repository.

## What this is

A free, single-page web app that drills the U.S. naturalization civics test (Form N-400). It's a static `index.html` — no build step, no dependencies, no backend — deployed to Cloudflare Pages.

- Repo: https://github.com/nguyenhuulong2222/N400
- Cloudflare Pages project name: `n400`

## Project layout

```
/
  index.html        ← the entire app (HTML + CSS + JS + question data, ~1150 lines)
  CLAUDE.md
  .wrangler/        ← local Cloudflare Wrangler state
  .claude/          ← Claude Code project settings
```

No package.json, no bundler, no test runner. Edit `index.html` directly.

## Architecture (within index.html)

Three screens, swapped via the `.active` class:

1. `#screen-onboard` — pick test version (2025 / 2008 / 65-20) and display language.
2. `#screen-quiz` — render one question at a time with 4 shuffled options (1 correct + 3 distractors).
3. `#screen-result` — pass/fail verdict with stats.

State lives in a single `state` object. `ROUTE_CONFIG` holds per-route thresholds:

| Route | Pool (claimed) | Asked | Pass | Fail | Notes |
|-------|----------------|-------|------|------|-------|
| 2025  | 128            | 20    | 12   | 9    | Standard 2025 civics test |
| 2008  | 100            | 10    | 6    | 5    | Pre-Oct-2025 applicants (placeholder bank) |
| 65/20 | 20             | 10    | 6    | 5    | Age 65+, 20yr LPR — starred subset |
| 50/20 | 128            | 20    | 12   | 9    | Age 50+, 20yr LPR — English exempt only |
| 55/15 | 128            | 20    | 12   | 9    | Age 55+, 15yr LPR — English exempt only |

`QUESTIONS_2025` is the canonical 128-question array. `QUESTIONS["2025"]` is the same array minus any `excluded:true` entries (currently just Q29). `QUESTIONS["6520"]` is the 20 questions with `starred:true` (the USCIS ★ subset for 65/20). `QUESTIONS["5020"]` and `QUESTIONS["5515"]` reuse the full 2025 bank — the 50/20 and 55/15 exemptions waive only the English requirement, not the civics test itself (the user simply answers in their native language with their own interpreter). `QUESTIONS["2008"]` is still a slice-view placeholder of the 2025 bank — see Known gaps.

## Question record shape

```js
{
  id: 1,
  q: "English question text",
  a: ["accepted answer 1", "accepted answer 2", ...],   // any one accepts; omitted for stateField/dynamic
  distractors: ["wrong 1", "wrong 2", "wrong 3"],       // 3 used per render; omitted for stateField (generated)

  // 65/20 subset marker:
  starred: true,

  // Time-sensitive federal officials. resolveQuestion() looks up CURRENT_OFFICIALS[officialField]:
  dynamic: true, officialField: "president" | "vp" | "speaker" | "chiefJustice",
  dynamic_note: "shown as a red note in the question card",

  // State-specific. resolveQuestion() looks up STATE_DATA[userState][stateField]:
  stateField: "senators" | "governor" | "capital",
  helpNote: "shown as a navy note in the question card",

  // Skip this question from the asked pool entirely (e.g. needs data we don't ship):
  excluded: true
}
```

Render-time substitution lives in `resolveQuestion(q, stateKey)`. The result is stashed in `state.currentRenderedQ` so `selectAnswer` can grade against the substituted accepted-answer list.

## Answer-matching gotcha

`selectAnswer` checks correctness with bidirectional substring containment on a normalized form (`norm()` strips to lowercase alphanumerics):

```js
q.a.some(a => norm(chosen).includes(norm(a)) || norm(a).includes(norm(chosen)))
```

This is fragile. When adding a new question, ensure no distractor's normalized form contains (or is contained by) any accepted answer's normalized form, or correctness will be miscalled.

## Known gaps and bugs

- **2008 bank is a placeholder.** `QUESTIONS["2008"]` is currently `slice(0, 15)` of the 2025 bank. The real 2008 USCIS bank is its own 100-question set with different officials; not yet shipped.
- **Q29 (your U.S. representative) is excluded.** It needs district-level data (435 reps, frequent turnover); we don't ship that table. Question is marked `excluded:true` and filtered from the asked pool.
- **Officials data goes stale.** `CURRENT_OFFICIALS` and `STATE_DATA` were sourced ~2026-01 (`DATA_AS_OF` constant). They drift after every election — needs periodic refresh. The dynamic-Q `q-note` and the state-Q `q-note-help` link out to uscis.gov/testupdates so users can verify before their interview.
- **Translations are English-only.** UI still offers en/vi/es/zh/tl/ko buttons; the underlying question data has no per-language `vi`/`es`/etc. strings. Toggles are dead until translations are added back.
- **Speech is English-only.** `speakText` hardcodes `u.lang='en-US'` regardless of selected display language.
- **No progress persistence.** Refresh during a quiz wipes state — no localStorage.

## Conventions

- Vanilla JS, no frameworks. Keep it that way unless explicitly approved.
- Inline `onclick=` handlers match the existing style. Don't introduce a framework for one feature.
- All styling lives in the `<style>` block. CSS custom properties (`--navy`, `--red`, `--white`, etc.) define the palette — reuse them.
- Visual tone: sober, patriotic (flag stripe; navy/red/white; Playfair Display + Source Serif 4). Don't add emoji-heavy UI beyond what's already there.
- The legal disclaimer ("Not affiliated with USCIS") must stay visible. Don't remove it.

## Deploy

The site is a Cloudflare Pages project named `n400`.

```bash
# List recent deployments
wrangler pages deployment list --project-name=n400

# Deploy current directory to production
wrangler pages deploy . --project-name=n400 --branch=main
```

If the GitHub integration is wired up, pushes to `main` trigger Pages builds automatically.

## When making changes

- Single-file edits. No test suite — manually open `index.html` in a browser and walk the full flow (onboard → quiz → result → restart) before calling a change done.
- If you add a new question, mentally check the answer-matching gotcha above.
- Don't introduce build tooling without asking first.
