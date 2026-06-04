# TestFlight / Internal-testing manual QA checklist

Walk through this list on a real device (iOS via TestFlight, Android via
Play Internal Testing) before promoting a build. Every item should pass
with no crashes, no missing strings, and no broken layout. Failure
modes worth catching: stale cache, missing bundle assets, native-layout
bugs that the iOS bundle smoke can't surface.

## First launch

- [ ] App opens directly to the **Practice** tab (no sign-in, no
      account screen).
- [ ] **Footer disclaimer** "Not affiliated with USCIS. Educational use
      only." is visible at the bottom of every screen.
- [ ] No "Loading…" screen lingers; first paint shows the route picker.

## Onboard — route selection

- [ ] All 6 routes appear with their askCount + pass threshold label:
      `2025 Test · 128 Questions`, `2008 Test · 100 Questions`,
      `65/20 · 2025 Starred Subset`, `65/20 · 2008 Starred Subset`,
      `50/20 Practice · Native Language`, `55/15 Practice · Native
      Language`.
- [ ] Tapping a route highlights it (navy border + light-blue fill).

## Onboard — language selection

- [ ] All 14 languages appear as pills with their flag emoji and native
      name: en, vi, es, zh, tl, ko, hi, ht, th, lo, hmn, my, pt, ru.
- [ ] Tapping a non-English language highlights it (navy fill + white
      text).
- [ ] No language pill is missing its label.

## Onboard — state picker

- [ ] "Skip" pill is selected by default.
- [ ] All 50 states + DC appear in alphabetical order.
- [ ] Tapping a state (e.g. California) highlights it; tapping "Skip"
      clears the selection.

## Practice flow — MCQ basics

- [ ] Tap "Start Practice" with route=2025, lang=en, state=Skip.
- [ ] Question 1 of 22 shows with English prompt + 4 options.
- [ ] Tap any option → green highlight on the correct option, "Correct."
      or "Not quite." feedback, and a "Next" button.
- [ ] Tap Next → Question 2 of 22 appears with a new prompt.
- [ ] Score counter in the header increments correctly (`correct / wrong`).

## Practice flow — bilingual rendering

- [ ] Restart with route=5020, lang=vi, state=Skip.
- [ ] Each prompt shows Vietnamese as the primary text with English as
      a smaller grey subtitle below.
- [ ] Each option shows Vietnamese primary + English subtitle.
- [ ] When the translation is suggested (vi_suggested:true), a small
      "Suggested translation" italic tag appears below the option.
- [ ] Tap an option — grading still works (the English string under the
      hood is what counts).
- [ ] Repeat for es, zh, tl, ko at least.

## Practice flow — Q62 capital question

- [ ] Restart with route=2025, lang=en, state=**California**.
- [ ] When Q62 appears, it renders as a normal MCQ (not a Study Card).
- [ ] Accepted answer is "Sacramento"; 3 distractors are other states'
      capitals (e.g. Albany, Austin, Topeka).
- [ ] No distractor contains placeholder text ("D.C. is not a state…",
      "no U.S.…", "does not have…", "not a state").
- [ ] Tap Sacramento → graded correct.

## Practice flow — Q62 capital with no state picked

- [ ] Restart with state=Skip.
- [ ] When Q62 appears, it renders as a **Study Card** (yellow card)
      titled "Study Card · State-specific" with body explaining that
      the question is state-dependent.
- [ ] Tapping Next on the study card does **not** increment correct
      or wrong.

## Practice flow — Q62 capital with DC

- [ ] Restart with state=**District of Columbia**.
- [ ] When Q62 appears, it renders as a Study Card (DC's capital field
      is a placeholder; the engine falls back safely).
- [ ] Score is not affected.

## Study Cards — dynamic officeholders

- [ ] At some point a Study Card appears for President / VP / Speaker /
      Chief Justice (yellow card) saying answers change after every
      election; pointing to uscis.gov/citizenship/testupdates.
- [ ] **No name** appears anywhere on the card (Invariant IV).
- [ ] Tapping Next does not affect score.

## Result screen

- [ ] After all 22 cards are seen, the Result screen shows:
      Pass / Did not pass / Incomplete verdict.
      MCQ score (correct / askCount).
      Stats row: MCQ answered, Correct, Wrong.
      "X cards seen including Y study cards" line.
- [ ] Tap "Try again" → returns to Onboard with route/lang/state
      preserved.

## Resources tab

- [ ] Tap "Resources" in the top tab bar.
- [ ] Three sections render: A. Official USCIS study materials,
      B. Before your interview, C. Useful links.
- [ ] Top disclaimer: "Links open official USCIS pages in your browser.
      This app is an independent study tool and is not affiliated with
      USCIS."
- [ ] Tap any link card (e.g. "USCIS Citizenship Resource Center") →
      the **system browser** opens (Safari on iOS, default browser on
      Android), not an in-app webview.
- [ ] All 10 link cards open `uscis.gov` subdomain URLs.
- [ ] No WebView is used anywhere.
- [ ] Tap "Practice" tab again → returns to the exact screen + question
      the user left (mid-quiz state preserved).

## Negative checks

- [ ] No WebView is rendered anywhere (Invariant: no in-app webview).
- [ ] No USCIS logo, no DHS seal, no Great Seal, no government insignia,
      no 🦅 used as a government symbol (Invariant VI).
- [ ] No officeholder names appear anywhere in the app (Invariant IV).
- [ ] No microphone or location permission prompt appears (the app does
      not request either).
- [ ] No analytics or telemetry network calls (verified via Charles or
      similar proxy if needed).

## Offline behavior / known limitations

- [ ] Toggle airplane mode → the quiz still works end-to-end (data is
      bundled).
- [ ] Tap any Resources link in airplane mode → the system browser will
      show its own offline error. This is acceptable — the app itself
      does not fetch anything over the network.
- [ ] Refresh / kill the app → progress is lost (in-memory only, no
      persistence). This is documented behavior for this build.
- [ ] Current-officials data is bundled at build time; the app does not
      auto-refresh. Future builds will need to re-export `data.json`
      after federal/state elections.

## Performance smoke

- [ ] First open → quiz running within ~2 seconds on a cold-start
      device.
- [ ] No noticeable jank scrolling the Resources tab.
- [ ] No noticeable jank scrolling the OnboardScreen state picker.
