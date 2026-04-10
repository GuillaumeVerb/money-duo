import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from './storageKeys';

export type LocalAnalyticsEvent = {
  ts: string;
  name: string;
  payload?: Record<string, unknown>;
};

const MAX_EVENTS = 80;

async function isOptIn (): Promise<boolean> {
  const v = await AsyncStorage.getItem(STORAGE_KEYS.analyticsOptIn);
  return v === 'true';
}

/** Enregistre un événement si l’utilisateur a activé le journal local (aucune donnée envoyée au réseau). */
export async function trackEvent (
  name: string,
  payload?: Record<string, unknown>
): Promise<void> {
  if (!(await isOptIn())) {
    return;
  }
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.analyticsEvents);
  let list: LocalAnalyticsEvent[] = [];
  try {
    list = raw ? (JSON.parse(raw) as LocalAnalyticsEvent[]) : [];
  } catch {
    list = [];
  }
  const next: LocalAnalyticsEvent[] = [
    { ts: new Date().toISOString(), name, payload },
    ...list,
  ].slice(0, MAX_EVENTS);
  await AsyncStorage.setItem(
    STORAGE_KEYS.analyticsEvents,
    JSON.stringify(next)
  );
}

export async function getRecentEvents (limit = 20): Promise<LocalAnalyticsEvent[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.analyticsEvents);
  if (!raw) {
    return [];
  }
  try {
    const list = JSON.parse(raw) as LocalAnalyticsEvent[];
    return list.slice(0, limit);
  } catch {
    return [];
  }
}

export async function clearEvents (): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEYS.analyticsEvents);
}
