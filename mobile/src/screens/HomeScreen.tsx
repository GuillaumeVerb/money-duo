import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Badge,
  Card,
  PrimaryButton,
  ProgressBar,
  SectionLabel,
} from '../components/ui';
import { ProductTourModal } from '../components/ProductTourModal';
import { useAuth } from '../context/AuthContext';
import { useHousehold } from '../context/HouseholdContext';
import { trackEvent } from '../lib/analytics';
import { demoHomeCockpit, demoGoal } from '../lib/demoData';
import { isDateInRangeInclusive, monthBoundsISO } from '../lib/dates';
import { budgetLevel } from '../lib/categoryBudget';
import { formatMoney } from '../lib/format';
import { getNextGoalMilestone } from '../lib/goalMilestones';
import { monthInsight, type MonthPulse } from '../lib/homeMonthInsight';
import {
  fetchLedgerExpenseRows,
  fetchSettlementLines,
  fetchSplitsByExpenseIds,
  netBalancesFromLedger,
  pairwiseOwedForMembers,
} from '../lib/ledger';
import { monthPaidAndTheoreticalShare } from '../lib/monthSplitInsights';
import { openAddExpense } from '../navigation/openAddExpense';
import { openExpenseDetail } from '../navigation/openExpenseDetail';
import { openGoalDetail } from '../navigation/openGoalDetail';
import {
  openFinancialCharter,
  openLightSimulator,
  openMonthHistory,
  openMonthlyRecap,
} from '../navigation/openMonthlyRecap';
import { openRecurringCharges } from '../navigation/openRecurringCharges';
import type { MainTabParamList } from '../navigation/MainTabs';
import { averageRecentMonthlySpend } from '../lib/spendReference';
import type { Goal, RecurringTemplate } from '../lib/types';
import { getProductTourDone, setProductTourDone } from '../lib/localPrefs';
import { supabase } from '../lib/supabase';
import {
  screenContentPaddingTop,
  screenPaddingH,
  sectionGap,
} from '../theme/screenLayout';
import { colors, fontSize, fontWeight, hairline, radius, spacing } from '../theme/tokens';

type RecentRow = {
  id: string;
  amount: number;
  spent_at: string;
  note: string | null;
  expense_type: string;
  category_id: string | null;
  attachment_url?: string | null;
};

function pulseMeta (pulse: MonthPulse): { label: string; tone: 'success' | 'warning' | 'danger' } {
  switch (pulse) {
    case 'ok':
      return { label: 'Mois équilibré', tone: 'success' };
    case 'watch':
      return { label: 'À surveiller', tone: 'warning' };
    case 'tight':
      return { label: 'Mois tendu', tone: 'danger' };
  }
}

export function HomeScreen () {
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const { demoMode } = useAuth ();
  const { household, members, categories, categoryBudgets, refresh } =
    useHousehold();
  const [spent, setSpent] = useState (0);
  const [owed, setOwed] = useState (0);
  const [goal, setGoal] = useState<Goal | null> (null);
  const [nextCharge, setNextCharge] = useState<RecurringTemplate | null> (null);
  const [topCats, setTopCats] = useState<{ name: string; total: number }[]>([]);
  const [recent, setRecent] = useState<RecentRow[]> ([]);
  const [refSpend, setRefSpend] = useState<number | null> (null);
  const [splitPct, setSplitPct] = useState<[number, number]> ([50, 50]);
  const [showProductTour, setShowProductTour] = useState (false);
  const [budgetWatch, setBudgetWatch] = useState<
    { name: string; spent: number; cap: number }[]
  >([]);

  useEffect (() => {
    let cancelled = false;
    void (async () => {
      const done = await getProductTourDone ();
      if (!cancelled && !done) {
        setShowProductTour (true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback (async () => {
    if (!household) {
      return;
    }
    if (demoMode) {
      setSpent (demoHomeCockpit.spent);
      setOwed (
        demoHomeCockpit.owedSign === 0
          ? 0
          : demoHomeCockpit.owedSign * demoHomeCockpit.owedAbs
      );
      setTopCats (demoHomeCockpit.topCategories);
      setGoal (demoGoal);
      setNextCharge ({
        id: 'rec-demo',
        household_id: household.id,
        label: demoHomeCockpit.nextCharge.label,
        amount: demoHomeCockpit.nextCharge.amount,
        category_id: null,
        payer_member_id: null,
        expense_type: 'shared',
        cadence: 'monthly',
        next_occurrence: demoHomeCockpit.nextCharge.next,
      });
      setRecent ([]);
      setRefSpend (demoHomeCockpit.monthlyGuide);
      setSplitPct (demoHomeCockpit.splitPct);
      setBudgetWatch ([]);
      return;
    }

    const { start, end } = monthBoundsISO ();
    const catName = (id: string | null) =>
      categories.find ((c) => c.id === id)?.name ?? 'Sans catégorie';

    try {
      const allExpenses = await fetchLedgerExpenseRows (household.id);
      const monthRows = allExpenses.filter ((e) =>
        isDateInRangeInclusive (e.spent_at, start, end)
      );

      setSpent (monthRows.reduce ((s, e) => s + e.amount, 0));

      const byCatId: Record<string, number> = {};
      for (const e of monthRows) {
        if (!e.category_id) {
          continue;
        }
        byCatId[e.category_id] = (byCatId[e.category_id] ?? 0) + e.amount;
      }
      const watch: { name: string; spent: number; cap: number }[] = [];
      for (const b of categoryBudgets) {
        const spentCat = byCatId[b.category_id] ?? 0;
        const catLabel =
          categories.find ((c) => c.id === b.category_id)?.name ?? 'Catégorie';
        watch.push ({ name: catLabel, spent: spentCat, cap: b.monthly_cap });
      }
      watch.sort ((a, b) => b.spent / b.cap - a.spent / a.cap);
      setBudgetWatch (watch.filter ((w) => w.cap > 0).slice (0, 2));

      const catMap: Record<string, number> = {};
      for (const e of monthRows) {
        const key = catName (e.category_id);
        catMap[key] = (catMap[key] ?? 0) + e.amount;
      }
      const sorted = Object.entries (catMap)
        .sort ((a, b) => b[1] - a[1]);
      setTopCats (sorted.slice (0, 3).map (([name, total]) => ({ name, total })));

      const nonPersonal = allExpenses.filter ((e) => e.expense_type !== 'personal');
      const splitIds = nonPersonal.map ((e) => e.id);
      const splitsMap = await fetchSplitsByExpenseIds (splitIds);
      const settlementLines = await fetchSettlementLines (household.id);
      const nets = netBalancesFromLedger (allExpenses, splitsMap, settlementLines);
      const memberIds = members.map ((m) => m.id);
      setOwed (pairwiseOwedForMembers (memberIds, nets));

      const { paid, theoretical, monthTotal } = monthPaidAndTheoreticalShare (
        allExpenses,
        splitsMap,
        memberIds
      );
      if (monthTotal > 0 && memberIds.length >= 2) {
        const p0 = ((paid[memberIds[0]] ?? 0) / monthTotal) * 100;
        const p1 = ((paid[memberIds[1]] ?? 0) / monthTotal) * 100;
        setSplitPct ([Math.round (p0), Math.round (p1)]);
      } else {
        const t0 = theoretical[memberIds[0]] ?? 0;
        const t1 = theoretical[memberIds[1]] ?? 0;
        const tt = t0 + t1;
        if (tt > 0 && memberIds.length >= 2) {
          setSplitPct ([
            Math.round ((t0 / tt) * 100),
            Math.round ((t1 / tt) * 100),
          ]);
        } else {
          setSplitPct ([50, 50]);
        }
      }

      setRefSpend (averageRecentMonthlySpend (allExpenses, 3));

      const [{ data: goals }, { data: rec }, { data: expRecent }] = await Promise.all ([
        supabase
          .from ('goals')
          .select ('*')
          .eq ('household_id', household.id)
          .is ('archived_at', null)
          .neq('status', 'future')
          .order ('focus_on_home', { ascending: false })
          .order ('priority', { ascending: true })
          .order ('created_at', { ascending: false })
          .limit (8),
        supabase
          .from ('recurring_expense_templates')
          .select ('*')
          .eq ('household_id', household.id)
          .order ('next_occurrence', { ascending: true })
          .limit (1),
        supabase
          .from ('expenses')
          .select ('id, amount, spent_at, note, expense_type, category_id, attachment_url')
          .eq ('household_id', household.id)
          .order ('spent_at', { ascending: false })
          .limit (5),
      ]);

      const list = (goals ?? []) as Goal[];
      const focused = list.find((g) => Boolean(g.focus_on_home));
      setGoal (focused ?? list[0] ?? null);
      setNextCharge ((rec?.[0] as RecurringTemplate) ?? null);
      setRecent ((expRecent ?? []) as RecentRow[]);
    } catch {
      setSpent (0);
      setOwed (0);
      setTopCats ([]);
      setGoal (null);
      setNextCharge (null);
      setRecent ([]);
      setRefSpend (null);
      setSplitPct ([50, 50]);
      setBudgetWatch ([]);
    }
  }, [household, members, categories, demoMode]);

  useFocusEffect (
    useCallback (() => {
      void load ();
      void refresh ();
      void trackEvent ('screen_home', {});
    }, [load, refresh])
  );

  const insight = useMemo (() => {
    if (demoMode) {
      return {
        pulse: demoHomeCockpit.monthStatus as MonthPulse,
        message: demoHomeCockpit.insight,
      };
    }
    const topTotal = topCats[0]?.total ?? 0;
    const topShare =
      spent > 0 && topTotal > 0 ? topTotal / spent : undefined;
    return monthInsight ({
      spent,
      monthlyGuide: refSpend,
      owedAbs: Math.abs (owed),
      topCategoryShare: topShare,
    });
  }, [demoMode, spent, refSpend, owed, topCats]);

  const remaining =
    refSpend != null ? Math.round ((refSpend - spent) * 100) / 100 : null;

  const badge = pulseMeta (insight.pulse);

  const goalMilestone = goal ? getNextGoalMilestone (goal) : null;

  if (!household) {
    return null;
  }

  const m0 = members[0];
  const m1 = members[1];

  const owedLabel =
    members.length < 2
      ? 'Invitez un partenaire pour suivre l’équilibre.'
      : owed === 0
        ? 'À l’équilibre — rien à régulariser pour l’instant.'
        : owed > 0
          ? `${m1?.display_name ?? 'Partenaire'} peut équilibrer ${formatMoney (
              Math.abs (owed),
              household.currency
            )} avec ${m0?.display_name ?? 'toi'}.`
          : `${m0?.display_name ?? 'Toi'} peux équilibrer ${formatMoney (
              Math.abs (owed),
              household.currency
            )} avec ${m1?.display_name ?? 'ton partenaire'}.`;

  async function completeProductTour () {
    setShowProductTour (false);
    await setProductTourDone ();
    void trackEvent ('product_tour_done', {});
  }

  return (
    <>
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        { paddingTop: screenContentPaddingTop(insets.top) },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {demoMode ? (
        <View style={styles.demoBanner}>
          <Ionicons name="eye-outline" size={18} color={colors.primary} />
          <Text style={styles.demoBannerText}>
            Mode aperçu — données fictives, rien n’est enregistré.
          </Text>
        </View>
      ) : null}

      <View style={styles.head}>
        <Text style={styles.kicker}>Cockpit du foyer</Text>
        <Text style={styles.screenTitle}>Ce mois-ci</Text>
        <Text style={styles.subHead}>
          Vue calme de vos dépenses communes et de l’équilibre.
        </Text>
        <Pressable
          style={styles.recapRow}
          onPress={() => openMonthlyRecap(navigation)}
          hitSlop={8}
        >
          <Ionicons name="bar-chart-outline" size={18} color={colors.primary} />
          <Text style={styles.recapLink}>Récap du mois</Text>
        </Pressable>
        <View style={styles.quickLinks}>
          <Pressable
            style={styles.quickChip}
            onPress={() => openMonthHistory(navigation)}
            hitSlop={6}
          >
            <Text style={styles.quickChipTxt}>Historique</Text>
          </Pressable>
          <Pressable
            style={styles.quickChip}
            onPress={() => openFinancialCharter(navigation)}
            hitSlop={6}
          >
            <Text style={styles.quickChipTxt}>Contrat léger</Text>
          </Pressable>
          <Pressable
            style={styles.quickChip}
            onPress={() => openLightSimulator(navigation)}
            hitSlop={6}
          >
            <Text style={styles.quickChipTxt}>Simuler</Text>
          </Pressable>
        </View>
      </View>

      <Card style={styles.hero}>
        <View style={styles.heroTop}>
          <Badge label={badge.label} tone={badge.tone} />
          <Text style={styles.heroInsight}>{insight.message}</Text>
        </View>

        <Text style={styles.heroAmount}>
          {formatMoney (spent, household.currency)}
        </Text>
        <Text style={styles.heroLabel}>Dépensé en tout (mois en cours)</Text>

        {household.monthly_budget_cap != null &&
        household.monthly_budget_cap > 0 ? (
          <View
            style={styles.globalBudget}
            accessibilityLabel={`Budget global du mois : ${Math.round(
              (spent / household.monthly_budget_cap) * 100
            )} pour cent utilisés`}
          >
            <View style={styles.globalBudgetTop}>
              <Text style={styles.globalBudgetLabel}>Budget global</Text>
              <Text
                style={[
                  styles.globalBudgetFig,
                  budgetLevel(spent, household.monthly_budget_cap) === 'over' && {
                    color: colors.danger,
                  },
                  budgetLevel(spent, household.monthly_budget_cap) === 'warn' && {
                    color: colors.accentWarm,
                  },
                ]}
              >
                {formatMoney(spent, household.currency)} /{' '}
                {formatMoney(
                  household.monthly_budget_cap,
                  household.currency
                )}
              </Text>
            </View>
            <ProgressBar
              progress={Math.min(1, spent / household.monthly_budget_cap)}
              height={6}
              fillColor={
                budgetLevel(spent, household.monthly_budget_cap) === 'over'
                  ? colors.danger
                  : budgetLevel(spent, household.monthly_budget_cap) === 'warn'
                    ? colors.accentWarm
                    : colors.primary
              }
            />
          </View>
        ) : null}

        <View style={styles.statGrid}>
          <View style={styles.statCell}>
            <Text style={styles.statLabel}>Repère doux</Text>
            <Text style={styles.statValue}>
              {refSpend != null
                ? formatMoney (refSpend, household.currency)
                : '—'}
            </Text>
            <Text style={styles.statHint}>Moyenne sur les derniers mois</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCell}>
            <Text style={styles.statLabel}>Marge estimée</Text>
            <Text
              style={[
                styles.statValue,
                remaining != null && remaining < 0 && { color: colors.accentWarm },
              ]}
            >
              {remaining != null
                ? formatMoney (remaining, household.currency)
                : '—'}
            </Text>
            <Text style={styles.statHint}>Repère − dépensé</Text>
          </View>
        </View>

        <View style={styles.owedBlock}>
          <View style={styles.owedRow}>
            <Ionicons
              name="scale-outline"
              size={20}
              color={colors.accentWarm}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.owedTitle}>Écart à régulariser</Text>
              <Text style={styles.owedBody}>{owedLabel}</Text>
            </View>
            <Text style={styles.owedAmt}>
              {formatMoney (Math.abs (owed), household.currency)}
            </Text>
          </View>
        </View>

        <PrimaryButton
          title="Ajouter une dépense"
          onPress={() => openAddExpense (navigation)}
        />
      </Card>

      {budgetWatch.length > 0 ? (
        <Card variant="soft" density="compact" style={styles.budgetWatchCard}>
          <Text style={styles.budgetWatchTitle}>Suivi budgets (mois en cours)</Text>
          {budgetWatch.map((w) => (
            <View key={w.name} style={styles.budgetWatchRow}>
              <Text style={styles.budgetWatchName}>{w.name}</Text>
              <Text style={styles.budgetWatchFig}>
                {formatMoney(w.spent, household.currency)} /{' '}
                {formatMoney(w.cap, household.currency)}
              </Text>
            </View>
          ))}
          <Text style={styles.budgetWatchHint}>
            Détail dans Réglages → Budgets par catégorie.
          </Text>
        </Card>
      ) : null}

      {goal ? (
        <View style={styles.block}>
          <SectionLabel
            title="Objectif en cours"
            subtitle="Progression commune, sans jugement — juste une direction."
          />
          <Pressable
            onPress={() => openGoalDetail (navigation, goal.id, goal)}
            style={({ pressed }) => [pressed && { opacity: 0.92 }]}
          >
            <Card>
              <Text style={styles.goalName}>{goal.name}</Text>
              <ProgressBar
                progress={
                  Number (goal.target_amount) > 0
                    ? Math.min (
                        1,
                        Number (goal.current_amount) / Number (goal.target_amount)
                      )
                    : 0
                }
              />
              {goalMilestone ? (
                <Text style={styles.goalMilestone}>
                  Prochain repère ~{goalMilestone.percent}% — encore{' '}
                  {formatMoney (
                    goalMilestone.amountToNext,
                    household.currency
                  )}{' '}
                  (ordre de grandeur).
                </Text>
              ) : Number (goal.current_amount) >= Number (goal.target_amount) &&
                Number (goal.target_amount) > 0 ? (
                <Text style={styles.goalMilestone}>Cible atteinte.</Text>
              ) : null}
              <View style={styles.goalRow}>
                <Text style={styles.goalFig}>
                  {formatMoney (Number (goal.current_amount), household.currency)}
                </Text>
                <Text style={styles.goalSep}>/</Text>
                <Text style={styles.goalFigMuted}>
                  {formatMoney (Number (goal.target_amount), household.currency)}
                </Text>
              </View>
              <View style={styles.goalMetaRow}>
                <Badge
                  label={
                    goal.project_type === 'household'
                      ? 'Foyer'
                      : goal.project_type === 'child'
                        ? 'Enfant'
                        : goal.project_type === 'personal_visible'
                          ? 'Perso visible'
                          : 'Commun'
                  }
                  tone="neutral"
                />
                {goal.horizon ? (
                  <Text style={styles.goalMetaText}>
                    {goal.horizon === 'this_month'
                      ? 'Ce mois-ci'
                      : goal.horizon === 'this_quarter'
                        ? 'Ce trimestre'
                        : goal.horizon === 'this_year'
                          ? 'Cette annee'
                          : 'Plus tard'}
                  </Text>
                ) : null}
              </View>
              {goal.next_step?.trim() ? (
                <Text style={styles.goalNextStep}>Prochaine etape: {goal.next_step.trim()}</Text>
              ) : null}
              <View style={styles.linkRow}>
                <Text style={styles.linkText}>Fiche objectif</Text>
                <Ionicons name="arrow-forward" size={16} color={colors.primary} />
              </View>
            </Card>
          </Pressable>
          <Pressable
            style={styles.goalSecondaryLink}
            onPress={() => navigation.navigate ('Goals')}
            hitSlop={8}
          >
            <Text style={styles.goalSecondaryLinkTxt}>Tous les objectifs</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.block}>
          <SectionLabel
            title="Objectif en cours"
            subtitle="Fixez un premier cap à atteindre ensemble."
          />
          <Card variant="soft" padded>
            <Text style={styles.emptySoft}>
              Aucun objectif pour l’instant — créez-en un pour donner du sens à
              l’épargne commune.
            </Text>
            <PrimaryButton
              title="Créer un objectif"
              variant="outlineWarm"
              onPress={() => navigation.navigate ('Goals')}
            />
          </Card>
        </View>
      )}

      {nextCharge ? (
        <View style={styles.block}>
          <SectionLabel
            title="Prochaine charge récurrente"
            subtitle="Anticipation plutôt que surprise."
          />
          <Card>
            <View style={styles.recRow}>
              <View style={styles.recIcon}>
                <Ionicons name="repeat" size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.recTitle}>{nextCharge.label}</Text>
                <Text style={styles.recMeta}>
                  Échéance {nextCharge.next_occurrence}
                </Text>
              </View>
              <Text style={styles.recAmt}>
                {formatMoney (Number (nextCharge.amount), household.currency)}
              </Text>
            </View>
            {!demoMode ? (
              <Pressable
                style={styles.recManage}
                onPress={() => openRecurringCharges (navigation)}
                hitSlop={8}
              >
                <Text style={styles.recManageTxt}>
                  Gérer toutes les charges récurrentes
                </Text>
                <Ionicons name="chevron-forward" size={16} color={colors.primary} />
              </Pressable>
            ) : null}
          </Card>
        </View>
      ) : null}

      <View style={styles.block}>
        <SectionLabel
          title="Dernières dépenses"
          subtitle="Les mouvements récents du foyer."
          action={
            <Pressable onPress={() => navigation.navigate ('Expenses')}>
              <Text style={styles.seeAll}>Tout voir</Text>
            </Pressable>
          }
        />
        {recent.length === 0 && demoMode ? (
          <Card>
            {demoHomeCockpit.recentExpenses.map ((r, i) => (
              <View
                key={`${r.label}-${i}`}
                style={[
                  styles.expRow,
                  i < demoHomeCockpit.recentExpenses.length - 1 && styles.expBorder,
                ]}
              >
                <View>
                  <Text style={styles.expTitle}>{r.label}</Text>
                  <Text style={styles.expMeta}>
                    {r.day} · {r.cat}
                  </Text>
                </View>
                <Text style={styles.expAmt}>
                  {formatMoney (r.amount, household.currency)}
                </Text>
              </View>
            ))}
          </Card>
        ) : recent.length ? (
          <Card>
            {recent.map ((r, i) => (
              <Pressable
                key={r.id}
                onPress={() => openExpenseDetail (navigation, r.id)}
                style={({ pressed }) => [
                  styles.expRow,
                  i < recent.length - 1 && styles.expBorder,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <View style={styles.expTitleRow}>
                    {r.attachment_url ? (
                      <Ionicons
                        name="attach-outline"
                        size={16}
                        color={colors.textMuted}
                        style={{ marginRight: 6 }}
                      />
                    ) : null}
                    <Text style={styles.expTitle} numberOfLines={1}>
                      {r.note?.trim () || 'Dépense'}
                    </Text>
                  </View>
                  <Text style={styles.expMeta}>
                    {r.spent_at} ·{' '}
                    {categories.find ((c) => c.id === r.category_id)?.name ??
                      'Sans catégorie'}
                  </Text>
                </View>
                <Text style={styles.expAmt}>
                  {formatMoney (Number (r.amount), household.currency)}
                </Text>
              </Pressable>
            ))}
          </Card>
        ) : (
          <Card variant="outline" padded>
            <Text style={styles.emptySoft}>
              Ajoutez une dépense pour voir l’historique ici — le cockpit se
              remplit tout seul.
            </Text>
            <PrimaryButton
              title="Ajouter une dépense"
              onPress={() => openAddExpense (navigation)}
            />
          </Card>
        )}
      </View>

      {members.length >= 2 ? (
        <View style={styles.block}>
          <SectionLabel
            title="Aperçu de la répartition"
            subtitle="Part des débours ce mois (hors dépenses perso)."
          />
          <Card>
            <View style={styles.splitBar}>
              <View
                style={[
                  styles.splitSeg,
                  {
                    flex: splitPct[0],
                    backgroundColor: colors.primary,
                  },
                ]}
              />
              <View
                style={[
                  styles.splitSeg,
                  {
                    flex: splitPct[1],
                    backgroundColor: colors.accentSand,
                  },
                ]}
              />
            </View>
            <View style={styles.splitLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.dot, { backgroundColor: colors.primary }]} />
                <Text style={styles.legendText}>
                  {m0?.display_name ?? 'Membre 1'} · {splitPct[0]}%
                </Text>
              </View>
              <View style={styles.legendItem}>
                <View
                  style={[styles.dot, { backgroundColor: colors.accentSand }]}
                />
                <Text style={styles.legendText}>
                  {m1?.display_name ?? 'Membre 2'} · {splitPct[1]}%
                </Text>
              </View>
            </View>
            <Pressable
              style={styles.linkRow}
              onPress={() => navigation.navigate ('Split')}
            >
              <Text style={styles.linkText}>Détail répartition & soldes</Text>
              <Ionicons name="arrow-forward" size={16} color={colors.primary} />
            </Pressable>
          </Card>
        </View>
      ) : null}

      {topCats.length ? (
        <View style={styles.block}>
          <SectionLabel
            title="Où part l’argent"
            subtitle="Top catégories du mois."
          />
          <Card>
            {topCats.map ((c, i) => (
              <View
                key={c.name}
                style={[styles.catRow, i < topCats.length - 1 && styles.expBorder]}
              >
                <Text style={styles.catName}>{c.name}</Text>
                <Text style={styles.catAmt}>
                  {formatMoney (c.total, household.currency)}
                </Text>
              </View>
            ))}
          </Card>
        </View>
      ) : null}

      <View style={{ height: spacing.xxl }} />
    </ScrollView>
    <ProductTourModal
      visible={showProductTour}
      onClose={() => void completeProductTour ()}
    />
    </>
  );
}

const styles = StyleSheet.create ({
  root: { flex: 1, backgroundColor: colors.canvas },
  content: {
    paddingHorizontal: screenPaddingH,
    paddingBottom: spacing.xxl + 24,
  },
  demoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderWidth: hairline,
    borderColor: colors.borderLight,
  },
  demoBannerText: {
    flex: 1,
    fontSize: fontSize.small,
    color: colors.primaryDark,
    lineHeight: 20,
  },
  head: { marginBottom: spacing.md },
  kicker: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  screenTitle: {
    marginTop: spacing.xs,
    fontSize: fontSize.display,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    letterSpacing: -0.8,
  },
  subHead: {
    marginTop: spacing.sm,
    fontSize: fontSize.small,
    color: colors.textSecondary,
    lineHeight: 22,
    maxWidth: 340,
  },
  recapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    alignSelf: 'flex-start',
  },
  recapLink: {
    fontSize: fontSize.small,
    fontWeight: fontWeight.medium,
    color: colors.primary,
  },
  quickLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  quickChip: {
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
  },
  quickChipTxt: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.semibold,
    color: colors.primaryDark,
  },
  budgetWatchCard: {
    marginBottom: spacing.md,
    paddingVertical: spacing.sm,
  },
  budgetWatchTitle: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  budgetWatchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  budgetWatchName: { fontSize: fontSize.small, color: colors.text },
  budgetWatchFig: {
    fontSize: fontSize.small,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  budgetWatchHint: {
    fontSize: fontSize.micro,
    color: colors.textMuted,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
  },
  hero: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  heroTop: { marginBottom: spacing.sm },
  heroInsight: {
    marginTop: spacing.sm,
    fontSize: fontSize.small,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  heroAmount: {
    fontSize: fontSize.hero,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    letterSpacing: -1.2,
  },
  heroLabel: {
    marginTop: spacing.xs,
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
  globalBudget: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  globalBudgetTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  globalBudgetLabel: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  globalBudgetFig: {
    fontSize: fontSize.small,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  statGrid: {
    flexDirection: 'row',
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  statCell: { flex: 1 },
  statDivider: {
    width: 1,
    backgroundColor: colors.borderLight,
    marginHorizontal: spacing.md,
  },
  statLabel: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
    fontWeight: fontWeight.medium,
  },
  statValue: {
    marginTop: spacing.xs,
    fontSize: fontSize.title,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  statHint: {
    marginTop: 4,
    fontSize: fontSize.micro,
    color: colors.textMuted,
  },
  owedBlock: {
    backgroundColor: colors.sandSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  owedRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  owedTitle: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  owedBody: {
    marginTop: 4,
    fontSize: fontSize.small,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  owedAmt: {
    fontSize: fontSize.titleSm,
    fontWeight: fontWeight.semibold,
    color: colors.accentWarm,
  },
  block: { marginBottom: sectionGap },
  goalName: {
    fontSize: fontSize.titleSm,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  goalFig: { fontSize: fontSize.titleSm, fontWeight: fontWeight.semibold, color: colors.text },
  goalSep: { color: colors.textMuted, fontSize: fontSize.small },
  goalFigMuted: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
  },
  goalMilestone: {
    marginTop: spacing.sm,
    fontSize: fontSize.small,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  goalSecondaryLink: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    paddingVertical: spacing.xs,
  },
  goalSecondaryLinkTxt: {
    fontSize: fontSize.small,
    fontWeight: fontWeight.medium,
    color: colors.textMuted,
  },
  goalMetaRow: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  goalMetaText: {
    fontSize: fontSize.caption,
    color: colors.textSecondary,
  },
  goalNextStep: {
    marginTop: spacing.xs,
    fontSize: fontSize.small,
    color: colors.textSecondary,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: hairline,
    borderTopColor: colors.borderLight,
  },
  linkText: {
    fontSize: fontSize.small,
    fontWeight: fontWeight.medium,
    color: colors.primary,
  },
  seeAll: {
    fontSize: fontSize.small,
    fontWeight: fontWeight.medium,
    color: colors.primary,
  },
  recRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  recIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recTitle: { fontSize: fontSize.body, fontWeight: fontWeight.medium, color: colors.text },
  recMeta: { marginTop: 4, fontSize: fontSize.caption, color: colors.textMuted },
  recAmt: { fontSize: fontSize.titleSm, fontWeight: fontWeight.semibold, color: colors.text },
  recManage: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: hairline,
    borderTopColor: colors.borderLight,
  },
  recManageTxt: {
    fontSize: fontSize.small,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
  expRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  expBorder: {
    borderBottomWidth: hairline,
    borderBottomColor: colors.borderLight,
  },
  expTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  expTitle: { fontSize: fontSize.body, fontWeight: fontWeight.medium, color: colors.text, flex: 1 },
  expMeta: { marginTop: 4, fontSize: fontSize.caption, color: colors.textMuted },
  expAmt: { fontSize: fontSize.body, fontWeight: fontWeight.semibold, color: colors.text },
  splitBar: {
    flexDirection: 'row',
    height: 8,
    borderRadius: radius.full,
    overflow: 'hidden',
    backgroundColor: colors.borderLight,
  },
  splitSeg: { minWidth: 4 },
  splitLegend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: fontSize.caption, color: colors.textSecondary },
  catRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  catName: { fontSize: fontSize.body, color: colors.text },
  catAmt: { fontSize: fontSize.body, fontWeight: fontWeight.medium, color: colors.text },
  emptySoft: {
    fontSize: fontSize.small,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
});
