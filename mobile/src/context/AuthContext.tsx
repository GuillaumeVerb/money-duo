import type { Session, User } from '@supabase/supabase-js';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { DEMO_USER_ID } from '../lib/demoData';
import { supabase } from '../lib/supabase';

const demoPreviewUser = {
  id: DEMO_USER_ID,
  email: 'demo@aperçu.local',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: new Date().toISOString(),
} as User;

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  /** Navigation UI sans backend (données fictives). */
  demoMode: boolean;
  isAuthenticated: boolean;
  enterDemoMode: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  /** Demande un e-mail de réinitialisation (flux Supabase). */
  resetPasswordForEmail: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider ({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [demoMode, setDemoMode] = useState(false);

  useEffect(() => {
    let mounted = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setSession(data.session ?? null);
        setLoading(false);
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, next) => {
      setSession(next);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (session?.user) {
      setDemoMode(false);
    }
  }, [session?.user]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      throw error;
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const webBase =
      typeof process !== 'undefined' && process.env.EXPO_PUBLIC_WEB_APP_URL
        ? String(process.env.EXPO_PUBLIC_WEB_APP_URL).replace(/\/$/, '')
        : '';
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options:
        webBase.length > 0
          ? { emailRedirectTo: `${webBase}/` }
          : undefined,
    });
    if (error) {
      throw error;
    }
  }, []);

  const resetPasswordForEmail = useCallback(async (email: string) => {
    const webBase =
      typeof process !== 'undefined' && process.env.EXPO_PUBLIC_WEB_APP_URL
        ? String(process.env.EXPO_PUBLIC_WEB_APP_URL).replace(/\/$/, '')
        : '';
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: webBase.length > 0 ? `${webBase}/` : undefined,
    });
    if (error) {
      throw error;
    }
  }, []);

  const signOut = useCallback(async () => {
    setDemoMode(false);
    await supabase.auth.signOut();
  }, []);

  const enterDemoMode = useCallback(() => {
    setDemoMode(true);
  }, []);

  const user = useMemo(() => {
    if (demoMode) {
      return demoPreviewUser;
    }
    return session?.user ?? null;
  }, [demoMode, session?.user]);

  const isAuthenticated = !!(session || demoMode);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      loading,
      demoMode,
      isAuthenticated,
      enterDemoMode,
      signIn,
      signUp,
      resetPasswordForEmail,
      signOut,
    }),
    [
      session,
      user,
      loading,
      demoMode,
      isAuthenticated,
      enterDemoMode,
      signIn,
      signUp,
      resetPasswordForEmail,
      signOut,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth () {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
