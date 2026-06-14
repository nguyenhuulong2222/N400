# TRANSLATION_TODO

Open translation gaps for `hi`, `lo`, `hmn`, `my`. Identified by the audit
on 2026-06-02 (see commit history near that date). All entries below were
deliberately **deferred** — the project policy is **Invariant I**: only
fill from USCIS or CLINIC official sources, and only when a reviewer who
can actually read the language has verified the string. None of the
current maintainers can read Hindi, Lao, Hmong, or Burmese well enough to
validate diacritics / conjuncts / tone marks, so untranslated > guessed.

The inverted-bilingual rendering bug that these gaps used to expose was
fixed separately at the same time — when any option (correct or
distractor) lacks a native translation, the renderer now falls back to
English-only for the whole question. That makes the UI consistent even
while these gaps remain unfilled.

---

## 0. Whole-language scaffolds — `ar`, `ur`, `gu`, `fr`, `bn`, `uk` (added 2026-06-13)

These six languages were added to `LANG_META` as **community tier**. Five
(`ar`/`ur`/`gu`/`bn`/`uk`) still have **zero translated content** — no UI
strings and no question banks — and fall back to **English UI + English-only
quiz** (honest placeholder; see `updateUILanguage` and `getT`). **`fr` now
carries DRAFT machine-assisted question-bank translations** (see its row
below). Each language needs a full native-speaker review pass before any
content is treated as final. Per Invariant I, untranslated > machine-
translated > guessed.

> **⚠️ Invariant I exception (logged 2026-06-13).** CLAUDE.md Invariant I
> states "KHÔNG máy dịch" (no machine translation). The owner explicitly
> **overrode** Invariant I for the French draft-translation task on
> 2026-06-13, on the condition that every record stays flagged `_suggested`
> and is presented as draft (never "official") until a native speaker
> reviews. The remaining five languages have NOT been overridden — they stay
> untranslated until a real source or reviewer is available. This exception
> is task-scoped and does not amend Invariant I for the project generally.

Scope per language: **228 questions** to translate (128 in the 2025 bank +
100 in the 2008 bank), each with its accepted-answer array and distractors,
plus the UI string set. Dynamic-officeholder questions (President, VP,
Speaker, Chief Justice, Senators, Governor) must follow the
`uscis.gov/citizenship/testupdates` URL-boilerplate pattern — **never**
hardcode an officeholder name in any language (Invariant IV).

| Lang | Native | Tier | Dir | Status | Notes |
|------|--------|------|-----|--------|-------|
| ar   | العربية | community | RTL | NOT STARTED | No CLINIC Arabic source confirmed. Bump to `official` later only if a CLINIC/USCIS source is verified. RTL rendering wired in Phase 3. |
| ur   | اردو    | community | RTL | NOT STARTED | No official source. RTL rendering wired in Phase 3. |

**RTL visual QA (ar/ur) — NOT YET POSSIBLE.** The Phase 3 RTL wiring
(`dir="rtl"` on `.q-text-native` / `.q-text-translated` / `.opt-native`) is
inert until the first **reviewed** Arabic/Urdu strings are entered — the
native-text elements only render when translation content exists. When those
strings land, run the visual pass: verify `text-align` + bidi reordering of
the question text and answer options on all **5 test routes** + **native-
language mode** + **info-card questions** (dynamic/state). The app chrome
stays LTR by design (no `<html dir>` flip in this phase).
| gu   | ગુજરાતી | community | LTR | NOT STARTED | No official source. |
| fr   | français | community | LTR | **DRAFT (suggested, machine-assisted, pending native review)** | All 228 question records (128 + 100) translated 2026-06-13: `fr`/`fr_a`/`distractors_fr`, every record flagged `fr_suggested:true`. NOT official, NOT native-reviewed. Dynamic/boilerplate answers kept as `uscis.gov/citizenship/testupdates` URL-text (no names/party). `_suggested` flag stays until a French native speaker reviews. UI strings still English-fallback. |
| bn   | বাংলা   | community | LTR | NOT STARTED | No official source. |
| uk   | українська | community | LTR | NOT STARTED | No official source. |

**Do NOT bump the public "14 languages" marketing count** (meta tags,
JSON-LD) for these until real translations land — they are scaffolds, not
shipped translations. `tools/build-app-data.js` and
`tools/sync-lang-count.js` derive the count from `LANG_META.length` (now
20) and would overclaim if run now.

---

## 0b. UI-string gap — `community.notice` banner (added 2026-06-13)

The Phase 2 community-translation disclaimer banner (`community.notice` in
`UI_TEXT`) is provided in **en / vi / es** only. These 11 languages — which
otherwise have full UI coverage — currently fall back to **English** for this
one sentence:

`zh, tl, ko, hi, ht, th, lo, hmn, my, pt, ru`

English source string:
> Community translation — for study reference only, not an official USCIS
> translation. Always compare with the English answer.

This is UI chrome (not civics content), but per project policy it was **not**
machine-translated — each language needs a reviewer to supply the sentence.
The companion badge label `lang.badge_community` ("Community") IS already
translated in all 14 covered languages; only the banner sentence is pending.

---

## 0c. Native + syntax review of the 14 existing languages (NOT STARTED)

The 14 pre-existing languages (en + vi/es/zh/tl/ko official; hi/ht/th/lo/hmn/
my/pt/ru community) have **never had a full native-speaker + syntax audit**.
Evidence this is overdue: the **Q1 "Chinese" bug** (fixed 2026-06-13) — Q1's
question-text translation for all 8 expansion langs was the bare word
"Chinese", a data-entry artifact that sat live and unnoticed. If a wrong
*question text* survived in 8 languages at once, other latent errors are
plausible across the Expansion-2026-05-21 batch.

Needed, per language:
- **Native-speaker pass** over question text, `{lang}_a`, and `distractors_{lang}`
  for accuracy (the Chinese bug was content, not syntax).
- **Syntax/structure pass** — run a bank-wide object-parse audit (every record
  must parse cleanly, no glued/missing fields) after any bulk data edit.

This is distinct from the per-question gaps in sections 1–3, which are about
*missing* translations; this is about *verifying* the ones already shipped.

---

## 1. 2025 #1 — "What is the form of government of the United States?"

`q.a` = `["Republic", "Constitution-based federal republic", "Representative democracy"]`

| Lang | Status | Reason |
|------|--------|--------|
| hi   | MISSING | Question was added in the 2025 bank. Not present in any CLINIC PDF (CLINIC publishes the 2008 100-question set only). USCIS has not published Hindi for the 2025 bank either. |
| lo   | MISSING | Same — not in CLINIC 2008 PDF. |
| hmn  | MISSING | Same. |
| my   | MISSING | Same. |

**Source needed:** USCIS 2025 multilingual update for the new questions,
when/if published in these four languages.

---

## 2. 2008 #36 / 2025 #48 — "What are two Cabinet-level positions?"

`q.a[0]` for 2008 #36 = `"Secretary of Agriculture"` (16 acceptable answers).
`q.a[0]` for 2025 #48 = `"Attorney General"` (24 acceptable answers — 8 new).

| Lang | Status | Notes |
|------|--------|-------|
| hi   | FILLED (16/24 for 2025) | Already in data; hi_a covers 16 of 16 (2008) and 16 of 24 (2025). |
| lo   | DEFERRED | CLINIC Lao PDF page 4 has the full 16-position Lao list in a side-by-side table (`/tmp/n400-audit/clinic-lo.pdf`, rendered at `lo-q36-hires-04.png`). Needs Lao reviewer. |
| hmn  | INTENTIONAL SKIP | CLINIC Hmong PDF (The Fresno Center, Fresno CA) chose to keep Cabinet position names in English. Treating this as "translation" produces an English-copy bilingual button that adds no value. Skip until a Hmong reviewer provides actual translations. |
| my   | DEFERRED | CLINIC Burmese page 6 contains only 5 of 16 positions: State, Labor, Agriculture, Education, Defense. Needs Burmese reviewer to (a) verify those 5 strings character-by-character and (b) source the remaining 11. |

**Engine note:** the renderer only displays `<lang>_a[0]`. To fix the
correct-button bilingual for these questions, the reviewer needs to
guarantee that `<lang>_a[0]` is the translation of `q.a[0]` (Agriculture
for 2008 #36, Attorney General for 2025 #48). For 2025 #48 my (Burmese),
CLINIC does NOT include Attorney General in its 5-position list — that
gap cannot be closed from CLINIC alone.

---

## 3. 2008 #46 — "What is the political party of the President now?"

`q.a` = `["Visit uscis.gov/citizenship/testupdates for the political party of the President."]`

By design this question follows the USCIS URL-lookup boilerplate pattern
to avoid anchoring to a specific political party (Invariant IV).

| Lang | Status | Notes |
|------|--------|-------|
| hi   | DEFERRED | CLINIC Hindi PDF (page ~9, line 447 of clinic-hi.txt) does have the URL-boilerplate translated to Hindi. Devanagari conjuncts in the source pdftotext extract appear damaged; need a Hindi reviewer to confirm the string from the rendered PDF page directly. |
| lo   | INVARIANT IV — BLOCKED | CLINIC Lao PDF hardcodes "Democratic Party" / "ພັກປະຊາທິປະໄຕ" as the answer. Using that would anchor the answer to a specific party, which Invariant IV forbids. Need a Lao reviewer to compose a URL-boilerplate sentence from official sources (or wait for USCIS to publish one). |
| hmn  | INVARIANT IV — BLOCKED | CLINIC Hmong PDF (Fresno Center) hardcodes "Pawg Democratic". Same constraint as Lao. |
| my   | INVARIANT IV — BLOCKED | CLINIC Burmese PDF page 7 hardcodes "Democratic Party (ဒီမိုကရက်တစ်ပါတီ)". Same constraint. |

---

## When this file shrinks

Each entry above should be removed when an entry is filled, with the
commit message linking back to this file and citing the reviewer who
validated the strings.
