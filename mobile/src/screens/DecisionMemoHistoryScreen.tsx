import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useHousehold } from '../context/HouseholdContext';
import { formatMonthHeading, parseMonthKeyToDate } from '../lib/dates';
import { supabase } from '../lib/supabase';
import type { DecisionNote } from '../lib/types';
import { screenContentPaddingTop, screenPaddingH } from '../theme/screenLayout';
import { colors, fontSize, fontWeight, hairline, radius, spacing } from '../theme/tokens';

export function DecisionMemoHistoryScreen () {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { demoMode } = useAuth();
  const { household } = useHousehold();
  const [rows, setRows] = useState<DecisionNote[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!household || demoMode) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('decision_notes')
      .select('*')
      .eq('household_id', household.id)
      .order('month', { ascending: false });
    if (error) {
      setRows([]);
    } else {
      setRows((data ?? []) as DecisionNote[]);
    }
    setLoading(false);
  }, [household, demoMode]);

  React.useEffect(() => {
    void load();
  }, [load]);

  function monthLabel (monthKey: string): string {
    const d = parseMonthKeyToDate(monthKey.trim());
    if (d) {
      return formatMonthHeading(d);
    }
    return monthKey;
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: screenContentPaddingTop(insets.top),
          paddingBottom: insets.bottom + spacing.xl,
        },
      ]}
    >
      <Text style={styles.kicker}>À deux</Text>
      <Text style={styles.title}>Historique des mémos</Text>
      <Text style={styles.sub}>
        Les notes de décision enregistrées (récap mensuel), du plus récent au
        plus ancien.
      </Text>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : demoMode ? (
        <Card variant="soft" padded>
          <Text style={styles.empty}>
            Les mémos ne sont pas disponibles en mode aperçu.
          </Text>
        </Card>
      ) : rows.length === 0 ? (
        <Card variant="soft" padded>
          <Text style={styles.empty}>
            Aucun mémo pour l’instant — enregistrez-en depuis le récap du mois.
          </Text>
        </Card>
      ) : (
        rows.map((r, i) => (
          <Card
            key={r.id}
            style={[styles.card, i > 0 && styles.cardGap]}
            density="compact"
          >
            <Text style={styles.monthLabel}>{monthLabel(r.month)}</Text>
            <Text style={styles.body} numberOfLines={6}>
              {r.body.trim() || '—'}
            </Text>
            {r.remind_at ? (
              <Text style={styles.remind}>
                Rappel prévu : {String(r.remind_at).slice(0, 10)}
              </Text>
            ) : null}
          </Card>
        ))
      )}

      <Pressable
        style={styles.close}
        onPress={() => navigation.goBack()}
        hitSlop={12}
      >
        <Text style={styles.closeTxt}>Fermer</Text>
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
  loading: { paddingVertical: spacing.xl, alignItems: 'center' },
  empty: {
    fontSize: fontSize.small,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  card: { paddingVertical: spacing.md },
  cardGap: { marginTop: spacing.sm },
  monthLabel: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  body: {
    fontSize: fontSize.body,
    color: colors.text,
    lineHeight: 22,
  },
  remind: {
    marginTop: spacing.sm,
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
  close: {
    alignItems: 'center',
    marginTop: spacing.xl,
    paddingVertical: spacing.md,
  },
  closeTxt: {
    fontSize: fontSize.small,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
});
