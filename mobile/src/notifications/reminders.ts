// Opt-in daily study reminder — LOCAL notifications only.
//
// No push token is ever requested, no APNs entitlement is needed, nothing is
// sent to or received from a server. `expo-notifications` needs no iOS
// usage-description string and no config plugin for local notifications
// (SDK 56 docs, "Notifications": "No usage description is required").
//
// INVARIANT VIII — the on/off state is NOT persisted anywhere. It is derived
// at read time from the OS's own scheduled-notification list via
// `getAllScheduledNotificationsAsync()`. The operating system already has to
// store the schedule in order to fire it; we add no storage of our own, no
// AsyncStorage, no file, no preference key.
//
// Permission is requested ONLY when the user turns the toggle on. Nothing
// happens at launch — no prompt, no probe, no permission read.

import * as Notifications from 'expo-notifications';

// Tags our own reminder so we never cancel a notification we did not create.
const REMINDER_ID = 'n400-daily-study-reminder';

export const DEFAULT_HOUR = 19; // 7pm local
export const DEFAULT_MINUTE = 0;

export type ReminderState = {
  enabled: boolean;
  hour: number;
  minute: number;
};

export const REMINDER_OFF: ReminderState = {
  enabled: false,
  hour: DEFAULT_HOUR,
  minute: DEFAULT_MINUTE,
};

// Foreground presentation. Registered once at module load; this schedules
// nothing and requests nothing.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/**
 * Read current state from the OS scheduler. This is the single source of
 * truth — there is no app-side copy to drift out of sync.
 */
export async function readReminderState(): Promise<ReminderState> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const ours = scheduled.find(
      (n) => n.content?.data?.['id'] === REMINDER_ID,
    );
    if (!ours) return REMINDER_OFF;

    const trigger = ours.trigger as unknown as
      | { hour?: number; minute?: number }
      | null;
    return {
      enabled: true,
      hour: typeof trigger?.hour === 'number' ? trigger.hour : DEFAULT_HOUR,
      minute: typeof trigger?.minute === 'number' ? trigger.minute : DEFAULT_MINUTE,
    };
  } catch {
    return REMINDER_OFF;
  }
}

export type EnableResult =
  | { ok: true; state: ReminderState }
  | { ok: false; reason: 'permission-denied' | 'schedule-failed' };

/**
 * Turn the reminder on. Requests permission at this moment and only this
 * moment. Returns `permission-denied` so the caller can show a real message
 * rather than leaving a toggle that silently snaps back.
 */
export async function enableReminder(
  hour: number = DEFAULT_HOUR,
  minute: number = DEFAULT_MINUTE,
): Promise<EnableResult> {
  try {
    const current = await Notifications.getPermissionsAsync();
    let granted = current.granted;
    if (!granted) {
      const asked = await Notifications.requestPermissionsAsync();
      granted = asked.granted;
    }
    if (!granted) return { ok: false, reason: 'permission-denied' };

    // Clear ours first so toggling twice cannot stack duplicates.
    await cancelReminder();

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Civics practice',
        body: 'A few questions today keeps the 128 fresh before your interview.',
        data: { id: REMINDER_ID },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });
    return { ok: true, state: { enabled: true, hour, minute } };
  } catch {
    return { ok: false, reason: 'schedule-failed' };
  }
}

/**
 * Turn the reminder off. Cancels only notifications this app scheduled and
 * tagged; falls back to cancelling all of ours if the tag lookup fails.
 */
export async function cancelReminder(): Promise<void> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const ours = scheduled.filter(
      (n) => n.content?.data?.['id'] === REMINDER_ID,
    );
    if (ours.length === 0) return;
    await Promise.all(
      ours.map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
    );
  } catch {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch {
      // Nothing further we can do; the toggle will re-read and show reality.
    }
  }
}

export function formatTime(hour: number, minute: number): string {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  const ampm = hour < 12 ? 'AM' : 'PM';
  return `${h12}:${String(minute).padStart(2, '0')} ${ampm}`;
}
