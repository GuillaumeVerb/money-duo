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

async function cancelStoredReminder (): Promise<void> {
  const id = await AsyncStorage.getItem(STORAGE_KEYS.scheduledReminderId);
  if (id) {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch {
      /* id invalide après réinstall */
    }
    await AsyncStorage.removeItem(STORAGE_KEYS.scheduledReminderId);
  }
}

export type ReminderSyncResult =
  | { ok: true }
  | { ok: false; message: string };

/**
 * Active ou désactive le rappel hebdomadaire (lundi, heure locale selon préférence).
 * Sur le web : no-op avec message explicatif côté UI si besoin.
 */
export async function syncRemindersFromPreference (
  enabled: boolean,
  hourOverride?: number
): Promise<ReminderSyncResult> {
  if (Platform.OS === 'web') {
    return {
      ok: false,
      message:
        'Les notifications ne sont pas disponibles dans cette version web.',
    };
  }

  await ensureAndroidChannel();
  await cancelStoredReminder();

  if (!enabled) {
    return { ok: true };
  }

  const perm = await Notifications.requestPermissionsAsync();
  if (perm.status !== 'granted') {
    return {
      ok: false,
      message:
        'Autorisation refusée. Activez les notifications pour Money Duo dans les réglages du téléphone.',
    };
  }

  const hour =
    hourOverride !== undefined
      ? Math.min(23, Math.max(0, Math.round(hourOverride)))
      : await getPreferredReminderHour();

  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Money Duo',
      body:
        'Petit rappel : un coup d’œil sur l’équilibre du foyer cette semaine ?',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: 2,
      hour,
      minute: 0,
      ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL_ID } : {}),
    },
  });

  await AsyncStorage.setItem(STORAGE_KEYS.scheduledReminderId, notificationId);
  return { ok: true };
}
