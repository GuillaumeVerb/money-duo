import * as Clipboard from 'expo-clipboard';
import React, { useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useHousehold } from '../context/HouseholdContext';
import { supabase } from '../lib/supabase';
import { buildInviteUrl } from '../lib/inviteUrl';
import { friendlyErrorMessage } from '../lib/userFriendlyError';
import type { SplitRuleKind } from '../lib/types';
import { screenContentPaddingTop } from '../theme/screenLayout';
import {
  colors,
  fontSize,
  fontWeight,
  hairline,
  radius,
  spacing,
} from '../theme/tokens';

const DEFAULT_CATEGORIES = ['Courses', 'Loyer', 'Loisirs', 'Santé', 'Autre'];

export function OnboardingScreen () {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { refresh } = useHousehold();
  const [name, setName] = useState('');
  const [rule, setRule] = useState<SplitRuleKind>('equal');
  const [customPct, setCustomPct] = useState('50');
  const [busy, setBusy] = useState(false);

  async function createHousehold () {
    if (!user || !name.trim()) {
      Alert.alert('Foyer', 'Donne un nom à ton foyer.');
      return;
    }
    setBusy(true);
    try {
      const { data: hh, error: hErr } = await supabase
        .from('households')
        .insert({
          name: name.trim(),
          currency: 'EUR',
          default_split_rule: rule,
          default_custom_percent:
            rule === 'custom_percent' ? Number(customPct) : null,
        })
        .select()
        .single();

      if (hErr || !hh) {
        throw hErr ?? new Error('household');
      }

      const { error: mErr } = await supabase.from('household_members').insert({
        household_id: hh.id,
        user_id: user.id,
        role: 'owner',
      });
      if (mErr) {
        throw mErr;
      }

      const cats = DEFAULT_CATEGORIES.map((n) => ({
        household_id: hh.id,
        name: n,
      }));
      await supabase.from('categories').insert(cats);

      const token = globalThis.crypto.randomUUID();
      const expires = new Date();
      expires.setDate(expires.getDate() + 7);

      await supabase.from('household_invites').insert({
        household_id: hh.id,
        token,
        invited_by: user.id,
        expires_at: expires.toISOString(),
      });

      const url = buildInviteUrl(token);
      const shareMessage = `Rejoins notre foyer sur Money Duo (lien valable 7 jours) :\n${url}`;
      await refresh();
      const buttons: {
        text: string;
        style?: 'cancel' | 'destructive' | 'default';
        onPress?: () => void;
      }[] = [
        {
          text: 'Copier le lien',
          onPress: () => {
            void Clipboard.setStringAsync(url).catch(() => {
              /* presse-papiers indisponible */
            });
          },
        },
      ];
      if (Platform.OS !== 'web') {
        buttons.push({
          text: 'Partager…',
          onPress: () => {
            void Share.share({
              message: shareMessage,
              title: 'Invitation Money Duo',
            }).catch(() => {
              /* partage annulé */
            });
          },
        });
      }
      buttons.push({ text: 'OK', style: 'cancel' });
      Alert.alert(
        'Invitation partenaire',
        `Envoie ce lien à ton partenaire — il est valable 7 jours.\n\n${url}`,
        buttons,
        { cancelable: true }
      );
    } catch (e: unknown) {
      Alert.alert('Création', friendlyErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={[
        styles.root,
        { paddingTop: screenContentPaddingTop(insets.top) },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.kicker}>Première étape</Text>
      <Text style={styles.title}>Créer ton foyer</Text>
      <Text style={styles.sub}>
        Un espace partagé pour deux — tu pourras inviter ton·ta partenaire
        ensuite.
      </Text>
      <TextInput
        style={styles.input}
        placeholder="Nom du foyer"
        placeholderTextColor={colors.textMuted}
        value={name}
        onChangeText={setName}
      />
      <Text style={styles.label}>Règle par défaut</Text>
      <Text style={styles.ruleExpl}>
        Elle s’applique aux prochaines dépenses ; l’historique déjà saisi garde
        la règle du moment où elles ont été créées.
      </Text>
      <View style={styles.row}>
        {(
          [
            ['equal', '50/50'],
            ['custom_percent', 'Pourcentage'],
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
      {rule === 'custom_percent' && (
        <TextInput
          style={styles.input}
          keyboardType="decimal-pad"
          placeholder="Part du premier membre (%)"
          placeholderTextColor={colors.textMuted}
          value={customPct}
          onChangeText={setCustomPct}
        />
      )}
      <Pressable
        style={[styles.primary, busy && { opacity: 0.6 }]}
        disabled={busy}
        onPress={() => void createHousehold()}
      >
        <Text style={styles.primaryText}>Continuer</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.canvas,
    flexGrow: 1,
  },
  kicker: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.medium,
    color: colors.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: fontSize.display,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginBottom: spacing.sm,
    letterSpacing: -0.4,
  },
  sub: {
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    fontSize: fontSize.small,
    lineHeight: 22,
    maxWidth: 360,
  },
  label: {
    fontWeight: fontWeight.medium,
    marginBottom: spacing.xs,
    color: colors.text,
    fontSize: fontSize.caption,
  },
  ruleExpl: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
    lineHeight: 18,
    marginBottom: spacing.sm,
    maxWidth: 360,
  },
  input: {
    borderWidth: hairline,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    fontSize: fontSize.body,
    color: colors.text,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipOn: {
    borderColor: colors.accent,
    backgroundColor: '#E6F2F2',
  },
  chipText: { color: colors.neutralMuted, fontSize: fontSize.small },
  chipTextOn: { color: colors.accent, fontWeight: '600' },
  primary: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  primaryText: { color: colors.surface, fontWeight: '600', fontSize: fontSize.body },
});
