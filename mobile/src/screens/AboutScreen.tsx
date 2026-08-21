// About / legal screen.
//
// Reachable from the top tab bar on every launch. Carries the two legal
// notices required for App Review, copied VERBATIM from the published
// support page at https://formn400.org/support.html — do not paraphrase,
// do not shorten. If support.html changes, update these strings to match.
//
// Invariant V: the per-screen footer disclaimer in App.tsx stays regardless
// of this screen; this screen is in addition to it, never a replacement.
// Invariant VI: no government insignia, no flag emoji used as a seal.
// Invariant VII: links out to formn400.org and uscis.gov only — no legal
// advice is offered here or anywhere in the app.

import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import appJson from '../../app.json';
import {
  cancelReminder,
  enableReminder,
  formatTime,
  readReminderState,
  REMINDER_OFF,
  type ReminderState,
} from '../notifications/reminders.ts';

// ─── VERBATIM from https://formn400.org/support.html ────────────────────
// support.html <div class="disclaimer">
const DISCLAIMER_INDEPENDENT =
  'FormN400.org is an independent study tool. It is not affiliated with, ' +
  'authorized, endorsed, or approved by USCIS, DHS, or any U.S. government agency.';

// support.html <div class="no-advice">
const DISCLAIMER_NO_LEGAL_ADVICE =
  'We cannot provide legal advice. For immigration legal questions, ' +
  'consult a licensed attorney or accredited representative.';
// ────────────────────────────────────────────────────────────────────────

const PRIVACY_URL = 'https://formn400.org/privacy.html';
const SUPPORT_URL = 'https://formn400.org/support.html';
const TESTUPDATES_URL = 'https://www.uscis.gov/citizenship/testupdates';

const APP_VERSION = appJson.expo.version;
const APP_NAME = appJson.expo.name;

async function openLink(url: string): Promise<void> {
  try {
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert('Could not open link', url);
      return;
    }
    await Linking.openURL(url);
  } catch {
    Alert.alert('Could not open link', url);
  }
}

export function AboutScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>About</Text>

      <Text style={styles.lead}>
        {APP_NAME} is a free study tool for the civics portion of the U.S.
        naturalization interview. There is no account, no sign-in, and no
        advertising.
      </Text>

      <Text style={styles.sectionHeader}>Important notices</Text>

      <View style={styles.noticeNavy}>
        <Text style={styles.noticeText}>{DISCLAIMER_INDEPENDENT}</Text>
      </View>

      <View style={styles.noticeRed}>
        <Text style={styles.noticeText}>{DISCLAIMER_NO_LEGAL_ADVICE}</Text>
      </View>

      <Text style={styles.sectionHeader}>Read aloud</Text>
      <Text style={styles.body}>
        Tap "Hear the question" on any question, or "Hear the answer" after you
        answer, to have it read out loud. The app uses the voices already
        installed on your device. If your device has no voice for the language
        you picked, the text is read in English and the question shows an
        "Audio in English" note — Hmong has no voice on any device, so it is
        always read in English. You can add more voices in the iOS Settings
        app under Accessibility → Spoken Content → Voices.
      </Text>

      <Text style={styles.sectionHeader}>Study reminder</Text>
      <ReminderToggle />

      <Text style={styles.sectionHeader}>Privacy</Text>
      <Text style={styles.body}>
        This app does not collect any personal data. Your route, language, and
        state selections and your quiz answers stay in device memory for the
        current session only. Nothing is transmitted, stored, or logged. The
        app makes no network requests of its own — links you tap open in your
        system browser.
      </Text>
      <Text style={[styles.body, styles.bodySpaced]}>
        The study reminder is a local notification scheduled by your device.
        It involves no server and no account, and the app stores nothing to
        remember it — the on/off state above is read back from your device's
        own scheduled-notification list each time this screen opens.
      </Text>

      <Text style={styles.sectionHeader}>Links</Text>
      <View style={styles.list}>
        <LinkRow
          title="Privacy Policy"
          url={PRIVACY_URL}
          detail="The full published privacy policy for formn400.org and this app."
        />
        <LinkRow
          title="Support"
          url={SUPPORT_URL}
          detail="Report an error, ask a question, or contact us."
        />
        <LinkRow
          title="USCIS test updates and current officials"
          url={TESTUPDATES_URL}
          detail="Answers that change after an election or appointment are not shown in this app. Check here before your interview."
        />
      </View>

      <Text style={styles.sectionHeader}>Version</Text>
      <Text style={styles.version}>
        {APP_NAME} {APP_VERSION}
      </Text>
      <Text style={styles.copyright}>© 2026 Huu Long Nguyen</Text>
    </ScrollView>
  );
}

// Opt-in daily reminder. State is derived from the OS scheduler on every
// mount — the app persists nothing (Invariant VIII). Permission is requested
// only when the user switches this on.
function ReminderToggle() {
  const [state, setState] = useState<ReminderState>(REMINDER_OFF);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const next = await readReminderState();
    setState(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onToggle = useCallback(
    async (next: boolean) => {
      setBusy(true);
      if (next) {
        const result = await enableReminder();
        if (!result.ok) {
          if (result.reason === 'permission-denied') {
            Alert.alert(
              'Notifications are off',
              'Turn on notifications for this app in the Settings app to get a daily study reminder.',
            );
          } else {
            Alert.alert(
              'Could not set the reminder',
              'Your device declined to schedule the reminder. Please try again.',
            );
          }
        }
      } else {
        await cancelReminder();
      }
      await refresh();
      setBusy(false);
    },
    [refresh],
  );

  if (loading) {
    return (
      <View style={styles.reminderRow}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View>
      <View style={styles.reminderRow}>
        <View style={styles.reminderLabelWrap}>
          <Text style={styles.reminderLabel}>Daily reminder</Text>
          <Text style={styles.reminderDetail}>
            {state.enabled
              ? `Every day at ${formatTime(state.hour, state.minute)}`
              : 'Off — no notifications are scheduled'}
          </Text>
        </View>
        <Switch
          value={state.enabled}
          onValueChange={(v) => {
            void onToggle(v);
          }}
          disabled={busy}
          accessibilityLabel="Daily study reminder"
        />
      </View>
      <Text style={styles.reminderNote}>
        Optional. The app works exactly the same with this off.
      </Text>
    </View>
  );
}

function LinkRow({
  title,
  url,
  detail,
}: {
  title: string;
  url: string;
  detail?: string;
}) {
  return (
    <Pressable
      onPress={() => {
        void openLink(url);
      }}
      style={styles.linkRow}
      accessibilityRole="link"
      accessibilityLabel={title}
    >
      <Text style={styles.linkTitle}>{title}</Text>
      {detail !== undefined && <Text style={styles.linkDetail}>{detail}</Text>}
      <Text style={styles.linkUrl}>{url}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 60,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#0d2052',
    marginTop: 8,
    marginBottom: 10,
  },
  lead: {
    fontSize: 15,
    color: '#334166',
    lineHeight: 22,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#555',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 24,
    marginBottom: 10,
  },
  body: {
    fontSize: 14,
    color: '#334166',
    lineHeight: 21,
  },
  noticeNavy: {
    borderLeftWidth: 4,
    borderLeftColor: '#0d2052',
    backgroundColor: '#f3f5fa',
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  noticeRed: {
    borderLeftWidth: 4,
    borderLeftColor: '#b22234',
    backgroundColor: '#fef6f7',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  noticeText: {
    fontSize: 14,
    color: '#334166',
    lineHeight: 21,
  },
  bodySpaced: {
    marginTop: 12,
  },
  list: {
    gap: 10,
  },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#dde2ea',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#fafbfd',
    gap: 12,
    minHeight: 62,
  },
  reminderLabelWrap: {
    flex: 1,
  },
  reminderLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0d2052',
  },
  reminderDetail: {
    fontSize: 13,
    color: '#444',
    marginTop: 3,
  },
  reminderNote: {
    fontSize: 12,
    color: '#6b7a99',
    marginTop: 8,
  },
  linkRow: {
    borderWidth: 1,
    borderColor: '#dde2ea',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#fafbfd',
  },
  linkTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0d2052',
  },
  linkDetail: {
    fontSize: 13,
    color: '#444',
    marginTop: 4,
    lineHeight: 18,
  },
  linkUrl: {
    fontSize: 11,
    color: '#0d2052',
    marginTop: 6,
    textDecorationLine: 'underline',
  },
  version: {
    fontSize: 14,
    color: '#334166',
  },
  copyright: {
    fontSize: 12,
    color: '#6b7a99',
    marginTop: 6,
  },
});
