import {
  useFocusEffect,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Card,
  EmptyState,
  InputField,
  PrimaryButton,
  ProgressBar,
  SecondaryButton,
} from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useHousehold } from '../context/HouseholdContext';
import {
  screenContentPaddingTop,
  screenPaddingH,
} from '../theme/screenLayout';
import {
  formatMonthHeading,
  isDateInRangeInclusive,
  monthBoundsISO,
  parseMonthKeyToDate,
} from '../lib/dates';
import type { MainTabParamList } from '../navigation/MainTabs';
import { openAddExpense } from '../navigation/openAddExpense';
import { openExpenseDetail } from '../navigation/openExpenseDetail';
import { budgetLevel } from '../lib/categoryBudget';
import { formatMoney } from '../lib/format';
import { supabase } from '../lib/supabase';
import type { Expense, ExpenseType } from '../lib/types';
import type { ExpenseSavedView } from '../lib/expenseSavedViews';
import {
  loadExpenseSavedViews,
  removeExpenseSavedView,
  saveExpenseSavedView,
} from '../lib/expenseSavedViews';
import { friendlyErrorMessage } from '../lib/userFriendlyError';
import {
  colors,
  fontSize,
  fontWeight,
  hairline,
  radius,
  spacing,
} from '../theme/tokens';

const TYPE_LABEL: Record<ExpenseType, string> = {
  shared: 'Commun',
  personal: 'Perso',
  child: 'Enfant',
  home: 'Maison',
};

type CategoryFilter = 'all' | 'none' | string;

export function ExpensesScreen () {
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<BottomTabNavigationProp<MainTabParamList, 'Expenses'>>();
  const route = useRoute<RouteProp<MainTabParamList, 'Expenses'>>();
  const { household, categories, categoryBudgets, refresh } = useHousehold();
  const { demoMode } = useAuth();
  const { showToast } = useToast();
  const [rows, setRows] = useState<Expense[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [scope, setScope] = useState<'month' | 'all'>('month');
  const [categoryFilter, setCategoryFilter] =
    useState<CategoryFilter>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | ExpenseType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [fetchLimit, setFetchLimit] = useState(400);
  const [lockedMonth, setLockedMonth] = useState<{
    start: string;
    end: string;
    label: string;
  } | null>(null);
  const [savedViews, setSavedViews] = useState<ExpenseSavedView[]>([]);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveViewName, setSaveViewName] = useState('');

  const load = useCallback(async () => {
    if (!household) {
      return;
    }
    const { data } = await supabase
      .from('expenses')
      .select('*')
      .eq('household_id', household.id)
      .order('spent_at', { ascending: false })
      .limit(fetchLimit);
    setRows((data ?? []) as Expense[]);
  }, [household, fetchLimit]);

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

  useFocusEffect(
    useCallback(() => {
      const p = route.params;
      if (!p) {
        return;
      }
      const hasScope =
        p.initialScope === 'month' || p.initialScope === 'all';
      const hasCat = p.initialCategory !== undefined;
      const mk = p.monthKey;
      if (mk) {
        const d = parseMonthKeyToDate(mk);
        if (d) {
          const b = monthBoundsISO(d);
          setLockedMonth({
            start: b.start,
            end: b.end,
            label: formatMonthHeading(d),
          });
          setScope('month');
        }
      }
      if (!hasScope && !hasCat && !mk) {
        return;
      }
      if (hasScope && p.initialScope) {
        setScope(p.initialScope);
      }
      if (hasCat && p.initialCategory !== undefined) {
        setCategoryFilter(p.initialCategory);
      }
      navigation.setParams({
        initialScope: undefined,
        initialCategory: undefined,
        monthKey: undefined,
      });
    }, [navigation, route.params])
  );

  async function remove (id: string) {
    if (demoMode) {
      Alert.alert(
        'Mode aperçu',
        'Connectez-vous pour supprimer une dépense réelle.'
      );
      return;
    }
    Alert.alert('Supprimer', 'Confirmer la suppression ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('expenses').delete().eq('id', id);
          if (error) {
            Alert.alert('Suppression impossible', friendlyErrorMessage(error));
            return;
          }
          showToast('Dépense supprimée', 'success');
          await load();
          await refresh();
        },
      },
    ]);
  }

  function applySavedView (v: ExpenseSavedView) {
    setLockedMonth(null);
    setScope(v.scope);
    setCategoryFilter(v.categoryFilter as CategoryFilter);
    setTypeFilter(v.typeFilter);
    setSearchQuery('');
  }

  function promptRemoveView (v: ExpenseSavedView) {
    if (!household) {
      return;
    }
    Alert.alert(
      `Supprimer « ${v.name} » ?`,
      'Cette vue enregistrée sera retirée de cet appareil.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            const next = await removeExpenseSavedView(household.id, v.id);
            setSavedViews(next);
            showToast('Vue supprimée', 'neutral');
          },
        },
      ]
    );
  }

  async function commitSaveView () {
    if (!household) {
      return;
    }
    const name = saveViewName.trim();
    if (!name) {
      Alert.alert('Nom', 'Donnez un nom à cette vue.');
      return;
    }
    const next = await saveExpenseSavedView(household.id, {
      name,
      scope,
      categoryFilter: categoryFilter as ExpenseSavedView['categoryFilter'],
      typeFilter,
    });
    setSavedViews(next);
    setSaveModalOpen(false);
    setSaveViewName('');
    showToast('Vue enregistrée', 'success');
  }

  const { start, end } = monthBoundsISO();
  const afterScope = useMemo(() => {
    if (lockedMonth) {
      return rows.filter((e) =>
        isDateInRangeInclusive(e.spent_at, lockedMonth.start, lockedMonth.end)
      );
    }
    const base =
      scope === 'all'
        ? rows
        : rows.filter((e) => isDateInRangeInclusive(e.spent_at, start, end));
    return base;
  }, [rows, scope, start, end, lockedMonth]);

  const visible = useMemo(() => {
    let base = afterScope;
    if (categoryFilter === 'none') {
      base = base.filter((e) => !e.category_id);
    } else if (categoryFilter !== 'all') {
      base = base.filter((e) => e.category_id === categoryFilter);
    }
    if (typeFilter !== 'all') {
      base = base.filter((e) => e.expense_type === typeFilter);
    }
    const q = searchQuery.trim().toLowerCase();
    if (q.length > 0) {
      base = base.filter((e) => {
        const note = (e.note ?? '').toLowerCase();
        const amt = String(e.amount);
        const cat =
          categories.find((c) => c.id === e.category_id)?.name.toLowerCase() ??
          '';
        return (
          note.includes(q) ||
          amt.includes(q) ||
          cat.includes(q) ||
          TYPE_LABEL[e.expense_type].toLowerCase().includes(q)
        );
      });
    }
    return base;
  }, [afterScope, categoryFilter, typeFilter, searchQuery, categories]);

  const hasUncategorized = useMemo(
    () => rows.some((e) => !e.category_id),
    [rows]
  );

  const spentByCategory = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const e of afterScope) {
      if (e.category_id) {
        acc[e.category_id] = (acc[e.category_id] ?? 0) + Number(e.amount);
      }
    }
    return acc;
  }, [afterScope]);

  const monthTotalSpent = useMemo(
    () => afterScope.reduce((s, e) => s + Number(e.amount), 0),
    [afterScope]
  );

  const showBudgetStrip =
    (scope === 'month' || lockedMonth != null) &&
    (categoryBudgets.length > 0 ||
      (household != null &&
        household.monthly_budget_cap != null &&
        household.monthly_budget_cap > 0));

  if (!household) {
    return null;
  }

  const emptyList = () => {
    if (rows.length === 0) {
      return (
        <EmptyState
          title="Aucune dépense pour l’instant"
          description="Ajoutez votre première dépense : le cockpit et l’équilibre se mettront à jour tout de suite."
          actionLabel="Ajouter une dépense"
          onAction={() => openAddExpense(navigation)}
        />
      );
    }
    if (afterScope.length === 0 && scope === 'month') {
      return (
        <EmptyState
          title="Rien sur ce mois-ci"
          description="Changez le filtre période ou catégorie, ou ajoutez une dépense."
          actionLabel="Voir tout"
          onAction={() => {
            setScope('all');
            setCategoryFilter('all');
          }}
        />
      );
    }
    if (visible.length === 0) {
      return (
        <EmptyState
          title="Aucune dépense dans ce filtre"
          description="Essayez une autre catégorie ou élargissez la période."
          actionLabel="Réinitialiser les filtres"
          onAction={() => {
            setCategoryFilter('all');
            setScope('all');
            setTypeFilter('all');
            setLockedMonth(null);
            setSearchQuery('');
          }}
        />
      );
    }
    return null;
  };

  return (
    <>
    <FlatList
      data={visible}
      keyExtractor={(item) => item.id}
      contentContainerStyle={[
        styles.list,
        {
          paddingTop: screenContentPaddingTop(insets.top),
          paddingBottom: insets.bottom + spacing.xxl,
        },
      ]}
      refreshing={refreshing}
      onRefresh={() => void pullRefresh()}
      ListHeaderComponent={
        <View style={styles.intro}>
          <Text style={styles.kicker}>Historique</Text>
          <Text style={styles.title}>Dépenses</Text>
          <Text style={styles.sub}>
            Détail, modification ou suppression depuis une ligne. Jusqu’à{' '}
            {fetchLimit} dépenses récentes chargées — vous pouvez en demander
            plus en bas de liste.
          </Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher (note, montant, type, catégorie…)"
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {lockedMonth ? (
            <View style={styles.lockBanner}>
              <Text style={styles.lockBannerTxt}>
                Mois affiché : {lockedMonth.label}
              </Text>
              <Pressable
                onPress={() => setLockedMonth(null)}
                hitSlop={8}
              >
                <Text style={styles.lockBannerClear}>Effacer</Text>
              </Pressable>
            </View>
          ) : null}
          {showBudgetStrip ? (
            <Card variant="soft" padded style={styles.budgetCard}>
              <Text style={styles.budgetCardTitle}>Budgets (mois affiché)</Text>
              {household.monthly_budget_cap != null &&
              household.monthly_budget_cap > 0 ? (
                <View style={styles.budgetLine}>
                  <View style={styles.budgetLineTop}>
                    <Text style={styles.budgetName}>Total du mois (global)</Text>
                    <Text
                      style={[
                        styles.budgetFig,
                        budgetLevel(
                          monthTotalSpent,
                          household.monthly_budget_cap
                        ) === 'over' && { color: colors.danger },
                        budgetLevel(
                          monthTotalSpent,
                          household.monthly_budget_cap
                        ) === 'warn' && { color: colors.accentWarm },
                      ]}
                    >
                      {formatMoney(monthTotalSpent, household.currency)} /{' '}
                      {formatMoney(
                        household.monthly_budget_cap,
                        household.currency
                      )}
                    </Text>
                  </View>
                  <ProgressBar
                    progress={Math.min(
                      1,
                      monthTotalSpent / household.monthly_budget_cap
                    )}
                    height={6}
                    fillColor={
                      budgetLevel(
                        monthTotalSpent,
                        household.monthly_budget_cap
                      ) === 'over'
                        ? colors.danger
                        : budgetLevel(
                              monthTotalSpent,
                              household.monthly_budget_cap
                            ) === 'warn'
                          ? colors.accentWarm
                          : colors.primary
                    }
                  />
                </View>
              ) : null}
              {categoryBudgets.map((b) => {
                const name =
                  categories.find((c) => c.id === b.category_id)?.name ?? '—';
                const spent = spentByCategory[b.category_id] ?? 0;
                const lvl = budgetLevel(spent, b.monthly_cap);
                const prog = Math.min(1, spent / b.monthly_cap);
                const fill =
                  lvl === 'over'
                    ? colors.danger
                    : lvl === 'warn'
                      ? colors.accentWarm
                      : colors.primary;
                return (
                  <View key={b.id} style={styles.budgetLine}>
                    <View style={styles.budgetLineTop}>
                      <Text style={styles.budgetName}>{name}</Text>
                      <Text
                        style={[
                          styles.budgetFig,
                          lvl === 'over' && { color: colors.danger },
                          lvl === 'warn' && { color: colors.accentWarm },
                        ]}
                      >
                        {formatMoney(spent, household.currency)} /{' '}
                        {formatMoney(b.monthly_cap, household.currency)}
                      </Text>
                    </View>
                    <ProgressBar progress={prog} height={6} fillColor={fill} />
                  </View>
                );
              })}
            </Card>
          ) : null}
          <View style={styles.filterRow}>
            <Pressable
              style={[styles.filterChip, scope === 'month' && styles.filterChipOn]}
              onPress={() => {
                setLockedMonth(null);
                setScope('month');
              }}
            >
              <Text
                style={[
                  styles.filterText,
                  scope === 'month' && styles.filterTextOn,
                ]}
              >
                Ce mois-ci
              </Text>
            </Pressable>
            <Pressable
              style={[styles.filterChip, scope === 'all' && styles.filterChipOn]}
              onPress={() => setScope('all')}
            >
              <Text
                style={[
                  styles.filterText,
                  scope === 'all' && styles.filterTextOn,
                ]}
              >
                Tout
              </Text>
            </Pressable>
          </View>
          <Text style={styles.catHeading}>Catégorie</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.catScroll}
          >
            <Pressable
              style={[
                styles.filterChip,
                categoryFilter === 'all' && styles.filterChipOn,
              ]}
              onPress={() => setCategoryFilter('all')}
            >
              <Text
                style={[
                  styles.filterText,
                  categoryFilter === 'all' && styles.filterTextOn,
                ]}
              >
                Toutes
              </Text>
            </Pressable>
            {hasUncategorized ? (
              <Pressable
                style={[
                  styles.filterChip,
                  categoryFilter === 'none' && styles.filterChipOn,
                ]}
                onPress={() => setCategoryFilter('none')}
              >
                <Text
                  style={[
                    styles.filterText,
                    categoryFilter === 'none' && styles.filterTextOn,
                  ]}
                  numberOfLines={1}
                >
                  Sans catégorie
                </Text>
              </Pressable>
            ) : null}
            {categories.map((c) => (
              <Pressable
                key={c.id}
                style={[
                  styles.filterChip,
                  categoryFilter === c.id && styles.filterChipOn,
                ]}
                onPress={() => setCategoryFilter(c.id)}
              >
                <Text
                  style={[
                    styles.filterText,
                    categoryFilter === c.id && styles.filterTextOn,
                  ]}
                  numberOfLines={1}
                >
                  {c.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <Text style={styles.typeHeading}>Type</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.catScroll}
          >
            <Pressable
              style={[
                styles.filterChip,
                typeFilter === 'all' && styles.filterChipOn,
              ]}
              onPress={() => setTypeFilter('all')}
            >
              <Text
                style={[
                  styles.filterText,
                  typeFilter === 'all' && styles.filterTextOn,
                ]}
              >
                Tous
              </Text>
            </Pressable>
            {(
              [
                ['shared', 'Commun'],
                ['personal', 'Perso'],
                ['child', 'Enfant'],
                ['home', 'Maison'],
              ] as const
            ).map(([k, label]) => (
              <Pressable
                key={k}
                style={[
                  styles.filterChip,
                  typeFilter === k && styles.filterChipOn,
                ]}
                onPress={() => setTypeFilter(k)}
              >
                <Text
                  style={[
                    styles.filterText,
                    typeFilter === k && styles.filterTextOn,
                  ]}
                  numberOfLines={1}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <Text style={styles.viewsHeading}>Vues enregistrées (cet appareil)</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.viewsScroll}
          >
            <Pressable
              style={styles.viewChipAdd}
              onPress={() => {
                setSaveViewName('');
                setSaveModalOpen(true);
              }}
            >
              <Text style={styles.viewChipAddTxt}>＋ Mémoriser la vue</Text>
            </Pressable>
            {savedViews.map((v) => (
              <Pressable
                key={v.id}
                style={styles.viewChip}
                onPress={() => applySavedView(v)}
                onLongPress={() => promptRemoveView(v)}
              >
                <Text style={styles.viewChipTxt} numberOfLines={1}>
                  {v.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <Text style={styles.viewsHint}>
            Appui long sur une vue pour la supprimer.
          </Text>
        </View>
      }
      ListFooterComponent={
        rows.length >= fetchLimit ? (
          <Pressable
            style={styles.loadMore}
            onPress={() => setFetchLimit((n) => n + 200)}
          >
            <Text style={styles.loadMoreTxt}>
              Charger 200 dépenses supplémentaires
            </Text>
          </Pressable>
        ) : null
      }
      ListEmptyComponent={emptyList()}
      renderItem={({ item }) => {
        const cat = categories.find((x) => x.id === item.category_id)?.name;
        return (
          <Card variant="outline" density="compact" style={styles.card}>
            <View style={styles.row}>
              <Pressable
                style={styles.mainTap}
                onPress={() => openExpenseDetail(navigation, item.id)}
              >
                <View style={styles.iconBox}>
                  <Ionicons name="wallet-outline" size={18} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.amount}>
                    {formatMoney(Number(item.amount), household.currency)}
                  </Text>
                  <Text style={styles.meta}>
                    {item.spent_at} · {TYPE_LABEL[item.expense_type]}
                    {cat ? ` · ${cat}` : ''}
                  </Text>
                  <View style={styles.editHintRow}>
                    {item.attachment_url ? (
                      <Ionicons
                        name="attach-outline"
                        size={14}
                        color={colors.textMuted}
                        style={{ marginRight: 4 }}
                      />
                    ) : null}
                    <Text style={styles.editHint}>Détail et édition</Text>
                  </View>
                </View>
              </Pressable>
              <Pressable
                style={styles.trash}
                onPress={() => openAddExpense(navigation, undefined, item.id)}
                hitSlop={8}
                accessibilityLabel="Dupliquer la dépense"
              >
                <Ionicons name="copy-outline" size={20} color={colors.primary} />
              </Pressable>
              <Pressable
                style={styles.trash}
                onPress={() => void remove(item.id)}
                hitSlop={8}
              >
                <Ionicons name="trash-outline" size={20} color={colors.danger} />
              </Pressable>
            </View>
          </Card>
        );
      }}
    />
    <Modal
      visible={saveModalOpen}
      animationType="fade"
      transparent
      onRequestClose={() => setSaveModalOpen(false)}
    >
      <Pressable
        style={styles.saveModalBackdrop}
        onPress={() => setSaveModalOpen(false)}
      >
        <Pressable
          style={styles.saveModalCard}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={styles.saveModalTitle}>Nom de la vue</Text>
          <Text style={styles.saveModalSub}>
            Enregistre la période, la catégorie et le type actuellement
            sélectionnés.
          </Text>
          <InputField
            value={saveViewName}
            onChangeText={setSaveViewName}
            placeholder="Ex. Perso ce mois-ci"
            autoFocus
          />
          <PrimaryButton
            title="Enregistrer"
            onPress={() => void commitSaveView()}
          />
          <SecondaryButton
            title="Annuler"
            onPress={() => setSaveModalOpen(false)}
          />
        </Pressable>
      </Pressable>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: screenPaddingH,
    backgroundColor: colors.canvas,
    flexGrow: 1,
  },
  intro: { marginBottom: spacing.lg },
  searchInput: {
    borderWidth: hairline,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.small,
    color: colors.text,
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
  },
  lockBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderWidth: hairline,
    borderColor: colors.borderLight,
  },
  lockBannerTxt: {
    flex: 1,
    fontSize: fontSize.small,
    fontWeight: fontWeight.medium,
    color: colors.primaryDark,
  },
  lockBannerClear: {
    fontSize: fontSize.small,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
  budgetCard: {
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  budgetCardTitle: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.semibold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  budgetLine: { gap: spacing.xs },
  budgetLineTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  budgetName: {
    flex: 1,
    fontSize: fontSize.small,
    fontWeight: fontWeight.medium,
    color: colors.text,
  },
  budgetFig: {
    fontSize: fontSize.small,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  loadMore: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  loadMoreTxt: {
    fontSize: fontSize.small,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
  typeHeading: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    fontSize: fontSize.caption,
    fontWeight: fontWeight.medium,
    color: colors.textMuted,
    letterSpacing: 0.2,
  },
  kicker: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  title: {
    marginTop: spacing.xs,
    fontSize: fontSize.display,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    letterSpacing: -0.5,
  },
  sub: {
    marginTop: spacing.sm,
    fontSize: fontSize.small,
    color: colors.textSecondary,
    lineHeight: 22,
    maxWidth: 360,
  },
  catHeading: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    fontSize: fontSize.caption,
    fontWeight: fontWeight.medium,
    color: colors.textMuted,
    letterSpacing: 0.2,
  },
  catScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.xs,
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: hairline,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    maxWidth: 200,
  },
  filterChipOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  filterText: {
    fontSize: fontSize.small,
    color: colors.textMuted,
    fontWeight: fontWeight.medium,
  },
  filterTextOn: {
    color: colors.primaryDark,
  },
  viewsHeading: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    fontSize: fontSize.caption,
    fontWeight: fontWeight.medium,
    color: colors.textMuted,
    letterSpacing: 0.2,
  },
  viewsScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.xs,
  },
  viewChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: hairline,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    maxWidth: 200,
  },
  viewChipTxt: {
    fontSize: fontSize.small,
    fontWeight: fontWeight.medium,
    color: colors.text,
  },
  viewChipAdd: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: hairline,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  viewChipAddTxt: {
    fontSize: fontSize.small,
    fontWeight: fontWeight.semibold,
    color: colors.primaryDark,
  },
  viewsHint: {
    marginTop: spacing.xs,
    fontSize: fontSize.micro,
    color: colors.textMuted,
  },
  saveModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: screenPaddingH,
  },
  saveModalCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: hairline,
    borderColor: colors.borderLight,
    gap: spacing.md,
  },
  saveModalTitle: {
    fontSize: fontSize.titleSm,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  saveModalSub: {
    fontSize: fontSize.small,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  card: { marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  mainTap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  amount: {
    fontWeight: fontWeight.semibold,
    fontSize: fontSize.titleSm,
    color: colors.text,
  },
  meta: {
    color: colors.textMuted,
    fontSize: fontSize.caption,
    marginTop: 4,
  },
  editHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  editHint: {
    fontSize: fontSize.caption,
    color: colors.primary,
    fontWeight: fontWeight.medium,
  },
  trash: { padding: spacing.sm },
});
