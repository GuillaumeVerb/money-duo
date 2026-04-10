import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card, PrimaryButton } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useHousehold } from '../context/HouseholdContext';
import { friendlyErrorMessage } from '../lib/userFriendlyError';
import { splitRuleLabel } from '../lib/splitRuleCopy';
import { supabase } from '../lib/supabase';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { screenContentPaddingTop, screenPaddingH } from '../theme/screenLayout';
import { colors, fontSize, fontWeight, hairline, radius, spacing } from '../theme/tokens';

export function FinancialCharterScreen () {
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { demoMode } = useAuth();
  const { showToast } = useToast();
  const { household, refresh } = useHousehold();
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setNotes(household?.charter_notes?.trim() ?? '');
  }, [household?.id, household?.charter_notes]);

  async function save () {
    if (demoMode) {
      Alert.alert(
        'Mode aperçu',
        'Connectez-vous pour enregistrer votre contrat léger.'
      );
      return;
    }
    if (!household) {
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('households')
        .update({ charter_notes: notes.trim() || null })
        .eq('id', household.id);
      if (error) {
        throw error;
      }
      showToast('Contrat mis à jour', 'success');
      await refresh();
    } catch (e: unknown) {
      Alert.alert('Enregistrement', friendlyErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  if (!household) {
    return null;
  }

  const rule = splitRuleLabel(household.default_split_rule, household);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: screenContentPaddingTop(insets.top),
          paddingBottom: insets.bottom + spacing.xxl,
        },
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.kicker}>Alignement</Text>
      <Text style={styles.title}>Notre contrat léger</Text>
      <Text style={styles.sub}>
        Pas juridique — juste ce que vous vous dites à deux pour réduire les
        quiproquos. Vous pouvez le relire et l’ajuster quand vous voulez.
      </Text>

      <Card density="compact" style={styles.card}>
        <Text style={styles.blockLabel}>Règle de partage (référence)</Text>
        <Text style={styles.blockBody}>{rule}</Text>
        <Text style={styles.blockFoot}>
          S’applique aux nouvelles dépenses ; l’historique garde la règle du
          jour de saisie.
        </Text>
      </Card>

      <Card density="compact" style={styles.card}>
        <Text style={styles.blockLabel}>Ce qui est commun, ce qui reste perso</Text>
        <Text style={styles.blockBody}>
          • Les dépenses marquées « Commun » entrent dans l’équilibre à deux.
        </Text>
        <Text style={styles.blockBody}>
          • « Perso » reste de côté — utile pour garder une marge individuelle.
        </Text>
        <Text style={styles.blockBody}>
          • « Enfant » et « Maison » sont des repères pour parler budget sans
          tout mélanger.
        </Text>
      </Card>

      <Text style={styles.fieldLabel}>Vos notes communes</Text>
      <TextInput
        style={styles.input}
        value={notes}
        onChangeText={setNotes}
        placeholder="Ex. on valide les achats > 200 € ensemble…"
        placeholderTextColor={colors.textMuted}
        multiline
        maxLength={2000}
        textAlignVertical="top"
        editable={!demoMode}
      />

      <PrimaryButton
        title={saving ? 'Enregistrement…' : 'Enregistrer'}
        onPress={() => void save()}
        disabled={demoMode || saving}
        loading={saving}
      />

      <Pressable onPress={() => navigation.goBack()} style={styles.footerBtn}>
        <Text style={styles.footerHint}>Fermer</Text>
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
    marginBottom: spacing.lg,
    fontSize: fontSize.small,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  card: { marginBottom: spacing.md },
  blockLabel: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  blockBody: {
    fontSize: fontSize.small,
    color: colors.text,
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  blockFoot: {
    fontSize: fontSize.micro,
    color: colors.textMuted,
    lineHeight: 18,
    marginTop: spacing.xs,
  },
  fieldLabel: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  input: {
    minHeight: 120,
    borderWidth: hairline,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: fontSize.body,
    color: colors.text,
    backgroundColor: colors.surface,
    marginBottom: spacing.lg,
  },
  footerBtn: { marginTop: spacing.lg, alignItems: 'center', paddingVertical: spacing.sm },
  footerHint: {
    fontSize: fontSize.small,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
});
