import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import React, { useEffect, useMemo, useState } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { DateInputField, PrimaryButton } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import {
  formatISODateFr,
  monthBoundsISO,
  parseYMDToLocalDate,
  toYMDLocalFromDate,
} from '../lib/dates';
import {
  budgetFollowUpMessage,
  budgetLevel,
} from '../lib/categoryBudget';
import { useToast } from '../context/ToastContext';
import { useHousehold } from '../context/HouseholdContext';
import { normalizeOptionalHttpUrl } from '../lib/attachmentUrl';
import {
  loadExpenseAutoRules,
  matchExpenseAutoRule,
  type ExpenseAutoRule,
} from '../lib/expenseAutoRules';
import { parseAmount } from '../lib/parseAmount';
import { friendlyErrorMessage } from '../lib/userFriendlyError';
import { isSameAsHouseholdDefault, resolveSplitSnapshot } from '../lib/splitSnapshot';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { supabase } from '../lib/supabase';
import type { ExpenseType, SplitRuleKind } from '../lib/types';
import { screenPaddingH } from '../theme/screenLayout';
import {
  colors,
  fontSize,
  fontWeight,
  hairline,
  radius,
  spacing,
} from '../theme/tokens';

export function AddExpenseScreen () {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'AddExpense'>>();
  const expenseId = route.params?.expenseId;
  const duplicateFromId = route.params?.duplicateFromId;
  const { demoMode, user } = useAuth();
  const { showToast } = useToast();

  const { household, members, categories, categoryBudgets, refresh } =
    useHousehold();
  const createdByMemberId = useMemo(
    () => members.find((m) => m.user_id === user?.id)?.id ?? null,
    [members, user?.id]
  );
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
  const [note, setNote] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(!!(expenseId || duplicateFromId));
  const [showDatePicker, setShowDatePicker] = useState(false);

  const memberOptions = useMemo(() => members, [members]);

  useEffect(() => {
    if (members.length && !payerId) {
      setPayerId(members[0].id);
    }
    if (categories.length && !categoryId) {
      setCategoryId(categories[0].id);
    }
  }, [members, categories, payerId, categoryId]);

  useEffect(() => {
    const sourceId = expenseId ?? duplicateFromId;
    if (!sourceId || !household) {
      if (!sourceId) {
        setLoading(false);
      }
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('id', sourceId)
        .eq('household_id', household.id)
        .single();
      if (cancelled || error || !data) {
        setLoading(false);
        if (error) {
          Alert.alert('Dépense', friendlyErrorMessage(error));
        }
        return;
      }
      setAmount(String(data.amount));
      setCategoryId(data.category_id as string | null);
      setPayerId(data.payer_member_id as string);
      setExpenseType(data.expense_type as ExpenseType);
      if (duplicateFromId && !expenseId) {
        setSpentAt(new Date().toISOString().slice(0, 10));
      } else {
        setSpentAt(String(data.spent_at).slice(0, 10));
      }
      setNote((data.note as string | null) ?? '');
      setAttachmentUrl(
        typeof data.attachment_url === 'string' ? data.attachment_url : ''
      );
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
  }, [expenseId, duplicateFromId, household]);

  async function maybeBudgetFollowUp (
    categoryId: string | null,
    spentYmd: string,
    newAmount: number
  ) {
    if (!categoryId || !household) {
      return;
    }
    const capRow = categoryBudgets.find((b) => b.category_id === categoryId);
    if (!capRow) {
      return;
    }
    const ref = parseYMDToLocalDate(spentYmd);
    const { start, end } = monthBoundsISO(ref);
    const { data } = await supabase
      .from('expenses')
      .select('amount')
      .eq('household_id', household.id)
      .eq('category_id', categoryId)
      .gte('spent_at', start)
      .lte('spent_at', end);
    const sumAfter = (data ?? []).reduce((s, r) => s + Number(r.amount), 0);
    const sumBefore = sumAfter - newAmount;
    const prevLevel = budgetLevel(sumBefore, capRow.monthly_cap);
    const newLvl = budgetLevel(sumAfter, capRow.monthly_cap);
    const catName =
      categories.find((c) => c.id === categoryId)?.name ?? 'Catégorie';
    const msg = budgetFollowUpMessage({
      categoryName: catName,
      spent: sumAfter,
      monthlyCap: capRow.monthly_cap,
      currency: household.currency,
      previousLevel: prevLevel,
      newLevel: newLvl,
    });
    if (msg) {
      showToast(msg, 'neutral');
    }
  }

  async function maybeGlobalBudgetFollowUp (
    spentYmd: string,
    newAmount: number
  ) {
    const cap = household?.monthly_budget_cap;
    if (cap == null || cap <= 0) {
      return;
    }
    const ref = parseYMDToLocalDate(spentYmd);
    const { start, end } = monthBoundsISO(ref);
    const { data } = await supabase
      .from('expenses')
      .select('amount')
      .eq('household_id', household!.id)
      .gte('spent_at', start)
      .lte('spent_at', end);
    const sumAfter = (data ?? []).reduce((s, r) => s + Number(r.amount), 0);
    const sumBefore = sumAfter - newAmount;
    const prevLevel = budgetLevel(sumBefore, cap);
    const newLvl = budgetLevel(sumAfter, cap);
    const msg = budgetFollowUpMessage({
      categoryName: 'Budget global du mois',
      spent: sumAfter,
      monthlyCap: cap,
      currency: household!.currency,
      previousLevel: prevLevel,
      newLevel: newLvl,
    });
    if (msg) {
      showToast(msg, 'neutral');
    }
  }

  async function save (andAnother: boolean) {
    if (demoMode) {
      Alert.alert(
        'Mode aperçu',
        'Connectez-vous pour enregistrer une dépense réelle.'
      );
      return;
    }
    if (!household || !payerId) {
      Alert.alert('Saisie incomplète', 'Choisissez au minimum qui a payé.');
      return;
    }
    const n = parseAmount(amount);
    if (n == null || n <= 0) {
      Alert.alert('Montant', 'Indiquez un montant supérieur à zéro.');
      return;
    }

    const snap = resolveSplitSnapshot(household, ruleOverride, customPct);
    const linkNorm = normalizeOptionalHttpUrl(attachmentUrl);
    if (attachmentUrl.trim().length > 0 && linkNorm == null) {
      Alert.alert(
        'Lien',
        'Collez une adresse complète (https://…) ou laissez vide.'
      );
      return;
    }

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
        note: note.trim() || null,
        attachment_url: linkNorm,
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
        const { error } = await supabase.from('expenses').insert({
          ...payload,
          ...(createdByMemberId
            ? { created_by_member_id: createdByMemberId }
            : {}),
        });
        if (error) {
          throw error;
        }
      }
      await refresh();
      if (!expenseId) {
        await maybeBudgetFollowUp(categoryId ?? null, spentAt, n);
        await maybeGlobalBudgetFollowUp(spentAt, n);
      }
      if (andAnother && !expenseId) {
        showToast('Dépense enregistrée', 'success');
        setAmount('');
        setNote('');
        setAttachmentUrl('');
      } else {
        showToast(
          expenseId ? 'Modifications enregistrées' : 'Dépense enregistrée',
          'success'
        );
        navigation.goBack();
      }
    } catch (e: unknown) {
      Alert.alert('Enregistrement', friendlyErrorMessage(e));
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
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.root}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.helperTop}>
        {expenseId
          ? 'Modifiez les champs nécessaires — l’accueil et l’équilibre se mettront à jour au retour.'
          : 'Le plus important en premier : montant, puis qui paie et le type.'}
      </Text>

      <Text style={styles.label}>Montant</Text>
      <TextInput
        style={styles.input}
        keyboardType="decimal-pad"
        placeholder="0,00"
        placeholderTextColor={colors.textMuted}
        value={amount}
        onChangeText={setAmount}
        accessibilityLabel="Montant de la dépense"
      />

      <Text style={styles.label}>Catégorie</Text>
      <View style={styles.row}>
        {categories.map((c) => (
          <Pressable
            key={c.id}
            style={[styles.chip, categoryId === c.id && styles.chipOn]}
            onPress={() => setCategoryId(c.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: categoryId === c.id }}
            accessibilityLabel={`Catégorie ${c.name}`}
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
            accessibilityRole="button"
            accessibilityState={{ selected: expenseType === k }}
            accessibilityLabel={`Type de dépense ${label}`}
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
      {Platform.OS === 'web' ? (
        <DateInputField
          value={spentAt}
          onChangeText={setSpentAt}
          placeholder="AAAA-MM-JJ"
        />
      ) : (
        <>
          <Pressable
            style={styles.datePick}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={styles.datePickMain}>{formatISODateFr(spentAt)}</Text>
            <Text style={styles.datePickSub}>{spentAt.slice(0, 10)}</Text>
            <Text style={styles.datePickAction}>Choisir une date</Text>
          </Pressable>
          {showDatePicker ? (
            <>
              <DateTimePicker
                value={parseYMDToLocalDate(spentAt)}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(_, date) => {
                  if (Platform.OS === 'android') {
                    setShowDatePicker(false);
                  }
                  if (date) {
                    setSpentAt(toYMDLocalFromDate(date));
                  }
                }}
              />
              {Platform.OS === 'ios' ? (
                <Pressable
                  style={styles.dateDone}
                  onPress={() => setShowDatePicker(false)}
                >
                  <Text style={styles.dateDoneTxt}>Terminé</Text>
                </Pressable>
              ) : null}
            </>
          ) : null}
        </>
      )}

      <Text style={styles.label}>Règle de répartition</Text>
      <Text style={styles.hint}>
        Par défaut : règle du foyer. Changez seulement pour un cas exceptionnel.
      </Text>
      <View style={styles.row}>
        {(
          [
            ['default', 'Comme le foyer'],
            ['equal', '50/50'],
            ['custom_percent', 'Pourcentage'],
            ['proportional_income', 'Revenus'],
          ] as const
        ).map(([k, label]) => (
          <Pressable
            key={k}
            style={[styles.chip, ruleOverride === k && styles.chipOn]}
            onPress={() => setRuleOverride(k)}
            accessibilityRole="button"
            accessibilityState={{ selected: ruleOverride === k }}
            accessibilityLabel={`Règle de répartition ${label}`}
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
          placeholderTextColor={colors.textMuted}
          value={customPct}
          onChangeText={setCustomPct}
        />
      ) : null}

      <Text style={styles.label}>Note (optionnel)</Text>
      <TextInput
        style={[styles.input, styles.noteInput]}
        placeholder="Ex. courses du dimanche"
        placeholderTextColor={colors.textMuted}
        value={note}
        onChangeText={setNote}
        multiline
      />

      <Text style={styles.label}>Lien utile (optionnel)</Text>
      <Text style={styles.hint}>
        Ticket, capture ou fichier dans le cloud — pour vous retrouver à deux.
      </Text>
      <TextInput
        style={styles.input}
        placeholder="https://…"
        placeholderTextColor={colors.textMuted}
        value={attachmentUrl}
        onChangeText={setAttachmentUrl}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        accessibilityLabel="Lien optionnel vers une pièce ou une preuve"
      />

      <PrimaryButton
        title={expenseId ? 'Enregistrer les modifications' : 'Enregistrer'}
        loading={busy}
        onPress={() => void save(false)}
      />
      {!expenseId ? (
        <Pressable
          style={[styles.secondary, busy && { opacity: 0.5 }]}
          disabled={busy}
          onPress={() => void save(true)}
        >
          <Text style={styles.secondaryText}>Enregistrer et saisir une autre</Text>
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
    backgroundColor: colors.canvas,
  },
  root: {
    paddingHorizontal: screenPaddingH,
    paddingVertical: spacing.lg,
    backgroundColor: colors.canvas,
    flexGrow: 1,
  },
  helperTop: {
    fontSize: fontSize.small,
    color: colors.textMuted,
    lineHeight: 20,
    marginBottom: spacing.md,
    fontWeight: fontWeight.regular,
  },
  label: {
    fontWeight: fontWeight.medium,
    marginBottom: spacing.xs,
    marginTop: spacing.md,
    fontSize: fontSize.caption,
    color: colors.textSecondary,
    letterSpacing: 0.15,
  },
  hint: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
    marginBottom: spacing.sm,
    lineHeight: 18,
  },
  input: {
    borderWidth: hairline,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    fontSize: fontSize.body,
    color: colors.text,
  },
  noteInput: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  suggestBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    borderWidth: hairline,
    borderColor: colors.borderLight,
  },
  suggestTxt: {
    flex: 1,
    minWidth: 160,
    fontSize: fontSize.small,
    color: colors.primaryDark,
    fontWeight: fontWeight.medium,
  },
  suggestBtnWrap: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  suggestBtnTxt: {
    fontSize: fontSize.small,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
  datePick: {
    borderWidth: hairline,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceElevated,
  },
  datePickMain: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  datePickSub: {
    marginTop: 4,
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
  datePickAction: {
    marginTop: spacing.sm,
    fontSize: fontSize.caption,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
  dateDone: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  dateDoneTxt: {
    fontSize: fontSize.small,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: hairline,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  chipText: { color: colors.textMuted, fontSize: fontSize.small },
  chipTextOn: { color: colors.primaryDark, fontWeight: fontWeight.medium },
  secondary: {
    marginTop: spacing.md,
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  secondaryText: {
    color: colors.primary,
    fontWeight: fontWeight.medium,
    fontSize: fontSize.small,
  },
});
