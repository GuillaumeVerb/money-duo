import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

type AuthStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

/** Sur le web, forcer localStorage pour la session Auth (évite des requêtes sans JWT avec AsyncStorage RN). */
const webAuthStorage: AuthStorage = {
  getItem: (key: string) => {
    if (typeof window === 'undefined') {
      return Promise.resolve(null);
    }
    return Promise.resolve(window.localStorage.getItem(key));
  },
  setItem: (key: string, value: string) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(key, value);
    }
    return Promise.resolve();
  },
  removeItem: (key: string) => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(key);
    }
    return Promise.resolve();
  },
};

const rawUrl =
  Constants.expoConfig?.extra?.supabaseUrl ??
  process.env.EXPO_PUBLIC_SUPABASE_URL;
const rawAnon =
  Constants.expoConfig?.extra?.supabaseAnonKey ??
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** Présent uniquement si les variables d’environnement sont renseignées (projet réel). */
export const isSupabaseConfigured = Boolean(rawUrl && rawAnon);

/** Valeurs factices pour que l’UI démarre sans .env (aperçu / dev uniquement). */
const devPlaceholderUrl = 'https://preview.invalid.supabase.co';
const devPlaceholderAnon =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.dev-placeholder-not-for-prod';

const url = rawUrl ?? devPlaceholderUrl;
const anon = rawAnon ?? devPlaceholderAnon;

if (!isSupabaseConfigured) {
  console.warn(
    'Money Duo: EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY absents — mode aperçu (requêtes API échoueront tant que le .env n’est pas configuré).'
  );
}

export const supabase = createClient(url, anon, {
  auth: {
    storage: Platform.OS === 'web' ? webAuthStorage : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    /** Web : récupère la session depuis les liens e-mail (confirmation, reset). */
    detectSessionInUrl: Platform.OS === 'web',
  },
});
