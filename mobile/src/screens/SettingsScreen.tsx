import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useHousehold } from '../context/HouseholdContext';
import { formatMoney } from '../lib/format';
import { parseAmount } from '../lib/parseAmount';
import { supabase } from '../lib/supabase';
import type { ExpenseType, RecurringTemplate, SplitRuleKind } from '../lib/types';
import { colors, fontSize, radius, spacing } from '../theme/tokens';

export function SettingsScreen () {
  const { signOut } = useAuth();
  const { household, members, refresh } = useHousehold();
  const [hhName, setHhName] = useState('');
  const [rule, setRule] = useState<SplitRuleKind>('equal');
  const [customPct, setCustomPct] = useState('50');
  const [incomes, setIncomes] = useState<Record<string, string>>({});
  const [recurring, setRecurring] = useState<RecurringTemplate[]>([]);
  const [recLabel, setRecLabel] = useState('');
  const [recAmount, setRecAmount] = useState('');
  const [recNext, setRecNext] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );

  useEffect(() => {
    if (household) {
      setHhName(household.name);
      setRule(household.default_split_rule);
      setCustomPct(
        household.default_custom_percent != null
          ? String(household.default_custom_percent)
          : '50'
      );
    }
  }, [household]);

  useEffect(() => {
    const m: Record<string, string> = {};
    for (const x of members) {
      m[x.id] =
        x.monthly_income != null ? String(x.monthly_income) : '';
    }
    setIncomes(m);
  }, [members]);

  const loadRec = useCallback(async () => {
    if (!household) {
      return;
    }
    const { data } = await supabase
      .from('recurring_expense_templates')
      .select('*')
      .eq('household_id', household.id)
      .order('next_occurrence', { ascending: true });
    setRecurring((data ?? []) as RecurringTemplate[]);
  }, [household]);

  useEffect(() => {
    void loadRec();
  }, [loadRec]);

  async function saveHousehold () {
    if (!household) {
      return;
    }
    const { error } = await supabase
      .from('households')
      .update({
        name: hhName.trim(),
        default_split_rule: rule,
        default_custom_percent:
          rule === 'custom_percent' ? Number(customPct) : null,
      })
      .eq('id', household.id);
    if (error) {
      Alert.alert('Erreur', error.message);
      return;
    }
    await refresh();
    Alert.alert('Enregistré', 'Règles du foyer mises à jour (sans effet rétroactif, R-07).');
  }

  async function saveIncome (memberId: string) {
    const n = parseAmount(incomes[memberId] ?? '');
    if (n == null || n < 0) {
      Alert.alert('Revenu', 'Montant invalide.');
      return;
    }
    const { error } = await supabase
      .from('household_members')
      .update({ monthly_income: n })
      .eq('id', memberId);
    if (error) {
      Alert.alert('Erreur', error.message);
      return;
    }
    await refresh();
  }

  async function addRecurring () {
    if (!household || members.length === 0) {
      return;
    }
    const amt = parseAmount(recAmount);
    if (!recLabel.trim() || amt == null || amt <= 0) {
      Alert.alert('Charge', 'Libellé et montant requis.');
      return;
    }
    const { error } = await supabase.from('recurring_expense_templates').insert({
      household_id: household.id,
      label: recLabel.trim(),
      amount: amt,
      payer_member_id: members[0].id,
      expense_type: 'shared' as ExpenseType,
      cadence: 'monthly',
      next_occurrence: recNext,
    });
    if (error) {
      Alert.alert('Erreur', error.message);
      return;
    }
    setRecLabel('');
    setRecAmount('');
    await loadRec();
  }

  async function spawnRecurring (t: RecurringTemplate) {
    if (!household) {
      return;
    }
    const payer = t.payer_member_id ?? members[0]?.id;
    if (!payer) {
      return;
    }
    const { error } = await supabase.from('expenses').insert({
      household_id: household.id,
      amount: t.amount,
      spent_at: t.next_occurrence,
      payer_member_id: payer,
      category_id: t.category_id,
      expense_type: t.expense_type,
      split_rule_snapshot: household.default_split_rule,
      split_custom_percent_snapshot:
        household.default_split_rule === 'custom_percent'
          ? household.default_custom_percent
          : null,
      note: `Récurrent : ${t.label}`,
    });
    if (error) {
      Alert.alert('Erreur', error.message);
      return;
    }
    const next = new Date(t.next_occurrence);
    next.setMonth(next.getMonth() + 1);
    await supabase
      .from('recurring_expense_templates')
      .update({ next_occurrence: next.toISOString().slice(0, 10) })
      .eq('id', t.id);
    await refresh();
    await loadRec();
  }

  if (!household) {
    return null;
  }

  return (
    <ScrollView contentContainerStyle={styles.root}>
      <Text style={styles.section}>Foyer</Text>
      <TextInput
        style={styles.input}
        value={hhName}
        onChangeText={setHhName}
        placeholder="Nom du foyer"
        placeholderTextColor={colors.neutralMuted}
      />
      <View style={styles.row}>
        {(
          [
            ['equal', '50/50'],
            ['custom_percent', '%'],
            ['proportional_income', 'Revenus'],
          ] as const
        ).map(([k, label]) => (
          <Pressable
            key={k}
            style={[styles.chip, rule === k && styles.chipOn]}
            onPress={() => setRule(k)}
          >
            <Text style={[styles.chipText, rule === k && styles.chipTextOn]}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
      {rule === 'custom_percent' ? (
        <TextInput
          style={styles.input}
          keyboardType="decimal-pad"
          value={customPct}
          onChangeText={setCustomPct}
          placeholder="% membre 1"
          placeholderTextColor={colors.neutralMuted}
        />
      ) : null}
      <Pressable style={styles.primary} onPress={() => void saveHousehold()}>
        <Text style={styles.primaryText}>Enregistrer le foyer</Text>
      </Pressable>

      <Text style={styles.section}>Revenus (proportionnel)</Text>
      {members.map((m) => (
        <View key={m.id} style={styles.rowBetween}>
          <Text style={styles.body}>{m.display_name ?? 'Membre'}</Text>
          <TextInput
            style={[styles.input, { flex: 1, marginLeft: spacing.md }]}
            keyboardType="decimal-pad"
            placeholder="Revenu mensuel"
            placeholderTextColor={colors.neutralMuted}
            value={incomes[m.id] ?? ''}
            onChangeText={(v) => setIncomes((s) => ({ ...s, [m.id]: v }))}
          />
          <Pressable
            style={styles.smallBtn}
            onPress={() => void saveIncome(m.id)}
          >
            <Text style={styles.smallBtnText}>OK</Text>
          </Pressable>
        </View>
      ))}

      <Text style={styles.section}>Charges récurrentes</Text>
      <TextInput
        style={styles.input}
        placeholder="Libellé"
        placeholderTextColor={colors.neutralMuted}
        value={recLabel}
        onChangeText={setRecLabel}
      />
      <TextInput
        style={styles.input}
        placeholder="Montant"
        keyboardType="decimal-pad"
        placeholderTextColor={colors.neutralMuted}
        value={recAmount}
        onChangeText={setRecAmount}
      />
      <TextInput
        style={styles.input}
        placeholder="Prochaine échéance YYYY-MM-DD"
        placeholderTextColor={colors.neutralMuted}
        value={recNext}
        onChangeText={setRecNext}
      />
      <Pressable style={styles.secondary} onPress={() => void addRecurring()}>
        <Text style={styles.secondaryText}>Ajouter un modèle</Text>
      </Pressable>
      {recurring.map((t) => (
        <View key={t.id} style={styles.recCard}>
          <Text style={styles.body}>
            {t.label} — {formatMoney(Number(t.amount), household.currency)} — prochaine :{' '}
            {t.next_occurrence}
          </Text>
          <Pressable
            style={styles.smallBtn}
            onPress={() => void spawnRecurring(t)}
          >
            <Text style={styles.smallBtnText}>Générer la dépense</Text>
          </Pressable>
        </View>
      ))}
      <Pressable
        style={[styles.secondary, { marginTop: spacing.xl }]}
        onPress={() => void signOut()}
      >
        <Text style={styles.secondaryText}>Se déconnecter</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { padding: spacing.md, paddingBottom: spacing.xl * 2, backgroundColor: colors.neutralWarm },
  section: {
    fontWeight: '700',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    color: colors.neutralText,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
    color: colors.neutralText,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  rowBetween: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipOn: { borderColor: colors.accent, backgroundColor: '#E6F2F2' },
  chipText: { color: colors.neutralMuted, fontSize: fontSize.small },
  chipTextOn: { color: colors.accent, fontWeight: '600' },
  primary: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  primaryText: { color: colors.surface, fontWeight: '700' },
  secondary: { marginTop: spacing.sm, alignItems: 'center', padding: spacing.sm },
  secondaryText: { color: colors.accent, fontWeight: '600' },
  body: { color: colors.neutralText, minWidth: 80 },
  smallBtn: {
    marginLeft: spacing.sm,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  smallBtnText: { color: colors.accent, fontWeight: '600', fontSize: fontSize.small },
  recCard: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
});
