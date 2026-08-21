@AGENTS.md

# App identity

| Field | Value |
|---|---|
| Display name | `N-400 Citizenship Test` |
| iOS bundle id | `org.formn400.app` |
| Android package | `org.formn400.app` |
| Version | `1.0.0` (buildNumber assigned by EAS — `appVersionSource: remote` + `autoIncrement`) |

Keep `app.json`, `src/screens/OnboardScreen.tsx` (screen title),
`src/screens/AboutScreen.tsx` (version line reads from `app.json`), and
`docs/app-store-metadata.md` in agreement whenever any of these change.

# Non-negotiables inherited from the web app

The seven invariants in `../CLAUDE.md` apply here verbatim. The two that
have bitten this codebase already:

- **Invariant IV** — no current-officeholder name may appear in any answer
  or distractor, in any language. Dynamic and state-officeholder questions
  ship with empty `a[]`/`distractors[]` and render as Study Cards that link
  to uscis.gov/citizenship/testupdates. `resolveQuestion` enforces this
  structurally; do not add a code path that grades them.
- **Invariant VIII** — zero personal data collection. No AsyncStorage, no
  localStorage, no analytics, no crash SDK, no network request the app
  initiates. `expo-updates` was removed in Phase 1 for exactly this reason:
  its OTA check was the only outbound call at cold start. The only network
  activity is a link the user taps, opened in the system browser.

# The index-0 contract (read before touching buildViewModel.ts)

`a[]` and `<lang>_a[]` in `data.json` are **not** index-aligned. 112 of the
228 questions have differing lengths across the 13 non-English languages,
and beyond index 0 the entries frequently describe different facts.

The displayed correct option is therefore **always index 0** — English
`a[0]` paired with `<lang>_a[0]` — matching the web app at
`index.html:6417` / `:6426`. Never pick a random accepted index.

Distractors ARE index-aligned (0 mismatches across every language) and keep
their random selection.

`scripts/test-answer-alignment.ts` guards this across every question × 14
languages × 8 RNG seeds. Run `npm run test:alignment` after any change to
`buildViewModel.ts` or `i18n/localize.ts`.

# Data

`data.json` is generated from the web source by `../tools/build-app-data.js`
and copied here by `npm run sync-data`. Do not hand-edit it. The exporter
allowlists the 14 shipped languages (`en vi es zh tl ko hi ht th lo hmn my
pt ru`) out of the larger `LANG_META` in `index.html`.

# Commands

```
npm run smoke:quiz        # quiz-engine smoke suite
npm run test:alignment    # correct-option index-0 alignment guard
npx expo-doctor           # project health
npx expo start --ios      # run on simulator
```
