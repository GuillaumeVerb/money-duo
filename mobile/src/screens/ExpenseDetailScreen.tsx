import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Card, PrimaryButton, SecondaryButton } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useHousehold } from '../context/HouseholdContext';
import { formatISODateFr } from '../lib/dates';
import { formatMoney } from '../lib/format';
import { fetchSplitsByExpenseIds } from '../lib/ledger';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { supabase } from '../lib/supabase';
import { friendlyErrorMessage } from '../lib/userFriendlyError';
import { splitRuleShort } from '../lib/splitRuleCopy';
import type { Expense, ExpenseType, SplitRuleKind } from '../lib/types';
import { screenPaddingH } from '../theme/screenLayout';
import { colors, fontSize, fontWeight, hairline, radius, spacing } from '../theme/tokens';

const TYPE_LABEL: Record<ExpenseType, string> = {
  shared: 'Commun',
  personal: 'Perso',
  child: 'Enfant',
  home: 'Maison',
};

function describeSplitOnExpense (
  e: Expense,
  members: { id: string; display_name: string | null }[]
): string {
  const r = e.split_rule_snapshot as SplitRuleKind;
  if (r === 'equal') {
    return '50 / 50';
  }
  if (r === 'proportional_income') {
    return 'Proportionnel aux revenus';
  }
  if (r === 'custom_percent') {
    const p = Number(e.split_custom_percent_snapshot ?? 50);
    const q = Math.round((100 - p) * 10) / 10;
    const m0 = members[0]?.display_name ?? 'Membre 1';
    const m1 = members[1]?.display_name ?? 'Membre 2';
    return `${m0} ${p}% · ${m1} ${q}%`;
  }
  return splitRuleShort(r);
}

export function ExpenseDetailScreen () {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'ExpenseDetail'>>();
  const { expenseId } = route.params;
  const { demoMode, user } = useAuth();
  const { showToast } = useToast();
  const { household, members, categories, refresh } = useHousehold();
  const [expense, setExpense] = useState<Expense | null>(null);
  const [loading, setLoading] = useState(true);
  const [splitRows, setSplitRows] = useState<
    { member_id: string; amount_due: number }[]
  >([]);
  const [partnerDraft, setPartnerDraft] = useState('');
  const [partnerSaving, setPartnerSaving] = useState(false);

  const load = useCallback(async () => {
    if (!household) {
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('id', expenseId)
      .eq('household_id', household.id)
      .maybeSingle();
    if (error || !data) {
      setExpense(null);
      setSplitRows([]);
      setLoading(false);
      return;
    }
    const ex = data as Expense;
    setExpense(ex);
    if (ex.expense_type !== 'personal') {
      const map = await fetchSplitsByExpenseIds([ex.id]);
      setSplitRows(map[ex.id] ?? []);
    } else {
      setSplitRows([]);
    }
    setLoading(false);
  }, [expenseId, household]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load])
  );

  useEffect(() => {
    setPartnerDraft(expense?.partner_note?.trim() ?? '');
  }, [expense?.id, expense?.partner_note]);

  async function remove () {
    if (demoMode) {
      Alert.alert(
        'Mode aperçu',
        'Connectez-vous pour supprimer une dépense réelle.'
      );
      return;
    }
    Alert.alert('Supprimer cette dépense ?', 'Cette action est définitive.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase
            .from('expenses')
            .delete()
            .eq('id', expenseId);
          if (error) {
            Alert.alert('Suppression impossible', friendlyErrorMessage(error));
            return;
          }
          showToast('Dépense supprimée', 'success');
          await refresh();
          navigation.goBack();
        },
      },
    ]);
  }

  function edit () {
    navigation.navigate('AddExpense', { expenseId });
  }

  function duplicate () {
    navigation.navigate('AddExpense', { duplicateFromId: expenseId });
  }

  const myMember = members.find((m) => m.user_id === user?.id);

  async function savePartnerNote () {
    if (demoMode || !household || !myMember) {
      Alert.alert(
        'Mode aperçu',
        'Connectez-vous pour enregistrer un message pour votre partenaire.'
      );
      return;
    }
    const trimmed = partnerDraft.trim();
    setPartnerSaving(true);
    try {
      const { error } = await supabase
        .from('expenses')
        .update({
          partner_note: trimmed.length > 0 ? trimmed : null,
          partner_note_by_member_id:
            trimmed.length > 0 ? myMember.id : null,
        })
        .eq('id', expenseId)
        .eq('household_id', household.id);
      if (error) {
        throw error;
      }
      showToast(
        trimmed.length > 0 ? 'Mot enregistré' : 'Message retiré',
        'success'
      );
      await refresh();
      void load();
    } catch (e: unknown) {
      Alert.alert('Enregistrement', friendlyErrorMessage(e));
    } finally {
      setPartnerSaving(false);
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

  if (!expense) {
    return (
      <View style={styles.loading}>
        <Text style={styles.miss}>Dépense introuvable ou déjà supprimée.</Text>
        <SecondaryButton title="Fermer" onPress={() => navigation.goBack()} />
      </View>
    );
  }

  const cat = categories.find((c) => c.id === expense.category_id)?.name;
  const payer = members.find((m) => m.id === expense.payer_member_id);
  const enteredBy = expense.created_by_member_id
    ? members.find((m) => m.id === expense.created_by_member_id)
    : null;
  const splitDesc = describeSplitOnExpense(expense, members);
  const dateLong = formatISODateFr(expense.spent_at);
  const impactLine =
    expense.expense_type === 'personal'
      ? 'Ne modifie pas l’équilibre à deux — reste en marge perso.'
      : expense.expense_type === 'shared'
        ? 'Compte dans l’équilibre du foyer selon la répartition ci-dessus.'
        : expense.expense_type === 'child'
          ? 'Repère famille — utile pour en parler sans tout mélanger au commun.'
          : 'Repère logement / charges liées au lieu.';

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.kicker}>Dépense</Text>
      <Text style={styles.amount}>
        {formatMoney(Number(expense.amount), household.currency)}
      </Text>
      <Text style={styles.dateLine}>{dateLong}</Text>

      <Card density="compact" style={styles.card}>
        <Row
          icon="calendar-outline"
          label="Date"
          value={dateLong}
        />
        <Hairline />
        <Row
          icon="pricetag-outline"
          label="Catégorie"
          value={cat ?? 'Sans catégorie'}
        />
        <Hairline />
        <Row
          icon="person-outline"
          label="Payé par"
          value={payer?.display_name ?? '—'}
        />
        <Hairline />
        <Row
          icon="layers-outline"
          label="Type"
          value={TYPE_LABEL[expense.expense_type]}
        />
        <Hairline />
        <Row
          icon="git-branch-outline"
          label="Répartition"
          value={splitDesc}
        />
        {enteredBy ? (
          <>
            <Hairline />
            <Row
              icon="create-outline"
              label="Saisi par"
              value={enteredBy.display_name ?? '—'}
            />
          </>
        ) : null}
        {expense.note?.trim() ? (
          <>
            <Hairline />
            <View style={styles.noteBlock}>
              <Text style={styles.noteLabel}>Note</Text>
              <Text style={styles.noteText}>{expense.note.trim()}</Text>
            </View>
          </>
        ) : null}
        {expense.attachment_url?.trim() ? (
          <>
            <Hairline />
            <Pressable
              style={styles.attachmentLink}
              onPress={() => void Linking.openURL(expense.attachment_url!.trim())}
              hitSlop={8}
            >
              <Ionicons name="link-outline" size={20} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>Lien utile</Text>
                <Text style={styles.linkUrl} numberOfLines={2}>
                  {expense.attachment_url.trim()}
                </Text>
              </View>
              <Ionicons name="open-outline" size={18} color={colors.primary} />
            </Pressable>
          </>
        ) : null}
      </Card>

      <Card variant="soft" density="compact" style={styles.card}>
        <Text style={styles.impactLabel}>Dans le foyer</Text>
        <Text style={styles.impactText}>{impactLine}</Text>
      </Card>

      {expense.expense_type !== 'personal' && splitRows.length > 0 ? (
        <Card density="compact" style={styles.card}>
          <Text style={styles.splitHeading}>Parts théoriques</Text>
          <Text style={styles.splitHint}>
            Répartition calculée pour cette dépense selon la règle du moment.
          </Text>
          {splitRows.map((s, i) => {
            const name =
              members.find((m) => m.id === s.member_id)?.display_name ??
              'Membre';
            return (
              <View
                key={s.member_id}
                style={[
                  styles.splitRow,
                  i < splitRows.length - 1 && styles.splitRowBorder,
                ]}
              >
                <Text style={styles.splitName}>{name}</Text>
                <Text style={styles.splitAmt}>
                  {formatMoney(s.amount_due, household.currency)}
                </Text>
              </View>
            );
          })}
        </Card>
      ) : expense.expense_type === 'personal' ? (
        <Card variant="soft" density="compact" style={styles.card}>
          <Text style={styles.personalHint}>
            Dépense personnelle : elle n’entre pas dans le partage commun ni
            dans l’équilibre à deux.
          </Text>
        </Card>
      ) : null}

      <Card density="compact" style={styles.card}>
        <Text style={styles.partnerHeading}>Mot pour l’autre</Text>
        <Text style={styles.partnerHint}>
          Un court message pour votre partenaire (merci, info, rappel…). Distinct
          de la note de saisie.
        </Text>
        {expense.partner_note_by_member_id ? (
          <Text style={styles.partnerMeta}>
            Dernier mot par{' '}
            {members.find((m) => m.id === expense.partner_note_by_member_id)
              ?.display_name ?? '—'}
          </Text>
        ) : null}
        <TextInput
          style={styles.partnerInput}
          placeholder="Ex. merci pour le coup de main 💛"
          placeholderTextColor={colors.textMuted}
          value={partnerDraft}
          onChangeText={setPartnerDraft}
          multiline
          maxLength={500}
          editable={!demoMode}
          accessibilityLabel="Message pour votre partenaire sur cette dépense"
        />
        <PrimaryButton
          title="Enregistrer le mot"
          onPress={() => void savePartnerNote()}
          disabled={demoMode}
          loading={partnerSaving}
        />
      </Card>

      <PrimaryButton title="Modifier" onPress={edit} />
      <SecondaryButton
        title="Dupliquer (nouvelle dépense)"
        onPress={duplicate}
        style={styles.duplicateBtn}
      />
      <Pressable
        style={styles.dangerWrap}
        onPress={() => void remove()}
        hitSlop={8}
      >
        <Text style={styles.dangerText}>Supprimer</Text>
      </Pressable>
    </ScrollView>
  );
}

function Hairline () {
  return <View style={styles.hairline} />;
}

function Row ({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={20} color={colors.textMuted} />
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  content: {
    paddingHorizontal: screenPaddingH,
    paddingVertical: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  duplicateBtn: { marginTop: spacing.sm },
  impactLabel: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
  },
  impactText: {
    fontSize: fontSize.small,
    color: colors.textSecondary,
    lineHeight: 20,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.xs,
    paddingTop: spacing.xs,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.canvas,
    padding: spacing.xl,
  },
  miss: {
    fontSize: fontSize.small,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  kicker: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.medium,
    color: colors.textMuted,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  amount: {
    marginTop: spacing.sm,
    fontSize: fontSize.hero,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    letterSpacing: -1,
  },
  dateLine: {
    marginTop: spacing.xs,
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
  card: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    paddingVertical: spacing.xs,
  },
  splitHeading: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
  },
  splitHint: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
    lineHeight: 17,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  splitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  splitRowBorder: {
    borderBottomWidth: hairline,
    borderBottomColor: colors.borderLight,
  },
  splitName: {
    fontSize: fontSize.body,
    color: colors.text,
    fontWeight: fontWeight.medium,
  },
  splitAmt: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  personalHint: {
    fontSize: fontSize.small,
    color: colors.textSecondary,
    lineHeight: 20,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  rowLabel: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
    marginBottom: 4,
  },
  rowValue: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.medium,
    color: colors.text,
    lineHeight: 20,
  },
  hairline: {
    height: hairline,
    backgroundColor: colors.borderLight,
    marginLeft: spacing.sm + 20 + spacing.sm,
  },
  noteBlock: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  noteLabel: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  noteText: {
    fontSize: fontSize.small,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  attachmentLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  linkUrl: {
    fontSize: fontSize.small,
    fontWeight: fontWeight.medium,
    color: colors.primary,
    lineHeight: 20,
  },
  partnerHeading: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
  },
  partnerHint: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
    lineHeight: 17,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.xs,
  },
  partnerMeta: {
    fontSize: fontSize.micro,
    color: colors.textMuted,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.xs,
  },
  partnerInput: {
    marginHorizontal: spacing.sm,
    marginBottom: spacing.sm,
    minHeight: 64,
    padding: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: hairline,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    fontSize: fontSize.body,
    color: colors.text,
    textAlignVertical: 'top',
  },
  dangerWrap: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  dangerText: {
    fontSize: fontSize.small,
    fontWeight: fontWeight.medium,
    color: colors.danger,
  },
});
