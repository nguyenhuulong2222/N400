# Language Expansion Plan — formN400.org

Tracks the multi-PR effort to add 8 new languages to formN400.org and
the dedicated USCIS policy-update notice.

Source brief: turn-of-2026-05-21 from Long. Decisions captured below.

---

## Current language lock (do not modify)

The site has shipped these 6 languages since commit `bdc47fd`:

| Internal code | Display name | Source script |
|---|---|---|
| en  | English | Latin |
| vi  | Tiếng Việt | Latin (Vietnamese) |
| es  | Español | Latin (Spanish) |
| zh  | 中文 | Han |
| tl  | Filipino | Latin (Tagalog) |
| ko  | 한국어 | Hangul |

**Note on `tl` vs `fil`:** the source brief listed `fil` as the Filipino
language code. The codebase has always used `tl` internally (see
`SUPPORTED_LANGS`, `LANG_META`, every `data-lang=` button, every question
field, hreflang, JSON-LD). `fil` only appears as the BCP-47 HTML `lang`
attribute output, via the `tl → fil` mapping inside `updateUILanguage`.

Decision (2026-05-21): keep `tl` as the internal slug, treat the brief's
`fil` as a synonym. No rename. The display name remains "Filipino".

## New languages — this expansion

| Code | Display | Source script | dir | CLINIC source URL | Notes |
|---|---|---|---|---|---|
| hi  | हिन्दी | Devanagari | ltr | hindi-english_0.pdf | Bilingual PDF |
| ht  | Kreyòl | Latin | ltr | haitian-creole_0.pdf | |
| th  | ภาษาไทย | Thai | ltr | thai-english_0.pdf | Bilingual PDF |
| lo  | ລາວ | Lao | ltr | lao_0.pdf | |
| hmn | Hmong | Latin | ltr | hmong_0.pdf | |
| my  | မြန်မာ | Myanmar | ltr | burmese_1.pdf | |
| pt  | Português | Latin | ltr | portuguese_0.pdf | |
| ru  | Русский | Cyrillic | ltr | russian_0.pdf | |

All 8 source PDFs returned HTTP 200 during Phase 0 probe on 2026-05-21.

## Deferred languages

| Code | Display | Reason |
|---|---|---|
| ar  | العربية | CLINIC PDF URL returned **HTTP 404** in Phase 0 probe. Skipping until a working source is found. Adding it would also require RTL plumbing, which is its own milestone. |
| km  | ភាសាខ្មែរ | CLINIC PDF URL returned **HTTP 404** in Phase 0 probe. Skipping until a working source is found. |

When the source URLs are recovered, ar and km can be added in a follow-up
PR with the same scaffolding. RTL work for ar is a separate concern.

## Two-PR staging

### PR 1 — foundation (this PR)

- Plan document (this file).
- `LANG_META` entries for 8 new langs.
- Language selector grid: 8 new buttons, responsive wrap for 14 cards
  total (no horizontal scroll on mobile).
- Render-path lang lists refactored to be data-driven where they were
  previously hardcoded (`getT`, `NATIVE_LANGS`).
- `UI_TEXT` translations for **every existing key** in 8 new languages.
  Suggested-translation pill key (`pill.suggested`) uses the verbatim
  wording from the brief in each script.
- Always-visible footer link to a new `#screen-policy-notice` screen
  documenting USCIS PM-602-0194 in informational, non-legal-advice
  language with verified source links.
- Resource-tab cards for the 8 working CLINIC PDFs, labeled as
  "Source: Catholic Legal Immigration Network (CLINIC), USCIS-recognized
  nonprofit" — **never** as "official USCIS translation".
- No changes to `QUESTIONS_2025` / `QUESTIONS_2008` banks. The question
  fields for the 8 new languages remain absent; the existing
  `q.q` English fallback path renders for those users until PR 2 lands.
  This is the deliberate scope cut to keep this PR reviewable.
- No `hreflang` for new languages yet — per brief Phase 20, hreflang
  is gated on content completeness, and question banks are not yet
  translated.

### PR 2 — content (next session)

- Download 8 CLINIC PDFs into `/tmp/formn400_clinic_pdfs`.
- Parse with `pdftotext`; assess extraction quality per lang.
- Match parsed 2008 CLINIC questions to existing 2008 bank by id +
  Jaccard similarity (same pipeline as the previous zh/tl/ko import).
- Import auto-accepted matches as **CLINIC-source** translations
  (no `_suggested` flag).
- Inherit CLINIC-source 2008 translations onto matching 2025 questions
  (~57–60 by vi-text exact match, ~4 by hand-mapped near-match).
- Generate suggested translations for the ~68 2025 questions that have
  no 2008 counterpart, flagged `{lang}_suggested: true`.
- Generate suggested distractors for all distractor sets in both banks
  flagged `distractors_{lang}_suggested: true`.
- Translate INTERVIEW_GROUPS, INTERVIEW_OATH, and oath glosses.
- Add Q53 `display_a_override` for all 8 langs.
- Re-run audit, ensure 0 critical errors.

## Wording rules

### CLINIC translations

Correct: **"Source: Catholic Legal Immigration Network (CLINIC),
USCIS-recognized nonprofit"**.

Incorrect (never use):
- "Official USCIS translation"
- "Government translation"
- "USCIS-approved translation"

### USCIS policy notice

The PM-602-0194 notice is informational only.

Required wording:
- "Source: USCIS Policy Memorandum PM-602-0194"
- "formN400.org is a study tool only"
- "does not process applications"
- "does not provide legal advice"
- "may be affected" (never "you are affected" / "your country is paused")

Forbidden in user-facing strings:
- "Trump administration"
- "Trump pause"
- "ban"
- "blocked"
- "you cannot naturalize"
- "USCIS will deny you"
- "you are affected"
- "your application is paused"
- "guaranteed affected"

### Suggested vs CLINIC-source

Each question field has a `_suggested:true` sibling flag when the value
is LLM-generated, never when it came verbatim from the CLINIC source.

The two must **never** be merged into a single field without status
metadata. Mixing them defeats the auditable provenance of the data.

## Hreflang gating

A language qualifies for `<link rel="alternate" hreflang="…">` only when
all of the following hold:

- Language selector renders the button.
- Every `UI_TEXT` key has a non-empty translation in that language.
- Either (a) question banks are translated, or (b) the English fallback
  is clearly labeled as such in the UI for that language.
- Disclaimer + resource cards have content in that language.
- The audit script reports 0 critical errors for that language.

This PR adds the selector, the `LANG_META`, and the UI_TEXT translations
but **not** the hreflang or sitemap entries for the 8 new langs. Those
land in PR 2 alongside the question-bank translations.

## Audit script extensions

`/tmp/n400_audit.js` (existing) is extended in PR 1 to:

1. Validate `SUPPORTED_LANGS` has 14 entries (en, vi, es, zh, tl, ko +
   8 new) and `LANG_META` has full metadata for each.
2. Check every `UI_TEXT` key has a non-empty value in all 14 languages.
3. Check the new policy-notice screen has all `policy.*` keys populated
   in all 14 languages.
4. Encoding sweep: no replacement character `�`, no escaped null bytes.
5. Banned-phrase sweep across the entire `<body>`:
   `Trump administration`, `you cannot naturalize`, `guaranteed affected`,
   `official USCIS translation`, `USCIS-approved`, `Trump pause`.
6. Existing 6-language audit (banks, INTERVIEW, OATH, Q53 override) must
   still pass.

PR 2 will add bank-coverage and distractor-coverage audits per new lang.

## Known risks

- **Translation quality.** All UI_TEXT translations added in PR 1 are
  generated, not human-reviewed. They should be marked clearly in the
  plan; a future native-speaker pass would improve quality especially
  for Khmer-style scripts and legal-tone strings.
- **Speak mode.** Speak practice is vi-only and gated by
  `state.lang === 'vi'` in `speakModeAvailable()`. Adding new langs does
  not unlock speak mode for them, which is intentional.
- **Resources tab card count.** With 8 new CLINIC cards + the existing
  3 (en/vi/es) under the 2008 section, that's 11 cards. The responsive
  CSS may need a smaller min-width breakpoint on mobile to avoid two
  half-empty cards per row.
- **Audit script lives outside the repo.** `/tmp/n400_audit.js` is
  reusable by hand but not version-controlled. Long should move it
  to `scripts/audit.js` in a future PR if we want CI gating.
