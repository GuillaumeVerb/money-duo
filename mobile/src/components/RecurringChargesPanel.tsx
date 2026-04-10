import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DateInputField, InputField, PrimaryButton, SecondaryButton } from './ui';
import {
  SettingsCell,
  SettingsGroup,
  SettingsSectionTitle,
} from './ui/settingsPrimitives';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useHousehold } from '../context/HouseholdContext';
import { formatMoney } from '../lib/format';
import { parseAmount } from '../lib/parseAmount';
import { friendlyErrorMessage } from '../lib/userFriendlyError';
import { supabase } from '../lib/supabase';
import type { ExpenseType, RecurringTemplate } from '../lib/types';
import {
  colors,
  fontSize,
  fontWeight,
  hairline,
  radius,
  spacing,
} from '../theme/tokens';

type Props = {
  /** Affiche le titre de section « Charges récurrentes » (réglages). */
  showSectionTitle?: boolean;
};

export function RecurringChargesPanel ({ showSectionTitle = true }: Props) {
  const insets = useSafeAreaInsets();
  const { household, members, categories, refresh } = useHousehold();
  const { demoMode } = useAuth();
  const { showToast } = useToast();

  const [recurring, setRecurring] = useState<RecurringTemplate[]>([]);
  const [recLabel, setRecLabel] = useState('');
  const [recAmount, setRecAmount] = useState('');
  const [recNext, setRecNext] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [recCadence, setRecCadence] = useState<'weekly' | 'monthly' | 'yearly'>(
    'monthly'
  );
  const [editRec, setEditRec] = useState<RecurringTemplate | null>(null);
  const [recEditLabel, setRecEditLabel] = useState('');
  const [recEditAmount, setRecEditAmount] = useState('');
  const [recEditNext, setRecEditNext] = useState('');
  const [recEditPayerId, setRecEditPayerId] = useState<string | null>(null);
  const [recEditType, setRecEditType] = useState<ExpenseType>('shared');
  const [recEditCategoryId, setRecEditCategoryId] = useState<string | null>(
    null
  );
  const [recEditCadence, setRecEditCadence] = useState<
    'weekly' | 'monthly' | 'yearly'
  >('monthly');

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

  useEffect(() => {
    if (!editRec) {
      return;
    }
    setRecEditLabel(editRec.label);
    setRecEditAmount(String(editRec.amount));
    setRecEditNext(editRec.next_occurrence.slice(0, 10));
    setRecEditPayerId(editRec.payer_member_id ?? members[0]?.id ?? null);
    setRecEditType(editRec.expense_type);
    setRecEditCategoryId(editRec.category_id);
    setRecEditCadence(editRec.cadence);
  }, [editRec, members]);

  async function addRecurring () {
    if (demoMode) {
      Alert.alert(
        'Mode aperçu',
        'Les charges récurrentes ne sont pas enregistrées en démo.'
      );
      return;
    }
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
      cadence: recCadence,
      next_occurrence: recNext,
    });
    if (error) {
      Alert.alert('Erreur', friendlyErrorMessage(error));
      return;
    }
    setRecLabel('');
    setRecAmount('');
    setRecCadence('monthly');
    showToast('Charge récurrente ajoutée', 'success');
    await loadRec();
  }

  async function spawnRecurring (t: RecurringTemplate) {
    if (demoMode) {
      Alert.alert('Mode aperçu', 'Générez une dépense réelle après connexion.');
      return;
    }
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
      Alert.alert('Erreur', friendlyErrorMessage(error));
      return;
    }
    const next = new Date(t.next_occurrence);
    if (t.cadence === 'weekly') {
      next.setDate(next.getDate() + 7);
    } else if (t.cadence === 'yearly') {
      next.setFullYear(next.getFullYear() + 1);
    } else {
      next.setMonth(next.getMonth() + 1);
    }
    await supabase
      .from('recurring_expense_templates')
      .update({ next_occurrence: next.toISOString().slice(0, 10) })
      .eq('id', t.id);
    await refresh();
    await loadRec();
  }

  async function saveRecurringEdit () {
    if (demoMode) {
      Alert.alert('Mode aperçu', 'Non disponible en démo.');
      return;
    }
    if (!household || !editRec) {
      return;
    }
    const amt = parseAmount(recEditAmount);
    if (!recEditLabel.trim() || amt == null || amt <= 0) {
      Alert.alert('Charge', 'Libellé et montant valides requis.');
      return;
    }
    const payer = recEditPayerId ?? members[0]?.id;
    if (!payer) {
      return;
    }
    const { error } = await supabase
      .from('recurring_expense_templates')
      .update({
        label: recEditLabel.trim(),
        amount: amt,
        next_occurrence: recEditNext.trim().slice(0, 10),
        payer_member_id: payer,
        expense_type: recEditType,
        category_id: recEditCategoryId,
        cadence: recEditCadence,
      })
      .eq('id', editRec.id)
      .eq('household_id', household.id);
    if (error) {
      Alert.alert('Erreur', friendlyErrorMessage(error));
      return;
    }
    setEditRec(null);
    showToast('Modèle enregistré', 'success');
    await refresh();
    await loadRec();
  }

  function confirmDeleteRecurring () {
    if (demoMode) {
      Alert.alert('Mode aperçu', 'Non disponible en démo.');
      return;
    }
    if (!editRec || !household) {
      return;
    }
    Alert.alert(
      'Supprimer ce modèle ?',
      'Vous pourrez en recréer un autre plus tard.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            const id = editRec.id;
            setEditRec(null);
            const { error } = await supabase
              .from('recurring_expense_templates')
              .delete()
              .eq('id', id)
              .eq('household_id', household.id);
            if (error) {
              Alert.alert('Erreur', friendlyErrorMessage(error));
              return;
            }
            showToast('Modèle supprimé', 'neutral');
            await refresh();
            await loadRec();
          },
        },
      ]
    );
  }

  if (!household) {
    return null;
  }

  return (
    <>
      {showSectionTitle ? (
        <SettingsSectionTitle>Charges récurrentes</SettingsSectionTitle>
      ) : null}
      <SettingsGroup>
        {recurring.length === 0 ? (
          <View style={styles.emptyPad}>
            <Text style={styles.emptyText}>
              Aucun modèle pour l’instant — ajoutez loyer, assurances, etc.
            </Text>
          </View>
        ) : (
          recurring.map((t, i) => (
            <SettingsCell
              key={t.id}
              label={t.label}
              sublabel={`${formatMoney(Number(t.amount), household.currency)} · ${
                t.cadence === 'weekly'
                  ? 'Hebdo'
                  : t.cadence === 'yearly'
                    ? 'Annuel'
                    : 'Mensuel'
              } · échéance ${t.next_occurrence}`}
              showDivider={i < recurring.length - 1}
            >
              <View style={styles.recActions}>
                <Pressable
                  onPress={() => setEditRec(t)}
                  style={styles.miniLink}
                  hitSlop={6}
                >
                  <Text style={styles.miniLinkText}>Modifier</Text>
                </Pressable>
                <Pressable
                  onPress={() => void spawnRecurring(t)}
                  style={styles.miniLink}
                  hitSlop={6}
                >
                  <Text style={styles.miniLinkText}>Générer</Text>
                </Pressable>
              </View>
            </SettingsCell>
          ))
        )}
        <View style={styles.addPad}>
          <Text style={styles.addLabel}>Nouveau modèle</Text>
          <View style={styles.addGrid}>
            <TextInput
              style={styles.addField}
              placeholder="Libellé"
              placeholderTextColor={colors.textMuted}
              value={recLabel}
              onChangeText={setRecLabel}
            />
            <TextInput
              style={styles.addField}
              placeholder="Montant"
              keyboardType="decimal-pad"
              placeholderTextColor={colors.textMuted}
              value={recAmount}
              onChangeText={setRecAmount}
            />
            <DateInputField
              label="Prochaine échéance"
              value={recNext}
              onChangeText={setRecNext}
              dense
            />
          </View>
          <View style={styles.recTypeRow}>
            {(
              [
                ['weekly', 'Hebdo'],
                ['monthly', 'Mensuel'],
                ['yearly', 'Annuel'],
              ] as const
            ).map(([k, label]) => (
              <Pressable
                key={k}
                style={[styles.typeChip, recCadence === k && styles.typeChipOn]}
                onPress={() => setRecCadence(k)}
              >
                <Text
                  style={[
                    styles.typeChipTxt,
                    recCadence === k && styles.typeChipTxtOn,
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
          <PrimaryButton
            title="Ajouter"
            onPress={() => void addRecurring()}
            size="compact"
          />
        </View>
      </SettingsGroup>

      <Modal
        visible={editRec != null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditRec(null)}
      >
        <View
          style={[styles.modalRoot, { paddingTop: insets.top + spacing.md }]}
        >
          <View style={styles.modalHead}>
            <Text style={styles.modalTitle}>Modifier la charge</Text>
            <Pressable onPress={() => setEditRec(null)} hitSlop={12}>
              <Ionicons name="close" size={28} color={colors.text} />
            </Pressable>
          </View>
          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.modalSub}>
              Montant, échéance et payeur par défaut pour les prochains rappels.
            </Text>
            <InputField
              label="Libellé"
              value={recEditLabel}
              onChangeText={setRecEditLabel}
            />
            <InputField
              label="Montant"
              keyboardType="decimal-pad"
              value={recEditAmount}
              onChangeText={setRecEditAmount}
            />
            <DateInputField
              label="Prochaine échéance"
              value={recEditNext}
              onChangeText={setRecEditNext}
              placeholder="AAAA-MM-JJ"
            />
            <Text style={styles.modalFieldLabel}>Payé par</Text>
            <View style={styles.recTypeRow}>
              {members.map((m) => (
                <Pressable
                  key={m.id}
                  style={[
                    styles.typeChip,
                    recEditPayerId === m.id && styles.typeChipOn,
                  ]}
                  onPress={() => setRecEditPayerId(m.id)}
                >
                  <Text
                    style={[
                      styles.typeChipTxt,
                      recEditPayerId === m.id && styles.typeChipTxtOn,
                    ]}
                  >
                    {m.display_name ?? 'Moi'}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.modalFieldLabel}>Type</Text>
            <View style={styles.recTypeRow}>
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
                  style={[
                    styles.typeChip,
                    recEditType === k && styles.typeChipOn,
                  ]}
                  onPress={() => setRecEditType(k)}
                >
                  <Text
                    style={[
                      styles.typeChipTxt,
                      recEditType === k && styles.typeChipTxtOn,
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.modalFieldLabel}>Catégorie (optionnel)</Text>
            <View style={styles.recTypeRow}>
              <Pressable
                style={[
                  styles.typeChip,
                  recEditCategoryId == null && styles.typeChipOn,
                ]}
                onPress={() => setRecEditCategoryId(null)}
              >
                <Text
                  style={[
                    styles.typeChipTxt,
                    recEditCategoryId == null && styles.typeChipTxtOn,
                  ]}
                >
                  Aucune
                </Text>
              </Pressable>
              {categories.map((c) => (
                <Pressable
                  key={c.id}
                  style={[
                    styles.typeChip,
                    recEditCategoryId === c.id && styles.typeChipOn,
                  ]}
                  onPress={() => setRecEditCategoryId(c.id)}
                >
                  <Text
                    style={[
                      styles.typeChipTxt,
                      recEditCategoryId === c.id && styles.typeChipTxtOn,
                    ]}
                    numberOfLines={1}
                  >
                    {c.name}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.modalFieldLabel}>Frequence</Text>
            <View style={styles.recTypeRow}>
              {(
                [
                  ['weekly', 'Hebdo'],
                  ['monthly', 'Mensuel'],
                  ['yearly', 'Annuel'],
                ] as const
              ).map(([k, label]) => (
                <Pressable
                  key={k}
                  style={[
                    styles.typeChip,
                    recEditCadence === k && styles.typeChipOn,
                  ]}
                  onPress={() => setRecEditCadence(k)}
                >
                  <Text
                    style={[
                      styles.typeChipTxt,
                      recEditCadence === k && styles.typeChipTxtOn,
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <PrimaryButton
              title="Enregistrer"
              onPress={() => void saveRecurringEdit()}
            />
            <SecondaryButton
              title="Supprimer ce modèle"
              onPress={confirmDeleteRecurring}
            />
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  emptyPad: { padding: spacing.md },
  emptyText: {
    fontSize: fontSize.small,
    color: colors.textMuted,
    lineHeight: 20,
  },
  miniLink: {
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
  },
  miniLinkText: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
  recActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  addPad: {
    padding: spacing.md,
    borderTopWidth: hairline,
    borderTopColor: colors.borderLight,
    gap: spacing.sm,
  },
  addLabel: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.semibold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  addGrid: { gap: spacing.sm },
  addField: {
    borderWidth: hairline,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.small,
    color: colors.text,
    backgroundColor: colors.surfaceMuted,
  },
  modalRoot: {
    flex: 1,
    backgroundColor: colors.canvas,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  modalScroll: { marginTop: spacing.sm },
  modalScrollContent: { paddingBottom: spacing.xl },
  modalHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: fontSize.title,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  modalSub: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    fontSize: fontSize.small,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  modalFieldLabel: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    marginTop: spacing.xs,
  },
  recTypeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  typeChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.sm,
    borderWidth: hairline,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    maxWidth: '48%',
  },
  typeChipOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  typeChipTxt: {
    fontSize: fontSize.small,
    color: colors.textMuted,
    fontWeight: fontWeight.medium,
  },
  typeChipTxtOn: {
    color: colors.primaryDark,
  },
});
