# CLAUDE.md

Guidance for Claude Code working in this repository.

## What this is

A free, single-page web app that drills the U.S. naturalization civics test (Form N-400). It's a static `index.html` — no build step, no dependencies, no backend — deployed to Cloudflare Pages.

- Repo: https://github.com/nguyenhuulong2222/N400
- Cloudflare Pages project name: `n400`

## Project layout

```
/
  index.html        ← the entire app (HTML + CSS + JS + question data, ~6500 lines)
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

| Route        | Pool | Asked | Pass | Fail | Notes |
|--------------|------|-------|------|------|-------|
| `2025`       | 128  | 20    | 12   | 9    | Standard 2025 civics test |
| `2008`       | 100  | 10    | 6    | 5    | Pre-Oct-2025 applicants — real 2008 bank from USCIS PDF |
| `6520_2025`  | 20   | 10    | 6    | 5    | Age 65+, 20yr LPR — 2025 starred subset (filed on/after Oct 20, 2025) |
| `6520_2008`  | 20   | 10    | 6    | 5    | Age 65+, 20yr LPR — 2008 starred subset (filed before Oct 20, 2025) |
| `5020`       | 128  | 20    | 12   | 9    | Age 50+, 20yr LPR — English exempt only |
| `5515`       | 128  | 20    | 12   | 9    | Age 55+, 15yr LPR — English exempt only |

`QUESTIONS_2025` is the canonical 128-question array. `QUESTIONS["2025"]` is the same array minus any `excluded:true` entries (currently just Q29). The two 65/20 routes filter their respective banks by the `starred_6520:true` marker that USCIS uses to designate the starred subset for each test version. `QUESTIONS["5020"]` and `QUESTIONS["5515"]` reuse the full 2025 bank — the 50/20 and 55/15 exemptions waive only the English requirement, not the civics test itself (the user simply answers in their native language with their own interpreter). `QUESTIONS_2008` is the real 100-question 2008 USCIS civics bank with its own starred subset, dynamic-official questions, state-dependent questions, and vi/es translations.

The 2008 USCIS multilingual PDFs cover only 100 questions, so the 2025 bank picks up vi/es translations for ~61 questions where the 2008 and 2025 wording line up. The remaining ~67 questions in the 2025 bank carry suggested (unofficial) translations marked with `vi_suggested:true` / `es_suggested:true` — the UI shows a small "Dịch gợi ý" / "Traducción sugerida" pill next to those so the user knows they aren't from USCIS.

## Question record shape

```js
{
  id: 1,
  q: "English question text",
  a: ["accepted answer 1", "accepted answer 2", ...],   // any one accepts; omitted for stateField/dynamic
  distractors: ["wrong 1", "wrong 2", "wrong 3"],       // 3 used per render; omitted for stateField (generated)
  // Optional parallel translation arrays (display-only — grading still uses
  // English from `a` / `distractors`). When present in native-language mode
  // (exemption routes + non-en lang), `renderQuestion` shows the translated
  // text large and the English in a small gray subtitle line under it.
  distractors_vi: ["...", "...", "..."], distractors_vi_suggested: true,
  distractors_es: ["...", "...", "..."], distractors_es_suggested: true,

  // 65/20 subset marker — USCIS's "★" set per test version:
  starred_6520: true,

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

## Speak mode (oral interview simulation)

Vietnamese-only practice mode that mirrors the actual USCIS interview format:
the question is spoken aloud via `speechSynthesis` (vi-VN voice), the user
records an answer with the device microphone, and the Web Speech API's
`SpeechRecognition` transcribes it. The transcript is normalized
(diacritics stripped, lowercased, punctuation removed) and graded against
both the Vietnamese `vi_a` list and the English `q.a` list — answering in
either language counts. Three verdicts: `correct`, `partial` (significant
keyword overlap but not a full match — yellow highlight), `wrong`.

- Toggle lives in the quiz header. Only visible when the route is one of
  the four native-language exemption routes (`5020`, `5515`, `6520_2025`,
  `6520_2008`) AND the chosen language is `vi`. Switching to a non-vi
  language or a non-exemption route forces back to MCQ.
- Hard-cap: 20 seconds per attempt (in addition to the browser's
  end-of-speech detection).
- Browser support: `SpeechRecognition` is well-supported on Chrome
  (desktop + Android) and Safari iOS 14.5+. Firefox and older Safari fall
  back to a "browser not supported" message. The `vi-VN` voice quality
  varies by OS — macOS bundles a usable one; Linux often has none, in
  which case the TTS fallback is silent.

Speak mode does not exist for Spanish yet; that's a planned follow-up
once the matching heuristics have been validated for Vietnamese.

## Resources tab (Tài Liệu)

A third top-tab with three sections of static content:
  1. **Official study materials** — direct links to the USCIS PDFs and
     pages for the 2025 / 2008 / 65-20 question banks and Form N-400.
     Each card has language tags (Tiếng Anh / Tiếng Việt / Tiếng Tây
     Ban Nha / Đa ngôn ngữ) and a "Miễn phí" tag.
  2. **Pre-interview preparation tips** — 5 cards covering what to
     bring, interview-day logistics, in-room phrases, the civics
     portion, and the retest process.
  3. **Useful links** — `my.uscis.gov`, exceptions-and-accommodations,
     find-a-field-office, free legal aid, 50+ fact sheet.

The screen is plain HTML (no dynamic rendering) — content never changes
based on state. All external links use `target="_blank"
rel="noopener noreferrer"` and point only to `uscis.gov`; this app does
not host any of the PDFs.

## Interview Practice (5-group simulation)

A separate top-tab next to Practice Test. Walks the user through the
USCIS naturalization interview in five groups:

  1. **Personal information** — optional personal-info form (name, DOB,
     address, other names, birth country) feeds personalized sample
     answers. Listen-only mode, no grading.
  2. **Residency history** — listen + self-grade (👍 confident / 👎 needs
     more practice). No transcription.
  3. **Good moral character** — Yes/No questions. A mandatory full-screen
     warning is shown before the first question and must be acknowledged.
  4. **Oath of Allegiance** — the 7 clauses of the oath shown bilingually
     with a plain-language Vietnamese gloss for each. TTS reads the
     English oath slowly (rate 0.75) for read-along practice.
  5. **Civics test link** — bridges back to the Practice Test tab.

UI lives in `screen-interview`, content is dynamically rendered into
`#interview-body` based on `state.interview.phase`. All data structures
(`INTERVIEW_GROUPS`, `INTERVIEW_OATH`) sit alongside `STATE_DATA` /
`CURRENT_OFFICIALS` near the top of the script block.

## INVARIANTS

These are non-negotiable. They take precedence over feature requests and
must be preserved in every future change.

**I. DATA SOURCE LÀ USCIS** — Không bịa câu hỏi, không copy app bên thứ ba.
Bản dịch chỉ từ nguồn USCIS/CLINIC chính thức. KHÔNG máy dịch.

**II. DATA INLINE TRONG index.html** — `QUESTIONS_2025`, `QUESTIONS_2008`,
`STATE_DATA`, `CURRENT_OFFICIALS` nằm inline (~6500 dòng). Đây là kiến
trúc đã chọn. Bản skill cũ ghi "data ở JSON" là SAI — bỏ.

**III. KHÔNG BACKEND** — Pure static. Ngoại lệ network: Google Fonts,
Web Speech API.

**IV. CÂU DYNAMIC KHÔNG NEO VÀO TÊN NGƯỜI** — Câu đáp án đổi sau bầu cử
/bổ nhiệm (President, VP, Speaker, Chief Justice, Senators, Governor)
mang `dynamic:true`. KHÔNG hardcode tên officeholder làm đáp án HAY
distractor, ở BẤT KỲ ngôn ngữ nào (gồm pt/ru/th). Đáp án trỏ tới
`uscis.gov/citizenship/testupdates`. Hiện cảnh báo ⚡.

**V. LEGAL DISCLAIMER LUÔN HIỆN** — Footer "Not affiliated with USCIS…"
mọi màn hình. Không gỡ, không thu nhỏ.

**VI. KHÔNG INSIGNIA CHÍNH PHỦ** — Không logo USCIS / seal DHS / Great
Seal / huy hiệu liên bang (kể cả emoji 🦅 làm biểu tượng chính phủ).

**VII. KHÔNG TƯ VẤN PHÁP LÝ** — Chỉ giáo dục công dân. Câu thủ tục: chỉ
link `uscis.gov`.

**VIII. NO PERSONAL DATA COLLECTION** — The app collects zero personal
data. Any information entered by users (name, DOB, address, etc.) exists
only in JavaScript memory for that session and is never transmitted,
stored, or logged anywhere. No localStorage, no cookies, no network
calls carrying user input, no analytics that record content.

This applies in particular to the Interview Practice personal-info
form: those values live exclusively in `state.interview.personal` and
disappear on page reload. Any future feature touching user input must
verify it does not violate this invariant.

## SEO / discoverability

The site is built for organic search. The `<head>` block carries: a
descriptive `<title>` (per-language, updated via `document.title` on
`selectLang`), `<meta name="description">`, OG and Twitter card tags
pointing at `/og-image.png`, `hreflang` links for all six languages, and
a Schema.org `WebApplication` JSON-LD block.

Sister files at the repo root:

- `sitemap.xml` — single-URL sitemap with hreflang alternates.
- `robots.txt` — allow-all + sitemap reference.
- `manifest.json` — PWA manifest pointing at `/icon-192.png` and `/icon-512.png`.
- `og-image.svg` — source for the social-share preview (1200×630).

**Binary assets still need to be generated** and committed alongside the
repo before they go live:

- `og-image.png` — convert `og-image.svg` (1200×630). Use
  `rsvg-convert -w 1200 -h 630 og-image.svg -o og-image.png` (or any
  other rasterizer); the OG/Twitter meta tags both point at the PNG.
- `icon-192.png` and `icon-512.png` — plain navy circle with "N400"
  centered is sufficient. Used by `manifest.json` for PWA install.

Language detection on page load reads `?lang=` from the URL and, if the
value is one of `en/vi/es/zh/tl/ko`, applies it before first paint. When
the user manually changes language, `history.replaceState` keeps the URL
in sync (English strips the param so the canonical `/` URL stays clean).

## Known gaps and bugs

- **Q29 (your U.S. representative) is excluded** in both banks (2025 Q29 / 2008 Q23). It needs district-level data (435 reps, frequent turnover); we don't ship that table. Question is marked `excluded:true` and filtered from the asked pool.
- **2008 bank distractors are auto-generated.** USCIS publishes accepted answers but not wrong-answer choices, so 2008 distractors are sourced from (a) the matched 2025 question's distractors when a counterpart exists (~63 questions) and (b) other correct answers within the same topical chapter for the rest. Distractor quality is variable; the answer-matching gotcha is enforced.
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
