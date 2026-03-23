import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { supabase } from '../lib/supabase';
import type { Category, Household, HouseholdMember } from '../lib/types';
import { useAuth } from './AuthContext';

type HouseholdContextValue = {
  household: Household | null;
  members: HouseholdMember[];
  categories: Category[];
  loading: boolean;
  refresh: () => Promise<void>;
  setHouseholdId: (id: string | null) => void;
};

const HouseholdContext = createContext<HouseholdContextValue | undefined>(
  undefined
);

export function HouseholdProvider ({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [household, setHousehold] = useState<Household | null>(null);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setHousehold(null);
      setMembers([]);
      setCategories([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: hm, error: hmErr } = await supabase
      .from('household_members')
      .select('household_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();

    if (hmErr || !hm?.household_id) {
      setHousehold(null);
      setMembers([]);
      setCategories([]);
      setLoading(false);
      return;
    }

    const hid = hm.household_id as string;

    const [{ data: hh }, { data: mems }, { data: cats }] = await Promise.all([
      supabase.from('households').select('*').eq('id', hid).single(),
      supabase.from('household_members').select('*').eq('household_id', hid),
      supabase.from('categories').select('*').eq('household_id', hid),
    ]);

    setHousehold(hh as Household);
    setMembers((mems ?? []) as HouseholdMember[]);
    setCategories((cats ?? []) as Category[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const setHouseholdId = useCallback(
    (id: string | null) => {
      if (!id) {
        setHousehold(null);
        setMembers([]);
        setCategories([]);
        return;
      }
      void load();
    },
    [load]
  );

  const value = useMemo(
    () => ({
      household,
      members,
      categories,
      loading,
      refresh: load,
      setHouseholdId,
    }),
    [household, members, categories, loading, load, setHouseholdId]
  );

  return (
    <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>
  );
}

export function useHousehold () {
  const ctx = useContext(HouseholdContext);
  if (!ctx) {
    throw new Error('useHousehold must be used within HouseholdProvider');
  }
  return ctx;
}
