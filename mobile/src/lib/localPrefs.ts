import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from './storageKeys';

export async function getRemindersEnabled (): Promise<boolean> {
  const v = await AsyncStorage.getItem(STORAGE_KEYS.remindersEnabled);
  return v === 'true';
}

export async function setRemindersEnabled (value: boolean): Promise<void> {
  await AsyncStorage.setItem(
    STORAGE_KEYS.remindersEnabled,
    value ? 'true' : 'false'
  );
}

export async function getAnalyticsOptIn (): Promise<boolean> {
  const v = await AsyncStorage.getItem(STORAGE_KEYS.analyticsOptIn);
  return v === 'true';
}

export async function setAnalyticsOptIn (value: boolean): Promise<void> {
  await AsyncStorage.setItem(
    STORAGE_KEYS.analyticsOptIn,
    value ? 'true' : 'false'
  );
}

export async function getProductTourDone (): Promise<boolean> {
  const v = await AsyncStorage.getItem(STORAGE_KEYS.productTourDone);
  return v === 'true';
}

export async function setProductTourDone (): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.productTourDone, 'true');
}

const DEFAULT_REMINDER_HOUR = 9;

export async function getPreferredReminderHour (): Promise<number> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.preferredReminderHour);
  const n = raw != null ? Number(raw) : NaN;
  if (!Number.isInteger(n) || n < 0 || n > 23) {
    return DEFAULT_REMINDER_HOUR;
  }
  return n;
}

export async function setPreferredReminderHour (hour: number): Promise<void> {
  const h = Math.min(23, Math.max(0, Math.round(hour)));
  await AsyncStorage.setItem(STORAGE_KEYS.preferredReminderHour, String(h));
}
