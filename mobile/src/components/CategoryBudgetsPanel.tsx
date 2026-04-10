import React, { useEffect, useState } from 'react';
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
import { parseAmount } from '../lib/parseAmount';
import { friendlyErrorMessage } from '../lib/userFriendlyError';
import { supabase } from '../lib/supabase';
import { colors, fontSize, fontWeight, hairline, radius, spacing } from '../theme/tokens';

export function CategoryBudgetsPanel () {
  const { demoMode } = useAuth();
  const { showToast } = useToast();
  const { household, categories, categoryBudgets, refresh } = useHousehold();
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    setDrafts((prev) => {
      const next = { ...prev };
      for (const c of categories) {
        const b = categoryBudgets.find((x) => x.category_id === c.id);
        next[c.id] = b ? String(b.monthly_cap) : '';
      }
      return next;
    });
  }, [categoryBudgets, categories]);

  async function saveBudget (categoryId: string) {
    if (demoMode) {
      Alert.alert('Mode aperçu', 'Les budgets ne sont pas enregistrés en démo.');
      return;
    }
    if (!household) {
      return;
    }
    const raw = (drafts[categoryId] ?? '').trim();
    if (!raw) {
      const { error } = await supabase
        .from('category_budgets')
        .delete()
        .eq('household_id', household.id)
        .eq('category_id', categoryId);
      if (error) {
        Alert.alert('Erreur', friendlyErrorMessage(error));
        return;
      }
      showToast('Budget retiré pour cette catégorie', 'neutral');
      await refresh();
      return;
    }
    const n = parseAmount(raw);
    if (n == null || n <= 0) {
      Alert.alert('Budget', 'Indique un montant positif ou laisse vide.');
      return;
    }
    const { error } = await supabase.from('category_budgets').upsert(
      {
        household_id: household.id,
        category_id: categoryId,
        monthly_cap: n,
      },
      { onConflict: 'household_id,category_id' }
    );
    if (error) {
      Alert.alert('Erreur', friendlyErrorMessage(error));
      return;
    }
    showToast('Budget enregistré', 'success');
    await refresh();
  }

  if (!household || categories.length === 0) {
    return null;
  }

  return (
    <>
      <SettingsSectionTitle>Budgets par catégorie</SettingsSectionTitle>
      <Text style={styles.hint}>
        Plafond indicatif pour le mois civil en cours — comparé aux dépenses de
        la même catégorie. Laisse vide pour ne pas suivre.
      </Text>
      <SettingsGroup>
        {categories.map((c, i) => (
          <SettingsCell
            key={c.id}
            label={c.name}
            sublabel="Mensuel"
            showDivider={i < categories.length - 1}
          >
            <View style={styles.budgetRow}>
              <TextInput
                style={styles.budgetInput}
                keyboardType="decimal-pad"
                placeholder="—"
                placeholderTextColor={colors.textMuted}
                value={drafts[c.id] ?? ''}
                onChangeText={(v) =>
                  setDrafts((s) => ({ ...s, [c.id]: v }))
                }
              />
              <Text style={styles.eur}>{household.currency}</Text>
              <Pressable
                onPress={() => void saveBudget(c.id)}
                hitSlop={8}
                style={styles.saveMini}
              >
                <Text style={styles.saveMiniTxt}>OK</Text>
              </Pressable>
            </View>
          </SettingsCell>
        ))}
      </SettingsGroup>
      <Text style={styles.footnote}>
        Sur la liste des dépenses (mois en cours), tu vois l’avancement par
        catégorie. Un rappel discret s’affiche après une saisie si tu dépasses
        80 % ou 100 % du plafond.
      </Text>
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
  footnote: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
    lineHeight: 18,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    paddingHorizontal: 4,
  },
  budgetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  budgetInput: {
    minWidth: 72,
    maxWidth: 100,
    paddingVertical: 8,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: hairline,
    borderColor: colors.border,
    fontSize: fontSize.small,
    color: colors.text,
    backgroundColor: colors.surfaceMuted,
  },
  eur: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
  saveMini: {
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
  },
  saveMiniTxt: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
});
