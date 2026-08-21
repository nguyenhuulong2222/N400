# App Privacy questionnaire — N-400 Citizenship Test

**Answer: Data Not Collected.**

In App Store Connect → App Privacy → "Do you or your third-party partners
collect data from this app?" choose **"No, we do not collect data from this
app."** That single answer completes the questionnaire; no data-type screens
follow.

Every category below is listed for the record. All are **Not Collected**:
Contact Info, Health & Fitness, Financial Info, Location, Sensitive Info,
Contacts, User Content, Browsing History, Search History, Identifiers, Usage
Data, Diagnostics, Purchases, Other Data.

---

## Justification per feature

Apple's definition of "collect" is *transmitting data off the device*. Data
held only in memory or written only to the device by the OS on the user's
behalf is not collected. Each user-facing feature is assessed against that
definition below.

| Feature | What the user provides | Where it goes | Collected? |
|---|---|---|---|
| Route selection (2025 / 2008 / 65-20 / 50-20 / 55-15) | A tap | `state.route` in memory | **No** |
| Language selection (14) | A tap | `state.lang` in memory | **No** |
| U.S. state selection | A tap | `state.userState` in memory | **No** |
| Quiz answers | Taps | `state.answers` in memory | **No** |
| Score / result screen | Derived | Computed from memory, never stored | **No** |
| Read aloud (expo-speech) | Nothing | Text is passed to the OS speech engine on-device; the voice list is read from the OS | **No** |
| Daily study reminder (expo-notifications) | Toggle + implicit 7pm | Scheduled with the OS notification scheduler on-device. **No push token is ever requested.** No server is contacted | **No** |
| Resources / About links | A tap | Hands a `uscis.gov` or `formn400.org` URL to the system browser. The app sends nothing with it | **No** |

Nothing survives app termination except the OS-held notification schedule,
which the OS owns and which exists only if the user opted in. The app writes
no file, no preference, no keychain item, and no database.

---

## Why the reminder toggle is not "collected data"

The on/off state of the study reminder is **not persisted by the app**. It
is derived at read time from
`Notifications.getAllScheduledNotificationsAsync()` — the OS's own list. The
app deliberately stores no copy. This was a design constraint, not an
accident: the project's Invariant VIII forbids the app from persisting
anything about the user.

Consequence worth knowing: if the user revokes notification permission in
Settings, the toggle reflects that on next read rather than showing a stale
"on".

---

## Third-party SDKs

**None.** The full runtime dependency list:

| Package | Purpose | Network? |
|---|---|---|
| `expo` | Framework runtime | No |
| `expo-speech` | On-device text-to-speech | No |
| `expo-notifications` | Local notification scheduling only | No — no push token, no APNs registration |
| `expo-splash-screen` | Launch screen | No |
| `expo-status-bar` | Status bar styling | No |
| `react` / `react-native` | UI runtime | No |
| `react-native-safe-area-context` | Safe-area insets | No |

No analytics SDK, no crash reporter, no attribution SDK, no advertising SDK,
no A/B framework.

**`expo-updates` was deliberately removed** and `app.json` sets
`updates.enabled: false`. Its OTA manifest check against `u.expo.dev` was the
only outbound request the app made at cold start. With it gone, a cold start
produces **zero** network traffic.

---

## Tracking

**"Does this app use data for tracking purposes?" → No.**

No IDFA, no `AppTrackingTransparency` prompt, no `NSUserTrackingUsageDescription`
in `Info.plist`, no data shared with data brokers or ad networks. The app
does not link any data to a user or device identity because it holds no
identity to link to.

---

## Consistency with the Phase 0 code audit

This questionnaire matches what the code actually does, verified by grep
across `App.tsx`, `index.ts`, and all of `src/`:

```
grep -rn -E "fetch\(|XMLHttpRequest|axios|WebSocket|AsyncStorage|localStorage|
SecureStore|Sentry|amplitude|firebase|analytics|Bugsnag|Crashlytics|posthog|
mixpanel|segment|getExpoPushToken|getDevicePushToken" App.tsx index.ts src/

-> 2 matches, both COMMENTS:
   src/data/load.ts:3               "// no AsyncStorage."
   src/notifications/reminders.ts:12 "// AsyncStorage, no file, no preference key."
```

Every URL present anywhere in the source, all opened via `Linking.openURL`
into the system browser and never fetched by the app:

```
https://egov.uscis.gov/casestatus/landing.do
https://egov.uscis.gov/processing-times/
https://formn400.org/privacy.html
https://formn400.org/support.html
https://my.uscis.gov
https://www.uscis.gov/about-us/find-a-uscis-office
https://www.uscis.gov/addresschange
https://www.uscis.gov/citizenship
https://www.uscis.gov/citizenship/2008-civics-test
https://www.uscis.gov/citizenship/find-study-materials-and-resources/study-for-the-test
https://www.uscis.gov/citizenship/testupdates
https://www.uscis.gov/n-400
```

---

## Alignment with the published policy

This matches `https://formn400.org/privacy.html`, which is the URL declared
in ASC. That page now carries a **"Mobile app (iOS)"** section covering both
features added in Phase 2 — on-device speech synthesis and the optional local
reminder — and stating that the app makes no network requests of its own. The
in-app About screen and the published policy say the same thing.

**Before submitting:** the updated `privacy.html` must actually be deployed.
The disclosure is committed in the repo but Apple reads the live URL.

---

## Verification before submitting

- [ ] Run the app behind a network proxy (Charles / Proxyman) on a real
      device. Cold start → **zero** requests.
- [ ] Complete a full quiz, use read-aloud, toggle the reminder on and off →
      still **zero** requests.
- [ ] Tap a Resources link → exactly one request, made by Safari, not the app.
- [ ] Confirm `https://formn400.org/privacy.html` loads in a private window,
      HTTP 200, no redirect chain.
