import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useHousehold } from '../context/HouseholdContext';
import { parseAmount } from '../lib/parseAmount';
import { isSameAsHouseholdDefault, resolveSplitSnapshot } from '../lib/splitSnapshot';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { supabase } from '../lib/supabase';
import type { ExpenseType, SplitRuleKind } from '../lib/types';
import { colors, fontSize, radius, spacing } from '../theme/tokens';

/** ≤6 champs visibles : montant, catégorie, payé par, type, règle (si besoin), date — note en option secondaire. */
export function AddExpenseScreen () {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'AddExpense'>>();
  const expenseId = route.params?.expenseId;

  const { household, members, categories, refresh } = useHousehold();
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [payerId, setPayerId] = useState<string | null>(null);
  const [expenseType, setExpenseType] = useState<ExpenseType>('shared');
  const [spentAt, setSpentAt] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [ruleOverride, setRuleOverride] = useState<SplitRuleKind | 'default'>(
    'default'
  );
  const [customPct, setCustomPct] = useState('50');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(!!expenseId);

  const memberOptions = useMemo(() => members, [members]);

  React.useEffect(() => {
    if (members.length && !payerId) {
      setPayerId(members[0].id);
    }
    if (categories.length && !categoryId) {
      setCategoryId(categories[0].id);
    }
  }, [members, categories, payerId, categoryId]);

  React.useEffect(() => {
    if (!expenseId || !household) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('id', expenseId)
        .eq('household_id', household.id)
        .single();
      if (cancelled || error || !data) {
        setLoading(false);
        if (error) {
          Alert.alert('Dépense', error.message);
        }
        return;
      }
      setAmount(String(data.amount));
      setCategoryId(data.category_id as string | null);
      setPayerId(data.payer_member_id as string);
      setExpenseType(data.expense_type as ExpenseType);
      setSpentAt(String(data.spent_at).slice(0, 10));
      const snap = data.split_rule_snapshot as SplitRuleKind;
      if (
        isSameAsHouseholdDefault(
          household,
          snap,
          data.split_custom_percent_snapshot as number | null
        )
      ) {
        setRuleOverride('default');
      } else {
        setRuleOverride(snap);
        if (snap === 'custom_percent' && data.split_custom_percent_snapshot != null) {
          setCustomPct(String(data.split_custom_percent_snapshot));
        }
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [expenseId, household]);

  async function save (andAnother: boolean) {
    if (!household || !payerId) {
      Alert.alert('Saisie', 'Complète les champs obligatoires.');
      return;
    }
    const n = parseAmount(amount);
    if (n == null || n <= 0) {
      Alert.alert('Montant', 'Montant invalide.');
      return;
    }

    const snap = resolveSplitSnapshot(household, ruleOverride, customPct);

    setBusy(true);
    try {
      const payload = {
        household_id: household.id,
        amount: n,
        spent_at: spentAt,
        payer_member_id: payerId,
        category_id: categoryId ?? null,
        expense_type: expenseType,
        split_rule_snapshot: snap.split_rule_snapshot,
        split_custom_percent_snapshot: snap.split_custom_percent_snapshot,
      };

      if (expenseId) {
        const { error } = await supabase
          .from('expenses')
          .update(payload)
          .eq('id', expenseId);
        if (error) {
          throw error;
        }
      } else {
        const { error } = await supabase.from('expenses').insert(payload);
        if (error) {
          throw error;
        }
      }
      await refresh();
      if (andAnother && !expenseId) {
        setAmount('');
      } else {
        navigation.goBack();
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erreur';
      Alert.alert('Enregistrement', msg);
    } finally {
      setBusy(false);
    }
  }

  if (!household) {
    return null;
  }

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.root}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.label}>Montant</Text>
      <TextInput
        style={styles.input}
        keyboardType="decimal-pad"
        placeholder="0,00"
        placeholderTextColor={colors.neutralMuted}
        value={amount}
        onChangeText={setAmount}
      />
      <Text style={styles.label}>Catégorie</Text>
      <View style={styles.row}>
        {categories.map((c) => (
          <Pressable
            key={c.id}
            style={[styles.chip, categoryId === c.id && styles.chipOn]}
            onPress={() => setCategoryId(c.id)}
          >
            <Text
              style={[styles.chipText, categoryId === c.id && styles.chipTextOn]}
            >
              {c.name}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.label}>Payé par</Text>
      <View style={styles.row}>
        {memberOptions.map((m) => (
          <Pressable
            key={m.id}
            style={[styles.chip, payerId === m.id && styles.chipOn]}
            onPress={() => setPayerId(m.id)}
          >
            <Text style={[styles.chipText, payerId === m.id && styles.chipTextOn]}>
              {m.display_name ?? 'Moi'}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.label}>Type</Text>
      <View style={styles.row}>
        {(
          [
            ['shared', 'Commun'],
            ['personal', 'Perso'],
            ['child', 'Enfant'],
            ['home', 'Maison'],
          ] as const
        ).map(([k, label]) => (
          <Pressable
            key={k}
            style={[styles.chip, expenseType === k && styles.chipOn]}
            onPress={() => setExpenseType(k)}
          >
            <Text
              style={[styles.chipText, expenseType === k && styles.chipTextOn]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.label}>Date</Text>
      <TextInput
        style={styles.input}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={colors.neutralMuted}
        value={spentAt}
        onChangeText={setSpentAt}
      />
      <Text style={styles.label}>Règle de répartition (option)</Text>
      <View style={styles.row}>
        {(
          [
            ['default', 'Défaut foyer'],
            ['equal', '50/50'],
            ['custom_percent', 'Pourcentage'],
            ['proportional_income', 'Revenus'],
          ] as const
        ).map(([k, label]) => (
          <Pressable
            key={k}
            style={[styles.chip, ruleOverride === k && styles.chipOn]}
            onPress={() => setRuleOverride(k)}
          >
            <Text
              style={[styles.chipText, ruleOverride === k && styles.chipTextOn]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
      {ruleOverride === 'custom_percent' ? (
        <TextInput
          style={styles.input}
          keyboardType="decimal-pad"
          placeholder="% premier membre"
          placeholderTextColor={colors.neutralMuted}
          value={customPct}
          onChangeText={setCustomPct}
        />
      ) : null}
      <Pressable
        style={[styles.primary, busy && { opacity: 0.6 }]}
        disabled={busy}
        onPress={() => void save(false)}
      >
        <Text style={styles.primaryText}>
          {expenseId ? 'Enregistrer les modifications' : 'Enregistrer'}
        </Text>
      </Pressable>
      {!expenseId ? (
        <Pressable
          style={styles.secondary}
          disabled={busy}
          onPress={() => void save(true)}
        >
          <Text style={styles.secondaryText}>Enregistrer et ajouter une autre</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.neutralWarm,
  },
  root: { padding: spacing.lg, backgroundColor: colors.neutralWarm, flexGrow: 1 },
  label: {
    fontWeight: '600',
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
    color: colors.neutralText,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    fontSize: fontSize.body,
    color: colors.neutralText,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
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
    marginTop: spacing.lg,
  },
  primaryText: { color: colors.surface, fontWeight: '700' },
  secondary: { marginTop: spacing.md, alignItems: 'center', padding: spacing.sm },
  secondaryText: { color: colors.accent, fontWeight: '600' },
});
