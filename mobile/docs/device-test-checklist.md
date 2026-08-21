# Real-device test checklist

Everything on this page is **unverifiable on the iOS Simulator** and must be
walked on physical hardware before the first TestFlight build is promoted.
Simulator results for these items are misleading, not merely incomplete —
see the "why" note under each section.

Run this against a **development build**, not Expo Go. Command in
§0 below.

---

## 0. Build and install the development build

```bash
cd /Volumes/Crucial1TB/N400/mobile
eas build --platform ios --profile development
```

The `development` profile in `eas.json` sets `developmentClient: true` and
`ios.simulator: false`, so this produces a device-installable build. EAS will
prompt for Apple credentials and register the device UDID on first run; let
it. When the build finishes, install via the QR code / install link EAS
prints, then start the bundler:

```bash
npx expo start --dev-client
```

---

## 1. Text-to-speech — real voice inventory

**Why the simulator lies:** the simulator inherits the *host Mac's*
installed voices. A physical iPhone ships a much smaller default set, and
users can add or remove voices in Settings. A language that speaks natively
on the simulator may fall back to English on a real device, and that is
exactly the case this feature exists to handle gracefully.

**Simulator baseline, captured 2026-08-21 on iPhone 17 Pro (iOS 26):**

| Lang | `langMeta.tts` | Simulator result |
|---|---|---|
| en  | en-US | native |
| vi  | vi-VN | native |
| es  | es-ES | native |
| zh  | zh-CN | native |
| tl  | (declares en-US) | **English fallback** |
| ko  | ko-KR | native |
| hi  | hi-IN | native |
| ht  | (declares en-US) | **English fallback** |
| th  | th-TH | native |
| lo  | (declares en-US) | **English fallback** |
| hmn | (declares en-US) | **English fallback — by construction** |
| my  | (declares en-US) | **English fallback** |
| pt  | pt-BR | native |
| ru  | ru-RU | native |

`tl`, `ht`, `lo`, `my` and `hmn` already declare `en-US` in `langMeta`, so
they are English-audio regardless of device. **Expect the other nine to
differ on hardware** — re-record the column below.

- [ ] For **each** of the 14 languages: select it on the onboard screen,
      start a quiz, tap **"Hear the question"**.
- [ ] Record the actual result per language:

      en __  vi __  es __  zh __  tl __  ko __  hi __
      ht __  th __  lo __  hmn __ my __  pt __  ru __

      (write `native` or `english-fallback` for each)

- [ ] Every language where audio comes out in **English** shows the inline
      **"Audio in English"** note next to the speak button. No language is
      ever silent.
- [ ] No language plays *localized text read by an English voice* — that
      would be unintelligible. If you hear a Vietnamese sentence mangled by
      an English voice, that is a bug in `src/tts/speech.ts`, not a missing
      voice.
- [ ] Answer a question, then tap **"Hear the answer"**. The correct answer
      is read, in the same language as the prompt.
- [ ] Tap "Hear the question" twice quickly — the second tap **replaces**
      the first; utterances do not queue up.
- [ ] Tap "Hear the question", then immediately tap **Next** — audio stops.
      It must not continue over the next question.
- [ ] **Silent mode:** flip the physical ring/silent switch to silent and tap
      a speak button. Per the Expo SDK 56 docs, iOS produces **no sound** in
      silent mode. Confirm the app does not appear frozen or throw — it
      should simply be quiet. Decide whether this needs a UI hint.
- [ ] Add a voice you do not have (Settings → Accessibility → Spoken Content
      → Voices), relaunch the app, and confirm that language flips from
      `english-fallback` to `native`. The probe runs once per launch, so a
      relaunch is required — verify that is acceptable UX.
- [ ] With headphones connected, audio routes to headphones.
- [ ] Receive a phone call mid-utterance; confirm the app recovers.

---

## 2. Local study reminder

**Why the simulator lies:** Expo Go on SDK 53+ prints
`expo-notifications functionality is not fully supported in Expo Go`, and
simulator notification delivery does not exercise the real scheduler,
permission sheet, or Notification Center behaviour. Scheduling can appear to
succeed and never fire.

- [ ] Fresh install. Open the app. **No notification permission prompt
      appears at launch.** (This is the Invariant VIII / App Review point —
      permission is requested only on opt-in.)
- [ ] Open **About**. "Daily reminder" reads **Off — no notifications are
      scheduled**.
- [ ] Flip the toggle **on**. The iOS permission sheet appears *at this
      moment* and not before.
- [ ] **Deny** permission. An alert explains how to enable it in Settings,
      and the toggle returns to off — it does not sit in a false "on" state.
- [ ] Flip on again, **Allow**. Subtitle reads **Every day at 7:00 PM**.
- [ ] Leave the About screen, come back. Toggle still reads on with the same
      time — proving state is read back from the OS scheduler and not from
      any app-side storage.
- [ ] **Force-quit and relaunch.** Toggle still reads on. (If it reads off,
      the derive-from-scheduler logic is broken.)
- [ ] Set the device clock so 7:00 PM local arrives (or temporarily change
      the hour in `src/notifications/reminders.ts` to a minute ahead and
      rebuild). **The notification actually fires** with title
      "Civics practice".
- [ ] Notification fires with the app **backgrounded**.
- [ ] Notification fires with the app **force-quit**.
- [ ] With the app **foregrounded**, the banner still shows (per
      `setNotificationHandler`), with no sound and no badge.
- [ ] Flip the toggle **off**. Subtitle returns to "Off". Wait past the fire
      time — **nothing arrives**.
- [ ] Toggle on → off → on rapidly. Exactly **one** reminder is scheduled,
      never a stack of duplicates. Verify with a temporary
      `getAllScheduledNotificationsAsync()` log if unsure.
- [ ] Revoke notification permission in Settings while the toggle is on,
      return to About: the toggle reflects reality rather than lying.
- [ ] Confirm in a network proxy (Charles / Proxyman) that **no push token
      request** and **no outbound call** occurs at any point. The app must
      never contact Expo's push service.

---

## 3. Regressions worth re-walking on hardware

- [ ] **Offline / airplane mode:** enable airplane mode, cold-start, run a
      full 2025 quiz to the result screen. Everything works — question data
      is bundled in the JS bundle, not fetched.
- [ ] **No cold-start network traffic:** with a proxy attached, cold-start
      the app and confirm **zero** outbound requests. `expo-updates` was
      removed in Phase 1; if you see a call to `u.expo.dev`, it came back.
- [ ] Resources and About links open the **system browser**, not an in-app
      web view.
- [ ] Footer disclaimer "Not affiliated with USCIS. Educational use only."
      is visible on every screen including under the home indicator.
- [ ] Splash screen shows the navy background with the checkmark mark, and
      does not flash white before first paint.
- [ ] App icon on the home screen is the checkmark mark, with no black or
      transparent corners.
- [ ] **iPad:** `supportsTablet: true`, so run the whole flow on an iPad.
      Check the onboard state grid and the About screen at tablet width.
- [ ] Dynamic Type at the largest accessibility size — the quiz options and
      the two legal notices remain readable and are not clipped.
- [ ] Dark mode: `userInterfaceStyle` is `light`, so the app should stay
      light. Confirm nothing renders white-on-white.

---

## 4. Sign-off

| Item | Result | Tester | Date |
|---|---|---|---|
| §1 TTS, all 14 languages | | | |
| §2 Reminder, full cycle | | | |
| §3 Regressions | | | |

Do not promote a TestFlight build to external testers until §1 and §2 are
fully checked.
