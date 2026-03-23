import * as Linking from 'expo-linking';
import React, { useState } from 'react';
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
import { supabase } from '../lib/supabase';
import type { SplitRuleKind } from '../lib/types';
import { colors, fontSize, radius, spacing } from '../theme/tokens';

const DEFAULT_CATEGORIES = ['Courses', 'Loyer', 'Loisirs', 'Santé', 'Autre'];

export function OnboardingScreen () {
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

      const url = Linking.createURL('invite', {
        scheme: 'moneyduo',
        queryParams: { token },
      });
      await new Promise<void>((resolve) => {
        Alert.alert(
          'Invitation partenaire',
          `Partage ce lien (7 jours) :\n\n${url}`,
          [{ text: 'OK', onPress: () => resolve() }]
        );
      });
      await refresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erreur';
      Alert.alert('Création', msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={styles.root}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Créer ton foyer</Text>
      <Text style={styles.sub}>
        Un espace partagé pour deux — tu pourras inviter ton·ta partenaire
        ensuite.
      </Text>
      <TextInput
        style={styles.input}
        placeholder="Nom du foyer"
        placeholderTextColor={colors.neutralMuted}
        value={name}
        onChangeText={setName}
      />
      <Text style={styles.label}>Règle par défaut</Text>
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
          placeholderTextColor={colors.neutralMuted}
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
    padding: spacing.lg,
    backgroundColor: colors.neutralWarm,
    flexGrow: 1,
  },
  title: {
    fontSize: fontSize.title,
    fontWeight: '700',
    color: colors.neutralText,
    marginBottom: spacing.sm,
  },
  sub: {
    color: colors.neutralMuted,
    marginBottom: spacing.lg,
    fontSize: fontSize.small,
  },
  label: {
    fontWeight: '600',
    marginBottom: spacing.sm,
    color: colors.neutralText,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    fontSize: fontSize.body,
    color: colors.neutralText,
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
