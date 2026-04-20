import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  demoCategories,
  demoCategoryBudgets,
  demoHousehold,
  demoMembers,
} from '../lib/demoData';
import { supabase } from '../lib/supabase';
import type {
  Category,
  CategoryBudget,
  Household,
  HouseholdMember,
} from '../lib/types';
import { useAuth } from './AuthContext';

export type HouseholdRefreshOptions = {
  /** Si true, ne pas basculer sur l’écran de chargement (évite de démonter l’onboarding pendant un refresh). */
  silent?: boolean;
};

type HouseholdContextValue = {
  household: Household | null;
  members: HouseholdMember[];
  categories: Category[];
  categoryBudgets: CategoryBudget[];
  loading: boolean;
  /** Retourne le foyer chargé, ou null si aucun / erreur (utile après onboarding). */
  refresh: (opts?: HouseholdRefreshOptions) => Promise<Household | null>;
  setHouseholdId: (id: string | null) => void;
};

const HouseholdContext = createContext<HouseholdContextValue | undefined>(
  undefined
);

export function HouseholdProvider ({ children }: { children: React.ReactNode }) {
  const { user, demoMode } = useAuth();
  const [household, setHousehold] = useState<Household | null>(null);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryBudgets, setCategoryBudgets] = useState<CategoryBudget[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (opts?: HouseholdRefreshOptions): Promise<Household | null> => {
    const silent = opts?.silent === true;
    if (!user) {
      setHousehold(null);
      setMembers([]);
      setCategories([]);
      setCategoryBudgets([]);
      setLoading(false);
      return null;
    }
    if (demoMode) {
      setHousehold(demoHousehold);
      setMembers(demoMembers);
      setCategories(demoCategories);
      setCategoryBudgets(demoCategoryBudgets);
      setLoading(false);
      return demoHousehold;
    }
    if (!silent) {
      setLoading(true);
    }
    const { data: hm, error: hmErr } = await supabase
      .from('household_members')
      .select('household_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (hmErr || !hm?.household_id) {
      setHousehold(null);
      setMembers([]);
      setCategories([]);
      setCategoryBudgets([]);
      setLoading(false);
      return null;
    }

    const hid = hm.household_id as string;

    const [hhRes, memsRes, catsRes, budgetsRes] = await Promise.all([
      supabase.from('households').select('*').eq('id', hid).single(),
      supabase.from('household_members').select('*').eq('household_id', hid),
      supabase.from('categories').select('*').eq('household_id', hid),
      supabase.from('category_budgets').select('*').eq('household_id', hid),
    ]);

    if (hhRes.error || !hhRes.data) {
      setHousehold(null);
      setMembers([]);
      setCategories([]);
      setCategoryBudgets([]);
      setLoading(false);
      return null;
    }

    const hh = hhRes.data as Household;
    setHousehold(hh);
    setMembers((memsRes.data ?? []) as HouseholdMember[]);
    setCategories((catsRes.data ?? []) as Category[]);
    setCategoryBudgets(
      budgetsRes.error ? [] : ((budgetsRes.data ?? []) as CategoryBudget[])
    );
    setLoading(false);
    return hh;
  }, [user, demoMode]);

  useEffect(() => {
    void load();
  }, [load]);

  const setHouseholdId = useCallback(
    (id: string | null) => {
      if (!id) {
        setHousehold(null);
        setMembers([]);
        setCategories([]);
        setCategoryBudgets([]);
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
      categoryBudgets,
      loading,
      refresh: load,
      setHouseholdId,
    }),
    [household, members, categories, categoryBudgets, loading, load, setHouseholdId]
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
