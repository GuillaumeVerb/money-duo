import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getPreferredReminderHour } from './localPrefs';
import { STORAGE_KEYS } from './storageKeys';

const ANDROID_CHANNEL_ID = 'moneyduo-reminders';

async function ensureAndroidChannel (): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'Rappels doux',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

async function loadIdMap (): Promise<Record<string, string>> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.decisionMemoReminderMap);
  if (!raw) {
    return {};
  }
  try {
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

async function saveIdMap (map: Record<string, string>): Promise<void> {
  await AsyncStorage.setItem(
    STORAGE_KEYS.decisionMemoReminderMap,
    JSON.stringify(map)
  );
}

function storageKey (householdId: string, monthKey: string): string {
  return `${householdId}:${monthKey}`;
}

export type DecisionMemoReminderResult =
  | { ok: true }
  | { ok: false; message: string };

/**
 * Annule l’ancien rappel pour ce mois, puis en planifie un nouveau si
 * `remindAtYmd` est défini (heure locale = préférence rappels). No-op sur le web.
 */
export async function syncDecisionMemoReminder (opts: {
  householdId: string;
  monthKey: string;
  monthLabel: string;
  remindAtYmd: string | null;
}): Promise<DecisionMemoReminderResult> {
  const map = await loadIdMap();
  const key = storageKey(opts.householdId, opts.monthKey);
  const prevId = map[key];
  if (prevId) {
    try {
      await Notifications.cancelScheduledNotificationAsync(prevId);
    } catch {
      /* id invalide */
    }
    delete map[key];
  }

  if (!opts.remindAtYmd) {
    await saveIdMap(map);
    return { ok: true };
  }

  if (Platform.OS === 'web') {
    await saveIdMap(map);
    return {
      ok: false,
      message:
        'Les rappels locaux ne sont pas disponibles sur le web — la date est enregistrée.',
    };
  }

  await ensureAndroidChannel();

  const parts = opts.remindAtYmd.trim().slice(0, 10).split('-');
  if (parts.length !== 3) {
    await saveIdMap(map);
    return { ok: true };
  }
  const y = Number(parts[0]);
  const mo = Number(parts[1]);
  const d = Number(parts[2]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) {
    await saveIdMap(map);
    return { ok: true };
  }

  const hour = await getPreferredReminderHour();
  const fireAt = new Date(y, mo - 1, d, hour, 0, 0, 0);
  if (fireAt.getTime() <= Date.now()) {
    await saveIdMap(map);
    return { ok: true };
  }

  const existing = await Notifications.getPermissionsAsync();
  if (existing.status !== 'granted') {
    const req = await Notifications.requestPermissionsAsync();
    if (req.status !== 'granted') {
      await saveIdMap(map);
      return {
        ok: false,
        message:
          'Notifications refusées — le rappel « se reparler » n’a pas été planifié.',
      };
    }
  }

  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Money Duo',
      body: `Moment prévu pour reprendre le mémo du mois (${opts.monthLabel}).`,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: fireAt,
      ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL_ID } : {}),
    },
  });

  map[key] = notificationId;
  await saveIdMap(map);
  return { ok: true };
}
