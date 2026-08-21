# App Review notes

Paste the block below into **App Store Connect → App Review Information →
Notes**. Everything above and below the rules is guidance for you, not for
the reviewer.

---

```
WHAT THIS APP IS

A free study tool for the civics portion of the U.S. naturalization
interview. It presents official civics questions as multiple choice in 14
languages. There is no account, no sign-in, no payment, no advertising, and
no data collection. No demo credentials are needed — everything is reachable
from a cold launch.

HOW TO REACH EVERY SCREEN

The app has three tabs across the top: Practice, Resources, About.

1. PRACTICE (opens by default)
   a. "Route" — six options. Tap any one. "2025 Test - 128 Questions" is
      selected by default.
   b. "Language" — 14 options. English is the default. Tap "Tieng Viet" to
      see the bilingual layout: each question and answer shows the selected
      language first with the English underneath.
   c. "Your state (optional)" — tap "Skip", or tap any state. This only
      affects the "capital of your state" question.
   d. Tap "Start Practice".

2. QUIZ SCREEN
   - Tap any of the four options to answer. The correct option turns green
     and a "Correct." / "Not quite." message with a Next button appears.
   - "Hear the question" reads the question aloud. After answering, "Hear
     the answer" appears and reads the correct answer aloud. Both are
     optional; the quiz is fully usable without ever tapping them.
   - Some questions appear as a yellow "Study Card" instead of multiple
     choice. This is intentional — see "WHY SOME QUESTIONS HAVE NO ANSWER"
     below. Tap Next to continue; they are not scored.
   - Continue to the end (22 cards on the default route) to reach the
     result screen. To get there faster, choose the "65/20 - 2025 Starred
     Subset" route on the onboard screen, which is 12 cards.

3. RESULT SCREEN
   - Pass / Did not pass / Incomplete verdict, score, and a "Try again"
     button that returns to the onboard screen.

4. RESOURCES TAB
   - Three sections of links to official USCIS pages. Every link opens in
     Safari via Linking.openURL. There is no web view anywhere in this app.

5. ABOUT TAB
   - The independent-tool and no-legal-advice notices, an explanation of the
     read-aloud feature, the study reminder toggle, the privacy summary,
     links to the published privacy policy and support pages, and the
     version number.

OPTIONAL FEATURES — BOTH CAN BE IGNORED

Text to speech: the "Hear the question" and "Hear the answer" buttons use
expo-speech and the voices already installed on the device. No permission is
required and none is requested. If the device has no voice for the selected
language, the text is read in English and an "Audio in English" note is
shown next to the button so the behaviour is never silent or surprising.

Study reminder: on the About tab, off by default. It schedules one local
notification per day at 7:00 PM using the device's own scheduler. The
notification permission prompt is shown ONLY at the moment the reviewer
flips this toggle on — never at launch. There is no push token, no APNs
registration, and no server involved. Turning the toggle off cancels the
notification. The app stores no record of the setting; its state is read
back from the operating system's scheduled-notification list.

WHY SOME QUESTIONS HAVE NO ANSWER SHOWN

Several civics answers change after an election or an appointment: the
President, Vice President, Speaker of the House, Chief Justice, the user's
two senators, and the user's governor. This app deliberately does not print
any officeholder name. A name memorized from an out-of-date app is a wrong
answer in a real interview, so those questions render as study cards that
direct the user to uscis.gov/citizenship/testupdates to check the current
answer themselves. This is a correctness decision, not missing content.

NO GOVERNMENT AFFILIATION

The app is independent. It uses no USCIS logo, no DHS seal, no Great Seal,
and no federal insignia of any kind. The disclaimer "Not affiliated with
USCIS. Educational use only." is pinned to the bottom of every screen, and
the full notice appears on the About tab:

  "FormN400.org is an independent study tool. It is not affiliated with,
  authorized, endorsed, or approved by USCIS, DHS, or any U.S. government
  agency."

The About tab also carries, verbatim from our support page:

  "We cannot provide legal advice. For immigration legal questions, consult
  a licensed attorney or accredited representative."

The app gives no legal or procedural advice. Any question touching
procedure links out to uscis.gov.

PRIVACY

Nothing is collected. Route, language, state, and answers live in memory for
the session and are discarded when the app closes. There is no analytics
SDK, no crash reporter, and no advertising SDK. The app makes no network
requests of its own — it works fully in airplane mode, since all question
data is bundled. The only network activity is a link the user taps, which is
handed to Safari.

CONTACT

long@formn400.org
```

---

## Notes for you, not for the reviewer

**Guideline 4.2 (Minimum Functionality).** The likely challenge is that a
free study app resembles a wrapped website. The defence, if it is raised:
the app works entirely offline with the question bank compiled into the
binary, uses on-device speech synthesis, and schedules local notifications —
three native capabilities a web page cannot provide. The Resources links
open Safari precisely so that there is no web view to mistake for wrapped
content. Point at the airplane-mode test.

**Guideline 5.2 / trademark.** Expect scrutiny on any government-adjacent
app. Every mitigation is already in place: no USCIS keyword, no insignia,
disclaimer on every screen plus the About tab, and no claim of affiliation
anywhere in the listing copy.

**If asked why officeholder questions are unanswered,** the "WHY SOME
QUESTIONS HAVE NO ANSWER SHOWN" paragraph above is the whole answer. Do not
be talked into hardcoding names to satisfy a reviewer — it would make the
app wrong within months and violates the project's Invariant IV.

**Contact email mismatch to resolve:** the Review Information contact in
ASC is `3ranknguyen@gmail.com` (your Apple ID) while the public support
address in the notes above is `long@formn400.org`. That is fine and normal,
but make sure the `long@formn400.org` mailbox is actually monitored, since
`support.html` publishes it.
