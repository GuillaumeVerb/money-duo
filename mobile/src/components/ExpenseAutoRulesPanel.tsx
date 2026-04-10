import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  SettingsCell,
  SettingsGroup,
  SettingsSectionTitle,
} from './ui/settingsPrimitives';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useHousehold } from '../context/HouseholdContext';
import {
  addExpenseAutoRule,
  loadExpenseAutoRules,
  removeExpenseAutoRule,
  type ExpenseAutoRule,
} from '../lib/expenseAutoRules';
import { colors, fontSize, fontWeight, hairline, radius, spacing } from '../theme/tokens';

export function ExpenseAutoRulesPanel () {
  const { demoMode } = useAuth();
  const { showToast } = useToast();
  const { household, categories } = useHousehold();
  const [rules, setRules] = useState<ExpenseAutoRule[]>([]);
  const [kw, setKw] = useState('');
  const [pickCat, setPickCat] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!household) {
      return;
    }
    const r = await loadExpenseAutoRules(household.id);
    setRules(r);
  }, [household]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (categories.length && pickCat == null) {
      setPickCat(categories[0].id);
    }
  }, [categories, pickCat]);

  async function onAdd () {
    if (demoMode) {
      Alert.alert('Mode aperçu', 'Les règles ne sont pas enregistrées en démo.');
      return;
    }
    if (!household || !pickCat) {
      return;
    }
    const next = await addExpenseAutoRule(household.id, {
      keyword: kw,
      category_id: pickCat,
    });
    setRules(next);
    setKw('');
    showToast('Règle enregistrée', 'success');
  }

  async function onRemove (id: string) {
    if (demoMode || !household) {
      return;
    }
    const next = await removeExpenseAutoRule(household.id, id);
    setRules(next);
    showToast('Règle supprimée', 'neutral');
  }

  if (!household || categories.length === 0) {
    return null;
  }

  return (
    <>
      <SettingsSectionTitle>Règles automatiques (note)</SettingsSectionTitle>
      <Text style={styles.hint}>
        Si la note de la dépense contient le mot-clé (sans tenir compte des
        majuscules), l’app propose la catégorie correspondante lors de la
        saisie.
      </Text>
      <SettingsGroup>
        {rules.length === 0 ? (
          <View style={styles.emptyPad}>
            <Text style={styles.emptyText}>Aucune règle pour l’instant.</Text>
          </View>
        ) : (
          rules.map((r, i) => {
            const name =
              categories.find((c) => c.id === r.category_id)?.name ?? r.category_id;
            return (
              <SettingsCell
                key={r.id}
                label={`« ${r.keyword} »`}
                sublabel={`→ ${name}`}
                showDivider={i < rules.length - 1}
              >
                <Pressable
                  onPress={() => void onRemove(r.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Supprimer la règle ${r.keyword}`}
                  hitSlop={8}
                  style={styles.removeHit}
                >
                  <Text style={styles.removeTxt}>Retirer</Text>
                </Pressable>
              </SettingsCell>
            );
          })
        )}
        <View style={styles.addBlock}>
          <Text style={styles.addLabel}>Nouvelle règle</Text>
          <TextInput
            style={styles.kwInput}
            placeholder="Mot-clé (ex. uber, loyer)"
            placeholderTextColor={colors.textMuted}
            value={kw}
            onChangeText={setKw}
            autoCapitalize="none"
            accessibilityLabel="Mot-clé pour la règle automatique"
          />
          <Text style={styles.catPickLabel}>Catégorie cible</Text>
          <View style={styles.catRow} accessibilityRole="radiogroup">
            {categories.map((c) => (
              <Pressable
                key={c.id}
                style={[styles.chip, pickCat === c.id && styles.chipOn]}
                onPress={() => setPickCat(c.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected: pickCat === c.id }}
                accessibilityLabel={`Catégorie ${c.name}`}
              >
                <Text
                  style={[styles.chipTxt, pickCat === c.id && styles.chipTxtOn]}
                >
                  {c.name}
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            style={styles.addBtn}
            onPress={() => void onAdd()}
            accessibilityRole="button"
            accessibilityLabel="Ajouter la règle automatique"
          >
            <Text style={styles.addBtnTxt}>Ajouter la règle</Text>
          </Pressable>
        </View>
      </SettingsGroup>
    </>
  );
}

const styles = StyleSheet.create({
  hint: {
    fontSize: fontSize.small,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.md,
    paddingHorizontal: 4,
  },
  emptyPad: { padding: spacing.md },
  emptyText: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  removeHit: { paddingVertical: 4, paddingHorizontal: spacing.sm },
  removeTxt: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.semibold,
    color: colors.danger,
  },
  addBlock: {
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
  kwInput: {
    borderWidth: hairline,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.small,
    color: colors.text,
    backgroundColor: colors.surfaceMuted,
  },
  catPickLabel: {
    fontSize: fontSize.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  catRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
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
  chipTxt: {
    fontSize: fontSize.small,
    color: colors.textMuted,
    fontWeight: fontWeight.medium,
  },
  chipTxtOn: {
    color: colors.primaryDark,
    fontWeight: fontWeight.semibold,
  },
  addBtn: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  addBtnTxt: {
    fontSize: fontSize.small,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
});
