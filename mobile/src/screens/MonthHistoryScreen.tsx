import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useHousehold } from '../context/HouseholdContext';
import { demoHomeCockpit } from '../lib/demoData';
import { formatMonthHeading, parseMonthKeyToDate } from '../lib/dates';
import { totalsByMonthKey } from '../lib/expenseMonthTotals';
import { formatMoney } from '../lib/format';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { supabase } from '../lib/supabase';
import { screenContentPaddingTop, screenPaddingH } from '../theme/screenLayout';
import { colors, fontSize, fontWeight, hairline, radius, spacing } from '../theme/tokens';

const MONTH_COUNT = 12;

export function MonthHistoryScreen () {
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { demoMode } = useAuth();
  const { household, categories } = useHousehold();
  const [totals, setTotals] = useState<Record<string, number>>({});
  const [topCategoryByMonth, setTopCategoryByMonth] = useState<Record<string, string>>(
    {}
  );
  const [budgetGapByMonth, setBudgetGapByMonth] = useState<Record<string, number>>(
    {}
  );
  const [loading, setLoading] = useState(true);

  const keys = useMemo(() => {
    const out: string[] = [];
    const d = new Date();
    d.setDate(1);
    d.setHours(12, 0, 0, 0);
    for (let i = 0; i < MONTH_COUNT; i++) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      out.push(`${y}-${m}`);
      d.setMonth(d.getMonth() - 1);
    }
    return out;
  }, []);

  const load = useCallback(async () => {
    if (!household) {
      return;
    }
    if (demoMode) {
      const map: Record<string, number> = {};
      const top: Record<string, string> = {};
      const gap: Record<string, number> = {};
      const d = new Date();
      d.setDate(1);
      for (let i = 0; i < MONTH_COUNT; i++) {
        const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        map[k] =
          i === 0
            ? demoHomeCockpit.spent
            : Math.round(demoHomeCockpit.spent * (0.85 + i * 0.02));
        top[k] = demoHomeCockpit.topCategories[0]?.name ?? '—';
        if (household.monthly_budget_cap != null && household.monthly_budget_cap > 0) {
          gap[k] = household.monthly_budget_cap - map[k];
        }
        d.setMonth(d.getMonth() - 1);
      }
      setTotals(map);
      setTopCategoryByMonth(top);
      setBudgetGapByMonth(gap);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('expenses')
      .select('amount, spent_at, category_id')
      .eq('household_id', household.id)
      .limit(5000);
    if (error || !data) {
      setTotals({});
      setTopCategoryByMonth({});
      setBudgetGapByMonth({});
      setLoading(false);
      return;
    }
    const rows = data as { amount: number; spent_at: string; category_id: string | null }[];
    const monthTotals = totalsByMonthKey(
      rows.map((r) => ({ amount: r.amount, spent_at: r.spent_at }))
    );
    setTotals(monthTotals);
    const top: Record<string, string> = {};
    const gap: Record<string, number> = {};
    const catMap: Record<string, Record<string, number>> = {};
    for (const row of rows) {
      const d = new Date(row.spent_at);
      if (Number.isNaN(d.getTime())) {
        continue;
      }
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const catName =
        categories.find((c) => c.id === row.category_id)?.name ?? 'Sans catégorie';
      catMap[monthKey] = catMap[monthKey] ?? {};
      catMap[monthKey][catName] = (catMap[monthKey][catName] ?? 0) + Number(row.amount);
    }
    for (const k of keys) {
      const cats = catMap[k];
      if (cats) {
        const best = Object.entries(cats).sort((a, b) => b[1] - a[1])[0];
        if (best) {
          top[k] = best[0];
        }
      }
      if (household.monthly_budget_cap != null && household.monthly_budget_cap > 0) {
        gap[k] = household.monthly_budget_cap - (monthTotals[k] ?? 0);
      }
    }
    setTopCategoryByMonth(top);
    setBudgetGapByMonth(gap);
    setLoading(false);
  }, [household, demoMode, categories, keys]);

  useEffect(() => {
    void load();
  }, [load]);

  function openRecap (monthKey: string) {
    navigation.navigate('MonthlyRecap', { initialMonthKey: monthKey });
  }

  if (!household) {
    return null;
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: screenContentPaddingTop(insets.top),
          paddingBottom: insets.bottom + spacing.xl,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.kicker}>Dans le temps</Text>
      <Text style={styles.title}>Historique mensuel</Text>
      <Text style={styles.sub}>
        Un total par mois — touchez une ligne pour ouvrir le récap détaillé.
      </Text>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <Card variant="outline" density="compact" style={styles.listCard}>
          {keys.map((k, i) => {
            const d = parseMonthKeyToDate(k);
            const label = d ? formatMonthHeading(d) : k;
            const total = totals[k] ?? 0;
            const topCat = topCategoryByMonth[k];
            const gap = budgetGapByMonth[k];
            return (
              <Pressable
                key={k}
                onPress={() => openRecap(k)}
                style={[
                  styles.row,
                  i < keys.length - 1 && styles.rowBorder,
                ]}
                accessibilityRole="button"
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{label}</Text>
                  <Text style={styles.rowHint}>
                    {topCat ? `Top: ${topCat}` : 'Récap & mémo'}
                    {gap != null
                      ? ` · ${gap >= 0 ? 'Marge' : 'Depassement'} ${formatMoney(
                          Math.abs(gap),
                          household.currency
                        )}`
                      : ''}
                  </Text>
                </View>
                <Text style={styles.rowAmt}>
                  {formatMoney(total, household.currency)}
                </Text>
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </Pressable>
            );
          })}
        </Card>
      )}

      <Pressable
        style={styles.close}
        onPress={() => navigation.goBack()}
        hitSlop={12}
      >
        <Text style={styles.closeTxt}>Fermer</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingHorizontal: screenPaddingH },
  kicker: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.medium,
    color: colors.textMuted,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  title: {
    marginTop: spacing.xs,
    fontSize: fontSize.title,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  sub: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    fontSize: fontSize.small,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  loading: { paddingVertical: spacing.xxl, alignItems: 'center' },
  listCard: { marginBottom: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    gap: spacing.sm,
  },
  rowBorder: {
    borderBottomWidth: hairline,
    borderBottomColor: colors.borderLight,
  },
  rowTitle: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.medium,
    color: colors.text,
  },
  rowHint: {
    marginTop: 2,
    fontSize: fontSize.micro,
    color: colors.textMuted,
  },
  rowAmt: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  close: { alignItems: 'center', paddingVertical: spacing.md },
  closeTxt: {
    fontSize: fontSize.small,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
});
