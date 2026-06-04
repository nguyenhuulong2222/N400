# App Store / Play Store metadata draft

Draft copy and configuration values for the first TestFlight / Internal Testing
submission. URLs point at the standalone HTML pages served by Cloudflare Pages
from the repo root (`support.html`, `privacy.html`); confirm they resolve
before submission.

## Identity

| Field | Value |
|---|---|
| App name | **Form N-400 Civics Practice** |
| Subtitle (iOS) | Practice the U.S. naturalization civics test |
| Short description (Android, ≤80 chars) | Practice the 100/128 USCIS civics questions in 14 languages. |
| Bundle ID (iOS) | `org.formn400.app` |
| Package (Android) | `org.formn400.app` |
| Version | `1.0.0` |
| Build | auto-incremented by EAS (`production` profile) |
| Category | Education |
| Age rating | 4+ |
| Content rating | No mature content |

## Full description

> Form N-400 Civics Practice is an independent study tool for the U.S.
> naturalization civics test (Form N-400). It drills the official USCIS
> civics questions in multiple-choice format so applicants can review
> answers offline before their interview.
>
> Features:
> · 2025 civics test (128 questions, 20 asked, 12 to pass)
> · 2008 civics test (100 questions, 10 asked, 6 to pass)
> · 65/20 starred subsets for the senior-citizen exemption (2025 and 2008)
> · 50/20 and 55/15 native-language exemption routes
> · Questions and accepted answers translated into 14 languages —
>   English, Vietnamese, Spanish, Chinese, Tagalog, Korean, Hindi, Haitian
>   Creole, Thai, Lao, Hmong, Burmese, Portuguese, and Russian
> · Bilingual rendering for non-English routes — native language with
>   English subtitle on every prompt and answer
> · State picker for the "What is the capital of your state?" question
> · Study cards for questions whose answers change after every election
>   (President, Vice President, Speaker, Chief Justice, your state's
>   senators, your state's governor) — the app does not show names; it
>   directs users to uscis.gov/citizenship/testupdates for the current
>   officeholder
> · Resources tab linking to official USCIS pages
>
> This is an independent practice tool. It is not affiliated with USCIS
> or any government agency. For authoritative information and current
> officeholders, see uscis.gov.

## Keywords (iOS, ≤100 chars including commas)

```
civics,citizenship,N400,naturalization,USCIS,test,practice,immigration,interview
```

## Privacy summary

**Data collected:** *None.*

Form N-400 Civics Practice does not collect, sell, or share personal
data. There is no account, no login, no ads, no analytics, no
tracking, no payment, and no personal data collection. Quiz answers
and selections (route, language, state) live only in device memory
for the current session and are discarded when the app is closed —
no background sync, no cloud save, no server upload, no third-party
SDKs. The only outbound network traffic is when the user taps a link
in the Resources tab, which opens the system browser to a public
`uscis.gov` page.

This summary mirrors the full public privacy policy at
`https://formn400.org/privacy.html`.

For the App Store Privacy Nutrition Label / Google Play Data Safety
form, every category should be marked **"Data not collected."**

## URLs

| Field | Value |
|---|---|
| Support URL | `https://formn400.org/support.html` |
| Marketing URL | `https://formn400.org` |
| Privacy policy URL | `https://formn400.org/privacy.html` |

All three pages live at the repo root and are served by Cloudflare Pages
once the GitHub `main` branch is pushed. `support.html` and
`privacy.html` are standalone HTML pages (no SPA dependency) so direct
URLs always resolve — required by both Apple and Google.

The privacy page content matches the in-app behavior verbatim: no
account, no login, no ads, no analytics, no tracking, no payment, no
personal data collection. Quiz answers and selections live only in
device memory for the current session and are discarded on close.

## App Review notes (App Store Connect → App Review Information)

```
This is an independent civics-test practice app. There is no sign-in,
no account, and no data collection. To test the app:

1. Open the app — you will see the Practice tab.
2. Select any route (e.g. "2025 Test · 128 Questions").
3. Select any language (default English).
4. Optionally select a U.S. state (skip is fine).
5. Tap "Start Practice" — you will see a sequence of multiple-choice
   questions and "Study Cards" for questions whose answers depend on
   current officeholders or the user's state.
6. Tap "Resources" tab to see external links to USCIS pages. These
   open the system browser; no WebView is used.

The app is not affiliated with USCIS. The footer "Not affiliated with
USCIS. Educational use only." is visible on every screen and is also
restated in the Resources tab.

No demo account is needed.
```

## Disclaimer (must appear in the listing description AND in-app)

> Independent study tool. Not affiliated with USCIS or any government
> agency.

## Open items before first submission

- [ ] Replace placeholder `org.formn400.app` bundle ID + Android package
      if you want a different identifier.
- [ ] Register the bundle ID in Apple Developer + Google Play Console.
- [ ] Fill in Support URL, Privacy Policy URL, optional Marketing URL.
- [ ] Replace placeholder icon + splash assets in `mobile/assets/` with
      final branded versions (current placeholders are navy + "N400"
      text, sufficient for TestFlight Internal Testing but not for
      App Store public release).
- [ ] Capture screenshots: iPhone 6.7" + 6.1" + 5.5" + iPad 12.9" +
      Android phone + Android tablet. The app's screens to capture:
      Onboard (route + language + state picker), Quiz (MCQ), Quiz
      (Study Card), Result, Resources.
- [ ] Decide on EAS Build credentials (Apple Team ID, Google Service
      Account JSON) before running `eas build`.
