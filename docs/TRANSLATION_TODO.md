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
