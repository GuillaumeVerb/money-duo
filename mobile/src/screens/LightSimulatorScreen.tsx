import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card, SectionLabel } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useHousehold } from '../context/HouseholdContext';
import { isDateInRangeInclusive, monthBoundsISO } from '../lib/dates';
import { formatMoney } from '../lib/format';
import { parseAmount } from '../lib/parseAmount';
import { hypotheticalCustomShares } from '../lib/splitSimulator';
import { supabase } from '../lib/supabase';
import type { Goal } from '../lib/types';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { screenContentPaddingTop, screenPaddingH } from '../theme/screenLayout';
import { colors, fontSize, fontWeight, hairline, radius, spacing } from '../theme/tokens';
export function LightSimulatorScreen () {
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { demoMode } = useAuth();
  const { household, members } = useHousehold();
  const [monthCommun, setMonthCommun] = useState(0);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [extraGoal, setExtraGoal] = useState('50');
  const [pctDraft, setPctDraft] = useState('50');
  const [recDraft, setRecDraft] = useState('30');
  const [capDelta, setCapDelta] = useState('100');

  const load = useCallback(async () => {
    if (!household) {
      return;
    }
    if (demoMode) {
      setMonthCommun(1200);
      setGoal({
        id: 'x',
        household_id: household.id,
        name: 'Exemple',
        target_amount: 2000,
        current_amount: 800,
        target_date: null,
      });
      return;
    }
    const { start, end } = monthBoundsISO();
    const { data: ex } = await supabase
      .from('expenses')
      .select('amount, expense_type, spent_at')
      .eq('household_id', household.id);
    let commun = 0;
    for (const r of ex ?? []) {
      const row = r as { amount: number; expense_type: string; spent_at: string };
      const d = String(row.spent_at).slice(0, 10);
      if (
        row.expense_type === 'shared' &&
        isDateInRangeInclusive(d, start, end)
      ) {
        commun += Number(row.amount);
      }
    }
    setMonthCommun(commun);
    const { data: g } = await supabase
      .from('goals')
      .select('*')
      .eq('household_id', household.id)
      .is('archived_at', null)
      .neq('status', 'future')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setGoal(g ? (g as Goal) : null);
  }, [household, demoMode]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  if (!household) {
    return null;
  }

  const m0 = members[0]?.display_name ?? 'Membre 1';
  const m1 = members[1]?.display_name ?? 'Membre 2';

  const extraG = parseAmount(extraGoal) ?? 0;
  const goalRemaining =
    goal && Number(goal.target_amount) > 0
      ? Math.max(0, Number(goal.target_amount) - Number(goal.current_amount))
      : null;
  const monthsIfExtra =
    goalRemaining != null && extraG > 0
      ? Math.ceil(goalRemaining / extraG)
      : null;

  const pct = Math.min(100, Math.max(0, parseAmount(pctDraft) ?? 50));
  const simShares = hypotheticalCustomShares(monthCommun, pct);

  const rec = parseAmount(recDraft) ?? 0;
  const capPlus = parseAmount(capDelta) ?? 0;
  const cap = household.monthly_budget_cap;

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
      <Text style={styles.kicker}>Projection</Text>
      <Text style={styles.title}>Simulateur léger</Text>
      <Text style={styles.sub}>
        Quelques « et si » pour parler budget sans tableur — ordres de grandeur
        seulement.
      </Text>

      <SectionLabel
        title="Objectif"
        subtitle="Si vous mettiez un peu plus chaque mois."
      />
      <Card density="compact" style={styles.card}>
        {goal ? (
          <>
            <Text style={styles.p}>
              « {goal.name} » — il reste environ{' '}
              {formatMoney(goalRemaining ?? 0, household.currency)}.
            </Text>
            <Text style={styles.label}>+ par mois (simulation)</Text>
            <TextInput
              style={styles.input}
              keyboardType="decimal-pad"
              value={extraGoal}
              onChangeText={setExtraGoal}
              placeholder="50"
            />
            {monthsIfExtra != null ? (
              <Text style={styles.result}>
                À ce rythme indicatif : environ {monthsIfExtra} mois pour
                couvrir le reste (sans compter les aléas).
              </Text>
            ) : (
              <Text style={styles.muted}>
                Indiquez un montant mensuel positif pour voir une durée
                indicative.
              </Text>
            )}
          </>
        ) : (
          <Text style={styles.muted}>
            Créez un objectif actif pour activer cette simulation.
          </Text>
        )}
      </Card>

      <SectionLabel
        title="Répartition (commun du mois)"
        subtitle={`Total commun ce mois : ${formatMoney(monthCommun, household.currency)}.`}
      />
      <Card density="compact" style={styles.card}>
        <Text style={styles.label}>% pour {m0} (hypothèse sur le total commun)</Text>
        <TextInput
          style={styles.input}
          keyboardType="decimal-pad"
          value={pctDraft}
          onChangeText={setPctDraft}
        />
        <Text style={styles.result}>
          {m0} ~ {formatMoney(simShares.first, household.currency)} · {m1} ~{' '}
          {formatMoney(simShares.second, household.currency)}
        </Text>
        <Text style={styles.muted}>
          Les vraies lignes peuvent avoir d’autres règles — c’est un repère de
          discussion.
        </Text>
      </Card>

      <SectionLabel
        title="Charge récurrente"
        subtitle="Si une nouvelle mensualité s’ajoutait."
      />
      <Card density="compact" style={styles.card}>
        <Text style={styles.label}>Montant mensuel supplémentaire</Text>
        <TextInput
          style={styles.input}
          keyboardType="decimal-pad"
          value={recDraft}
          onChangeText={setRecDraft}
        />
        <Text style={styles.result}>
          Le mois « grossirait » d’environ{' '}
          {formatMoney(rec, household.currency)} côté charges récurrentes.
        </Text>
      </Card>

      {cap != null && cap > 0 ? (
        <>
          <SectionLabel
            title="Budget global"
            subtitle={`Plafond actuel : ${formatMoney(cap, household.currency)}.`}
          />
          <Card density="compact" style={styles.card}>
            <Text style={styles.label}>Augmenter le plafond de (simulation)</Text>
            <TextInput
              style={styles.input}
              keyboardType="decimal-pad"
              value={capDelta}
              onChangeText={setCapDelta}
            />
            <Text style={styles.result}>
              Nouveau plafond indicatif :{' '}
              {formatMoney(cap + capPlus, household.currency)}.
            </Text>
            <Text style={styles.muted}>
              Pour appliquer vraiment ce chiffre : Réglages → Budget global du
              mois.
            </Text>
          </Card>
        </>
      ) : null}

      <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
        <Text style={styles.close}>Fermer</Text>
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
  card: { marginBottom: spacing.lg },
  label: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  input: {
    borderWidth: hairline,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.sm,
    fontSize: fontSize.body,
    color: colors.text,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
  },
  p: {
    fontSize: fontSize.small,
    color: colors.text,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  result: {
    fontSize: fontSize.small,
    fontWeight: fontWeight.medium,
    color: colors.primaryDark,
    lineHeight: 22,
  },
  muted: {
    marginTop: spacing.sm,
    fontSize: fontSize.caption,
    color: colors.textMuted,
    lineHeight: 18,
  },
  close: {
    textAlign: 'center',
    marginTop: spacing.lg,
    fontSize: fontSize.small,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
});
