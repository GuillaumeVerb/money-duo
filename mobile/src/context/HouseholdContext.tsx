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
  refresh: (opts?: HouseholdRefreshOptions) => Promise<void>;
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

  const load = useCallback(async (opts?: HouseholdRefreshOptions) => {
    const silent = opts?.silent === true;
    if (!user) {
      setHousehold(null);
      setMembers([]);
      setCategories([]);
      setCategoryBudgets([]);
      setLoading(false);
      return;
    }
    if (demoMode) {
      setHousehold(demoHousehold);
      setMembers(demoMembers);
      setCategories(demoCategories);
      setCategoryBudgets(demoCategoryBudgets);
      setLoading(false);
      return;
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
      return;
    }

    const hid = hm.household_id as string;

    const [{ data: hh }, { data: mems }, { data: cats }, budgetsRes] =
      await Promise.all([
        supabase.from('households').select('*').eq('id', hid).single(),
        supabase.from('household_members').select('*').eq('household_id', hid),
        supabase.from('categories').select('*').eq('household_id', hid),
        supabase.from('category_budgets').select('*').eq('household_id', hid),
      ]);

    setHousehold(hh as Household);
    setMembers((mems ?? []) as HouseholdMember[]);
    setCategories((cats ?? []) as Category[]);
    setCategoryBudgets(
      budgetsRes.error ? [] : ((budgetsRes.data ?? []) as CategoryBudget[])
    );
    setLoading(false);
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
