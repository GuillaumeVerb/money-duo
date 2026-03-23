import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
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
import {
  fetchLedgerExpenseRows,
  fetchSettlementsFull,
  fetchSplitsByExpenseIds,
  netBalancesFromLedger,
  pairwiseOwedForMembers,
} from '../lib/ledger';
import { parseAmount } from '../lib/parseAmount';
import { supabase } from '../lib/supabase';
import type { Settlement } from '../lib/types';
import { colors, fontSize, radius, spacing } from '../theme/tokens';

export function SplitScreen () {
  const { household, members, refresh } = useHousehold ();
  const [owed, setOwed] = useState (0);
  const [settlements, setSettlements] = useState<Settlement[]> ([]);
  const [amount, setAmount] = useState ('');
  const [note, setNote] = useState ('');

  const load = useCallback (async () => {
    if (!household) {
      return;
    }
    if (members.length < 2) {
      setOwed (0);
      setSettlements ([]);
      return;
    }

    try {
      const [expenseRows, stl] = await Promise.all ([
        fetchLedgerExpenseRows (household.id),
        fetchSettlementsFull (household.id),
      ]);
      setSettlements (stl);

      const nonPersonal = expenseRows.filter ((e) => e.expense_type !== 'personal');
      const splitsMap = await fetchSplitsByExpenseIds (nonPersonal.map ((e) => e.id));
      const settlementLines = stl.map ((s) => ({
        from_member_id: s.from_member_id,
        to_member_id: s.to_member_id,
        amount: Number (s.amount),
      }));
      const nets = netBalancesFromLedger (expenseRows, splitsMap, settlementLines);
      const memberIds = members.map ((m) => m.id);
      setOwed (pairwiseOwedForMembers (memberIds, nets));
    } catch {
      setOwed (0);
      setSettlements ([]);
    }
  }, [household, members]);

  useFocusEffect (
    useCallback (() => {
      void load ();
    }, [load])
  );

  async function addSettlement () {
    if (!household || members.length < 2) {
      return;
    }
    const n = parseAmount (amount);
    if (n == null || n <= 0) {
      Alert.alert ('Montant', 'Montant invalide.');
      return;
    }
    const m0 = members[0].id;
    const m1 = members[1].id;
    const from = owed > 0 ? m1 : m0;
    const to = owed > 0 ? m0 : m1;

    const { error } = await supabase.from ('settlements').insert ({
      household_id: household.id,
      from_member_id: from,
      to_member_id: to,
      amount: n,
      note: note.trim () || null,
    });
    if (error) {
      Alert.alert ('Erreur', error.message);
      return;
    }
    setAmount ('');
    setNote ('');
    await refresh ();
    await load ();
  }

  if (!household) {
    return null;
  }

  const m0 = members[0];
  const m1 = members[1];
  const labelOwed =
    owed === 0
      ? 'Équilibre atteint pour l’instant.'
      : owed > 0
        ? `${m1?.display_name ?? 'Partenaire'} a un écart à régulariser de ${formatMoney (
            Math.abs (owed),
            household.currency
          )} envers ${m0?.display_name ?? 'toi'}.`
        : `${m0?.display_name ?? 'Toi'} as un écart à régulariser de ${formatMoney (
            Math.abs (owed),
            household.currency
          )} envers ${m1?.display_name ?? 'ton partenaire'}.`;

  return (
    <FlatList
      data={settlements}
      keyExtractor={(s) => s.id}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <View>
          <View style={styles.card}>
            <Text style={styles.title}>Répartition</Text>
            <Text style={styles.body}>{labelOwed}</Text>
          </View>
          {members.length >= 2 ? (
            <View style={styles.card}>
              <Text style={styles.label}>Enregistrer une régularisation</Text>
              <TextInput
                style={styles.input}
                keyboardType="decimal-pad"
                placeholder="Montant"
                placeholderTextColor={colors.neutralMuted}
                value={amount}
                onChangeText={setAmount}
              />
              <TextInput
                style={styles.input}
                placeholder="Note (optionnel)"
                placeholderTextColor={colors.neutralMuted}
                value={note}
                onChangeText={setNote}
              />
              <Pressable style={styles.primary} onPress={() => void addSettlement ()}>
                <Text style={styles.primaryText}>Marquer comme soldé</Text>
              </Pressable>
            </View>
          ) : (
            <Text style={styles.hint}>
              Invite ton partenaire pour suivre l’équilibre à deux.
            </Text>
          )}
          <Text style={styles.section}>Historique</Text>
        </View>
      }
      ListEmptyComponent={
        <Text style={styles.empty}>Aucune régularisation enregistrée.</Text>
      }
      renderItem={({ item }) => (
        <View style={styles.row}>
          <Text style={styles.body}>
            {item.settled_at} —{' '}
            {formatMoney (Number (item.amount), household.currency)}
          </Text>
          {item.note ? <Text style={styles.meta}>{item.note}</Text> : null}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create ({
  list: { padding: spacing.md, backgroundColor: colors.neutralWarm, flexGrow: 1 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { fontWeight: '700', fontSize: fontSize.title, marginBottom: spacing.sm },
  body: { color: colors.neutralText, fontSize: fontSize.body },
  label: { fontWeight: '600', marginBottom: spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
  },
  primary: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  primaryText: { color: colors.surface, fontWeight: '700' },
  section: {
    fontWeight: '700',
    marginBottom: spacing.sm,
    color: colors.neutralText,
  },
  row: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  meta: { color: colors.neutralMuted, fontSize: fontSize.caption, marginTop: 4 },
  empty: { color: colors.neutralMuted },
  hint: { color: colors.neutralMuted, marginBottom: spacing.md },
});
