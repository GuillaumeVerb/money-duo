import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useHousehold } from '../context/HouseholdContext';
import { isDateInRangeInclusive, monthBoundsISO } from '../lib/dates';
import { formatMoney } from '../lib/format';
import {
  fetchLedgerExpenseRows,
  fetchSettlementLines,
  fetchSplitsByExpenseIds,
  netBalancesFromLedger,
  pairwiseOwedForMembers,
} from '../lib/ledger';
import { openAddExpense } from '../navigation/openAddExpense';
import type { Goal, RecurringTemplate } from '../lib/types';
import { supabase } from '../lib/supabase';
import { colors, fontSize, radius, spacing } from '../theme/tokens';

export function HomeScreen () {
  const navigation = useNavigation ();
  const { household, members, categories, refresh } = useHousehold ();
  const [spent, setSpent] = useState (0);
  const [owed, setOwed] = useState (0);
  const [goal, setGoal] = useState<Goal | null> (null);
  const [nextCharge, setNextCharge] = useState<RecurringTemplate | null> (null);
  const [topCats, setTopCats] = useState<{ name: string; total: number }[]>([]);

  const load = useCallback (async () => {
    if (!household) {
      return;
    }
    const { start, end } = monthBoundsISO ();
    const catName = (id: string | null) =>
      categories.find ((c) => c.id === id)?.name ?? 'Sans catégorie';

    try {
      const allExpenses = await fetchLedgerExpenseRows (household.id);
      const monthRows = allExpenses.filter ((e) =>
        isDateInRangeInclusive (e.spent_at, start, end)
      );

      setSpent (monthRows.reduce ((s, e) => s + e.amount, 0));

      const catMap: Record<string, number> = {};
      for (const e of monthRows) {
        const key = catName (e.category_id);
        catMap[key] = (catMap[key] ?? 0) + e.amount;
      }
      setTopCats (
        Object.entries (catMap)
          .sort ((a, b) => b[1] - a[1])
          .slice (0, 3)
          .map (([name, total]) => ({ name, total }))
      );

      const nonPersonal = allExpenses.filter ((e) => e.expense_type !== 'personal');
      const splitIds = nonPersonal.map ((e) => e.id);
      const splitsMap = await fetchSplitsByExpenseIds (splitIds);
      const settlementLines = await fetchSettlementLines (household.id);
      const nets = netBalancesFromLedger (allExpenses, splitsMap, settlementLines);
      const memberIds = members.map ((m) => m.id);
      setOwed (pairwiseOwedForMembers (memberIds, nets));

      const [{ data: goals }, { data: rec }] = await Promise.all ([
        supabase
          .from ('goals')
          .select ('*')
          .eq ('household_id', household.id)
          .order ('created_at', { ascending: false })
          .limit (1),
        supabase
          .from ('recurring_expense_templates')
          .select ('*')
          .eq ('household_id', household.id)
          .order ('next_occurrence', { ascending: true })
          .limit (1),
      ]);

      setGoal ((goals?.[0] as Goal) ?? null);
      setNextCharge ((rec?.[0] as RecurringTemplate) ?? null);
    } catch {
      setSpent (0);
      setOwed (0);
      setTopCats ([]);
      setGoal (null);
      setNextCharge (null);
    }
  }, [household, members, categories]);

  useFocusEffect (
    useCallback (() => {
      void load ();
      void refresh ();
    }, [load, refresh])
  );

  if (!household) {
    return null;
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.monthTitle}>Ce mois-ci</Text>
      <View style={styles.card}>
        <Text style={styles.muted}>Dépensé</Text>
        <Text style={styles.big}>{formatMoney (spent, household.currency)}</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.muted}>Écart à régulariser</Text>
        <Text style={[styles.big, { color: colors.alertSoft }]}>
          {formatMoney (Math.abs (owed), household.currency)}{' '}
          <Text style={styles.caption}>
            {owed === 0
              ? '(équilibré)'
              : owed > 0
                ? '(à recevoir)'
                : '(à payer)'}
          </Text>
        </Text>
      </View>
      {goal ? (
        <View style={styles.card}>
          <Text style={styles.muted}>Objectif — {goal.name}</Text>
          <Text style={styles.body}>
            {formatMoney (goal.current_amount, household.currency)} /{' '}
            {formatMoney (goal.target_amount, household.currency)}
          </Text>
        </View>
      ) : null}
      {nextCharge ? (
        <View style={styles.card}>
          <Text style={styles.muted}>Prochaine charge</Text>
          <Text style={styles.body}>
            {nextCharge.label} —{' '}
            {formatMoney (nextCharge.amount, household.currency)} (
            {nextCharge.next_occurrence})
          </Text>
        </View>
      ) : null}
      {topCats.length ? (
        <View style={styles.card}>
          <Text style={styles.muted}>Top catégories</Text>
          {topCats.map ((c) => (
            <Text key={c.name} style={styles.body}>
              {c.name} — {formatMoney (c.total, household.currency)}
            </Text>
          ))}
        </View>
      ) : null}
      <Pressable
        style={styles.primary}
        onPress={() => openAddExpense (navigation)}
      >
        <Text style={styles.primaryText}>Ajouter une dépense</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create ({
  root: { flex: 1, backgroundColor: colors.neutralWarm },
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  monthTitle: {
    fontSize: fontSize.title,
    fontWeight: '700',
    marginBottom: spacing.md,
    color: colors.neutralText,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  muted: { color: colors.neutralMuted, fontSize: fontSize.caption },
  big: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.neutralText,
    marginTop: spacing.xs,
  },
  body: { fontSize: fontSize.body, color: colors.neutralText, marginTop: spacing.xs },
  caption: { fontSize: fontSize.caption, fontWeight: '400' },
  primary: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  primaryText: { color: colors.surface, fontWeight: '700', fontSize: fontSize.body },
});
