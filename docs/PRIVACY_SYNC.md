# Privacy policy — sync rules

The privacy policy exists on **two surfaces** that must not drift apart:

| Surface | File | Role |
|---|---|---|
| **Standalone page** | `privacy.html` | **Authoritative.** This is the URL declared to the App Store and Google Play (`https://formn400.org/privacy.html`). A reviewer reads this one. It is English-only and has no SPA dependency, so a direct link always resolves. |
| **In-app screen** | `index.html` → `#screen-privacy` | The policy as seen inside the web app, translated into the site's languages via `UI_TEXT`. Reached from the site footer, never linked externally. |

They drifted before: `privacy.html` gained the Operator disclosure and the
Mobile app (iOS) section while the SPA screen did not, so the same policy said
different things depending on where you read it. Both files now carry a
`KEEP IN SYNC — see docs/PRIVACY_SYNC.md` comment at the top of their privacy
block.

---

## Sections that must match

Changing any of these means changing **both** files in the same commit.

| Section | `privacy.html` | `index.html` i18n key prefix | English-verbatim? |
|---|---|---|---|
| Last updated date | `<p class="updated">` | `privacy.updated` + `PRIVACY_UPDATED` | see "Dates" below |
| Operator | `<h2>Operator</h2>` | `privacy.operator.*` | **YES** |
| What the app does NOT do / Data we DO NOT collect | `<h2>What the app does NOT do</h2>` | `privacy.donot.*` | no |
| What stays on your device | `<h2>What stays on your device</h2>` | `privacy.donot.body` | no |
| **Mobile app (iOS)** | `<h2>Mobile app (iOS)</h2>` | `privacy.mobile.*` | **YES** |
| Case Status Helper | `<h2>Case Status Helper (coming soon)</h2>` | `privacy.casestatus.*` | no |
| No sale or sharing of data | `<h2>No sale or sharing of data</h2>` | `privacy.nosale.*` | no |
| Data retention and deletion | `<h2>Data retention and deletion</h2>` | `privacy.retention.*` | no |
| Third-party services | `<h2>Third-party services</h2>` | `privacy.thirdparty.*` | no |
| Data breach notification | `<h2>Data breach notification</h2>` | `privacy.breach.*` | no |
| Transfer of ownership | `<h2>Transfer of ownership</h2>` | `privacy.transfer.*` | no |
| Changes to this policy | `<h2>Changes to this policy</h2>` | `privacy.changes.*` | no |
| Contact | `<h2>Contact</h2>` | `privacy.contact.*` | no |

Sections that exist on only one surface, and legitimately so:

- `privacy.html` only — **U.S. State Privacy Notice**, **External links**,
  **Children**, **Official resources**, and the Vietnamese summary block.
- `index.html` only — **Overview**, **Web Speech API (microphone)**
  (a browser feature that does not exist in the iOS app), **California
  residents (CCPA)**, the always-Vietnamese summary box, and the
  **Full policy (English)** pointer back to `privacy.html`.

---

## The English-verbatim rule

Two sections are marked **English-verbatim** above. They render in English on
every language surface and are never translated, not even by a human:

- **Operator** — legally required disclosure naming the liable operating
  entity (USCIS Torch API compliance). A translated version is a different
  legal statement.
- **Mobile app (iOS)** — the declared App Store privacy disclosure. Apple reads
  the English page; a translation that drifts by one clause is a discrepancy
  between what the app declares and what the policy says.

**How this is implemented in `index.html`:** define only an `en` value in
`UI_TEXT`. `updateUILanguage`'s `pick()` falls back to `entry.en` whenever
`entry[lang]` is missing, so one `en` string covers all 20 languages with no
per-language duplication:

```js
"privacy.mobile.title": { en:"Mobile app (iOS)" },
```

Do **not** add other language keys to these entries. Do not machine-translate
them. This is the same pattern the Operator clause uses (Invariant I: no
machine translation of legal text).

---

## Dates

The date lives in exactly **two** places and they are bumped together:

1. `index.html` → `const PRIVACY_UPDATED = "2026-08-21";` (ISO). Every language
   renders it through `toLocaleDateString` with `-u-ca-gregory-nu-latn` forced,
   so the Gregorian year and Western digits are identical in all 20 languages.
   `UI_TEXT["privacy.updated"]` holds the translated **label only** — never put
   a date back into it.
2. `privacy.html` → `<p class="updated">Last updated: …</p>`, hand-written
   English.

`privacy.html` is not driven by the constant, so bumping the date is a
two-file edit. Keep them on the same day.

---

## Checklist for any policy change

- [ ] Both files edited in the same commit.
- [ ] Section order matches for the shared sections listed above.
- [ ] English-verbatim sections are byte-identical between the two files.
- [ ] `PRIVACY_UPDATED` and the `privacy.html` date both bumped.
- [ ] If the change affects the iOS app's data handling, also update
      `mobile/src/screens/AboutScreen.tsx` and
      `mobile/docs/release/PRIVACY_NUTRITION.md`.
- [ ] `privacy.html` deployed — Apple reads the live URL, not the repo.
