import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useHousehold } from '../context/HouseholdContext';
import { openAddExpense } from '../navigation/openAddExpense';
import { formatMoney } from '../lib/format';
import { supabase } from '../lib/supabase';
import type { Expense, ExpenseType } from '../lib/types';
import { colors, fontSize, radius, spacing } from '../theme/tokens';

const TYPE_LABEL: Record<ExpenseType, string> = {
  shared: 'Commun',
  personal: 'Perso',
  child: 'Enfant',
  home: 'Maison',
};

export function ExpensesScreen () {
  const navigation = useNavigation();
  const { household, categories } = useHousehold();
  const [rows, setRows] = useState<Expense[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!household) {
      return;
    }
    const { data } = await supabase
      .from('expenses')
      .select('*')
      .eq('household_id', household.id)
      .order('spent_at', { ascending: false })
      .limit(200);
    setRows((data ?? []) as Expense[]);
  }, [household]);

  async function pullRefresh () {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  async function remove (id: string) {
    Alert.alert('Supprimer', 'Confirmer la suppression ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('expenses').delete().eq('id', id);
          await load();
        },
      },
    ]);
  }

  if (!household) {
    return null;
  }

  return (
    <FlatList
      data={rows}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      refreshing={refreshing}
      onRefresh={() => void pullRefresh()}
      ListEmptyComponent={
        <Text style={styles.empty}>Aucune dépense pour l’instant.</Text>
      }
      renderItem={({ item }) => {
        const cat = categories.find((c) => c.id === item.category_id)?.name;
        return (
          <View style={styles.row}>
            <Pressable
              style={{ flex: 1 }}
              onPress={() => openAddExpense(navigation, item.id)}
            >
              <Text style={styles.amount}>
                {formatMoney(Number(item.amount), household.currency)}
              </Text>
              <Text style={styles.meta}>
                {item.spent_at} · {TYPE_LABEL[item.expense_type]}
                {cat ? ` · ${cat}` : ''}
              </Text>
              <Text style={styles.editHint}>Appuyer pour modifier</Text>
            </Pressable>
            <Pressable onPress={() => void remove(item.id)}>
              <Text style={styles.del}>Supprimer</Text>
            </Pressable>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.md, backgroundColor: colors.neutralWarm, flexGrow: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  amount: { fontWeight: '700', fontSize: fontSize.body, color: colors.neutralText },
  meta: { color: colors.neutralMuted, fontSize: fontSize.caption, marginTop: 4 },
  del: { color: colors.alertSoft, fontWeight: '600' },
  editHint: {
    fontSize: fontSize.caption,
    color: colors.accent,
    marginTop: 4,
  },
  empty: { textAlign: 'center', color: colors.neutralMuted, marginTop: spacing.xl },
});
