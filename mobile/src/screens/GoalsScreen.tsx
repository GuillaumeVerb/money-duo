import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useHousehold } from '../context/HouseholdContext';
import { formatMoney } from '../lib/format';
import { parseAmount } from '../lib/parseAmount';
import { supabase } from '../lib/supabase';
import type { Goal } from '../lib/types';
import { colors, fontSize, radius, spacing } from '../theme/tokens';

export function GoalsScreen () {
  const { household, refresh } = useHousehold();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [contrib, setContrib] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!household) {
      return;
    }
    const { data } = await supabase
      .from('goals')
      .select('*')
      .eq('household_id', household.id)
      .order('created_at', { ascending: false });
    setGoals((data ?? []) as Goal[]);
  }, [household]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addGoal () {
    if (!household) {
      return;
    }
    const t = parseAmount(target);
    if (!name.trim() || t == null || t <= 0) {
      Alert.alert('Objectif', 'Nom et montant cible requis.');
      return;
    }
    const { error } = await supabase.from('goals').insert({
      household_id: household.id,
      name: name.trim(),
      target_amount: t,
      current_amount: 0,
      owner_scope: 'household',
    });
    if (error) {
      Alert.alert('Erreur', error.message);
      return;
    }
    setName('');
    setTarget('');
    await refresh();
    await load();
  }

  async function addContribution (g: Goal) {
    const raw = contrib[g.id] ?? '';
    const n = parseAmount(raw);
    if (n == null || n <= 0) {
      Alert.alert('Montant', 'Montant invalide.');
      return;
    }
    const next = Number(g.current_amount) + n;
    const { error } = await supabase
      .from('goals')
      .update({ current_amount: next })
      .eq('id', g.id);
    if (error) {
      Alert.alert('Erreur', error.message);
      return;
    }
    setContrib((c) => ({ ...c, [g.id]: '' }));
    await refresh();
    await load();
  }

  if (!household) {
    return null;
  }

  return (
    <FlatList
      data={goals}
      keyExtractor={(g) => g.id}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <View style={styles.card}>
          <Text style={styles.title}>Nouvel objectif</Text>
          <TextInput
            style={styles.input}
            placeholder="Nom"
            placeholderTextColor={colors.neutralMuted}
            value={name}
            onChangeText={setName}
          />
          <TextInput
            style={styles.input}
            placeholder="Montant cible"
            keyboardType="decimal-pad"
            placeholderTextColor={colors.neutralMuted}
            value={target}
            onChangeText={setTarget}
          />
          <Pressable style={styles.primary} onPress={() => void addGoal()}>
            <Text style={styles.primaryText}>Créer</Text>
          </Pressable>
        </View>
      }
      ListEmptyComponent={
        <Text style={styles.empty}>Aucun objectif pour l’instant.</Text>
      }
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Text style={styles.goalName}>{item.name}</Text>
          <Text style={styles.body}>
            {formatMoney(Number(item.current_amount), household.currency)} /{' '}
            {formatMoney(Number(item.target_amount), household.currency)}
          </Text>
          <Text style={styles.hint}>
            Ajouter une contribution (confirmation explicite, R-10)
          </Text>
          <TextInput
            style={styles.input}
            keyboardType="decimal-pad"
            placeholder="Montant"
            placeholderTextColor={colors.neutralMuted}
            value={contrib[item.id] ?? ''}
            onChangeText={(v) =>
              setContrib((c) => ({ ...c, [item.id]: v }))
            }
          />
          <Pressable
            style={styles.secondary}
            onPress={() => void addContribution(item)}
          >
            <Text style={styles.secondaryText}>Ajouter au compteur</Text>
          </Pressable>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.md, backgroundColor: colors.neutralWarm, flexGrow: 1 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { fontWeight: '700', marginBottom: spacing.sm },
  goalName: { fontWeight: '700', fontSize: fontSize.body },
  body: { marginTop: spacing.xs, color: colors.neutralText },
  hint: { marginTop: spacing.sm, color: colors.neutralMuted, fontSize: fontSize.caption },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  primary: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  primaryText: { color: colors.surface, fontWeight: '700' },
  secondary: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    alignItems: 'center',
  },
  secondaryText: { color: colors.accent, fontWeight: '600' },
  empty: { color: colors.neutralMuted, textAlign: 'center', marginTop: spacing.lg },
});
