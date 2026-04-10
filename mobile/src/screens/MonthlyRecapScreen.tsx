import {
  useFocusEffect,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Card,
  DateInputField,
  InputField,
  MonthInputField,
  PrimaryButton,
  SecondaryButton,
  SectionLabel,
} from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useHousehold } from '../context/HouseholdContext';
import { demoHomeCockpit } from '../lib/demoData';
import {
  formatMonthHeading,
  isDateInRangeInclusive,
  monthBoundsISO,
  monthKeyFromDate,
  parseMonthKeyToDate,
} from '../lib/dates';
import { formatMoney } from '../lib/format';
import { buildMonthRecapShareText } from '../lib/monthRecapShare';
import { buildGuidedRecapLines } from '../lib/monthRecapGuided';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { supabase } from '../lib/supabase';
import type { DecisionNote, ExpenseType } from '../lib/types';
import { screenPaddingH } from '../theme/screenLayout';
import { colors, fontSize, fontWeight, hairline, radius, spacing } from '../theme/tokens';

const NativeDateTimePicker =
  Platform.OS === 'web'
    ? null
    : (require('@react-native-community/datetimepicker').default as React.ComponentType<any>);

const TYPE_LABEL: Record<ExpenseType, string> = {
  shared: 'Commun',
  personal: 'Perso',
  child: 'Enfant',
  home: 'Maison',
};

export function MonthlyRecapScreen () {
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'MonthlyRecap'>>();
  const { demoMode } = useAuth();
  const { showToast } = useToast();
  const { household, categories } = useHousehold();
  const [spent, setSpent] = useState (0);
  const [count, setCount] = useState (0);
  const [topCats, setTopCats] = useState<{ name: string; total: number }[]>([]);
  const [byType, setByType] = useState<Record<ExpenseType, number>> ({
    shared: 0,
    personal: 0,
    child: 0,
    home: 0,
  });
  const [loading, setLoading] = useState (true);
  const [refMonth, setRefMonth] = useState (() => {
    const d = new Date ();
    d.setDate (1);
    d.setHours (12, 0, 0, 0);
    return d;
  });
  const [monthPickOpen, setMonthPickOpen] = useState (false);
  const [webMonthKey, setWebMonthKey] = useState ('');
  const [decisionBody, setDecisionBody] = useState ('');
  const [decisionRemind, setDecisionRemind] = useState ('');
  const [noteSaving, setNoteSaving] = useState (false);
  const [ritualOpen, setRitualOpen] = useState (false);
  const [ritualStep, setRitualStep] = useState (0);
  const [spentPrevMonth, setSpentPrevMonth] = useState<number | null>(null);
  const [topPrevMonth, setTopPrevMonth] = useState<{ name: string; total: number }[]>(
    []
  );
  const [sharedShare, setSharedShare] = useState<number | null>(null);
  const [goalProgress, setGoalProgress] = useState<number | null>(null);
  const [pointTick, setPointTick] = useState<[boolean, boolean, boolean]>([
    false,
    false,
    false,
  ]);

  useFocusEffect(
    useCallback(() => {
      const k = route.params?.initialMonthKey;
      if (!k) {
        return;
      }
      const d = parseMonthKeyToDate(k);
      if (d) {
        setRefMonth(d);
      }
      navigation.setParams({ initialMonthKey: undefined });
    }, [navigation, route.params?.initialMonthKey])
  );

  const monthLabel = useMemo (
    () => formatMonthHeading (refMonth),
    [refMonth]
  );

  const monthKey = useMemo (() => monthKeyFromDate (refMonth), [refMonth]);

  useEffect (() => {
    if (!household || demoMode) {
      setDecisionBody ('');
      setDecisionRemind ('');
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from ('decision_notes')
        .select ('*')
        .eq ('household_id', household.id)
        .eq ('month', monthKey)
        .maybeSingle ();
      if (cancelled) {
        return;
      }
      if (error || !data) {
        setDecisionBody ('');
        setDecisionRemind ('');
        return;
      }
      const row = data as DecisionNote;
      setDecisionBody (row.body);
      setDecisionRemind (row.remind_at?.slice (0, 10) ?? '');
    }) ();
    return () => {
      cancelled = true;
    };
  }, [household?.id, monthKey, demoMode]);

  const load = useCallback (async () => {
    if (!household) {
      return;
    }
    if (demoMode) {
      setSpent (demoHomeCockpit.spent);
      setCount (12);
      setTopCats (demoHomeCockpit.topCategories);
      setByType ({
        shared: demoHomeCockpit.spent * 0.72,
        personal: demoHomeCockpit.spent * 0.18,
        child: demoHomeCockpit.spent * 0.05,
        home: demoHomeCockpit.spent * 0.05,
      });
      setSpentPrevMonth (Math.round (demoHomeCockpit.spent * 0.94));
      setTopPrevMonth (demoHomeCockpit.topCategories.slice (0, 3));
      setSharedShare (0.72);
      setGoalProgress (0.48);
      setLoading (false);
      return;
    }
    setLoading (true);
    const { start, end } = monthBoundsISO (refMonth);
    const catName = (id: string | null) =>
      categories.find ((c) => c.id === id)?.name ?? 'Sans catégorie';

    const { data, error } = await supabase
      .from ('expenses')
      .select ('amount, expense_type, category_id, spent_at')
      .eq ('household_id', household.id);

    if (error || !data) {
      setSpent (0);
      setCount (0);
      setTopCats ([]);
      setByType ({
        shared: 0,
        personal: 0,
        child: 0,
        home: 0,
      });
      setSpentPrevMonth (null);
      setTopPrevMonth ([]);
      setSharedShare (null);
      setGoalProgress (null);
      setLoading (false);
      return;
    }

    const rows = data as {
      amount: number;
      expense_type: string;
      category_id: string | null;
      spent_at: string;
    }[];

    const monthRows = rows.filter ((e) =>
      isDateInRangeInclusive (e.spent_at, start, end)
    );

    const prevRef = new Date (refMonth);
    prevRef.setMonth (prevRef.getMonth () - 1);
    const { start: ps, end: pe } = monthBoundsISO (prevRef);
    const prevRows = rows.filter ((e) =>
      isDateInRangeInclusive (e.spent_at, ps, pe)
    );
    setSpentPrevMonth (
      prevRows.reduce ((s, e) => s + Number (e.amount), 0)
    );
    const prevCat: Record<string, number> = {};
    for (const e of prevRows) {
      const key = catName (e.category_id);
      prevCat[key] = (prevCat[key] ?? 0) + Number (e.amount);
    }
    setTopPrevMonth (
      Object.entries (prevCat)
        .sort ((a, b) => b[1] - a[1])
        .slice (0, 6)
        .map (([name, total]) => ({ name, total }))
    );

    setCount (monthRows.length);
    setSpent (monthRows.reduce ((s, e) => s + Number (e.amount), 0));

    const catMap: Record<string, number> = {};
    const typeAcc: Record<ExpenseType, number> = {
      shared: 0,
      personal: 0,
      child: 0,
      home: 0,
    };
    for (const e of monthRows) {
      const key = catName (e.category_id);
      catMap[key] = (catMap[key] ?? 0) + Number (e.amount);
      const t = e.expense_type as ExpenseType;
      if (t in typeAcc) {
        typeAcc[t] += Number (e.amount);
      }
    }
    const sorted = Object.entries (catMap)
      .sort ((a, b) => b[1] - a[1])
      .slice (0, 6)
      .map (([name, total]) => ({ name, total }));
    setTopCats (sorted);
    setByType (typeAcc);
    const tot = monthRows.reduce ((s, e) => s + Number (e.amount), 0);
    setSharedShare (tot > 0 ? typeAcc.shared / tot : null);

    const { data: gRow } = await supabase
      .from ('goals')
      .select ('current_amount, target_amount')
      .eq ('household_id', household.id)
      .is ('archived_at', null)
      .neq('status', 'future')
      .order ('created_at', { ascending: false })
      .limit (1)
      .maybeSingle ();
    if (gRow && Number (gRow.target_amount) > 0) {
      setGoalProgress (
        Number (gRow.current_amount) / Number (gRow.target_amount)
      );
    } else {
      setGoalProgress (null);
    }

    setLoading (false);
  }, [household, categories, demoMode, refMonth]);

  useEffect (() => {
    void load ();
  }, [load]);

  function openExpenseListForMonth () {
    navigation.navigate ('Main', {
      screen: 'Expenses',
      params: {
        monthKey: monthKeyFromDate (refMonth),
      },
    });
  }

  function shiftMonth (delta: number) {
    setRefMonth ((d) =>
      new Date (d.getFullYear (), d.getMonth () + delta, 1, 12, 0, 0, 0)
    );
  }

  function openMonthPicker () {
    setWebMonthKey (monthKeyFromDate (refMonth));
    setMonthPickOpen (true);
  }

  function applyWebMonth () {
    const d = parseMonthKeyToDate (webMonthKey);
    if (!d) {
      Alert.alert ('Mois', 'Utilise le format AAAA-MM (ex. 2026-03).');
      return;
    }
    setRefMonth (d);
    setMonthPickOpen (false);
  }

  async function saveDecisionNote () {
    if (demoMode || !household) {
      Alert.alert (
        'Mode aperçu',
        'Connectez-vous pour enregistrer une note de décision.'
      );
      return;
    }
    setNoteSaving (true);
    try {
      const remind =
        decisionRemind.trim ().length >= 8
          ? decisionRemind.trim ().slice (0, 10)
          : null;
      const { error } = await supabase.from ('decision_notes').upsert (
        {
          household_id: household.id,
          month: monthKey,
          body: decisionBody.trim (),
          remind_at: remind,
        },
        { onConflict: 'household_id,month' }
      );
      if (error) {
        Alert.alert ('Erreur', error.message);
        return;
      }
      showToast ('Mémo du mois enregistré', 'success');
      if (Platform.OS !== 'web') {
        const { syncDecisionMemoReminder } = await import(
          '../lib/decisionMemoReminder'
        );
        const remindResult = await syncDecisionMemoReminder ({
          householdId: household.id,
          monthKey,
          monthLabel,
          remindAtYmd: remind,
        });
        if (!remindResult.ok && remindResult.message) {
          showToast (remindResult.message, 'neutral');
        }
      }
    } finally {
      setNoteSaving (false);
    }
  }

  function recapShareMessage (): string {
    if (!household) {
      return '';
    }
    return buildMonthRecapShareText ({
      monthLabel,
      currency: household.currency,
      spent,
      count,
      topCats,
      byType,
    });
  }

  async function copyRecapToClipboard () {
    if (!household) {
      return;
    }
    const message = recapShareMessage ();
    if (!message) {
      return;
    }
    try {
      await Clipboard.setStringAsync (message);
      showToast ('Récap copié dans le presse-papiers', 'success');
    } catch {
      showToast ('Impossible de copier le récap', 'neutral');
    }
  }

  async function shareRecap () {
    if (!household) {
      return;
    }
    const message = recapShareMessage ();
    try {
      await Share.share ({
        message,
        title: 'Récap Money Duo',
      });
    } catch {
      /* partage annulé */
    }
  }

  const guidedLines = useMemo (
    () =>
      household
        ? buildGuidedRecapLines ({
            currency: household.currency,
            spentThisMonth: spent,
            spentPrevMonth,
            topThis: topCats,
            topPrev: topPrevMonth,
            sharedShare,
            goalProgress,
            monthlyBudgetCap: household.monthly_budget_cap ?? null,
          })
        : [],
    [
      household,
      spent,
      spentPrevMonth,
      topCats,
      topPrevMonth,
      sharedShare,
      goalProgress,
    ]
  );

  const typeRows = (
    ['shared', 'personal', 'child', 'home'] as ExpenseType[]
  ).filter ((k) => byType[k] > 0);

  if (!household) {
    return (
      <View style={styles.loading}>
        <Text style={styles.emptySoft}>
          Foyer introuvable pour le récap. Reviens à l’accueil puis réessaie.
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  function togglePoint (i: 0 | 1 | 2) {
    setPointTick ((t) => {
      const n: [boolean, boolean, boolean] = [...t];
      n[i] = !n[i];
      return n;
    });
  }

  return (
    <>
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + spacing.md,
          paddingBottom: insets.bottom + spacing.xxl,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.intro}>
        <Text style={styles.kicker}>Synthèse</Text>
        <View style={styles.monthNav}>
          <Pressable
            onPress={() => shiftMonth (-1)}
            hitSlop={12}
            accessibilityLabel="Mois précédent"
          >
            <Ionicons name="chevron-back" size={26} color={colors.primary} />
          </Pressable>
          <Pressable
            onPress={openMonthPicker}
            hitSlop={12}
            style={styles.monthLineWrap}
            accessibilityLabel="Choisir un mois"
            accessibilityRole="button"
          >
            <Text style={styles.monthLine}>{monthLabel}</Text>
            <Text style={styles.monthLineHint}>Choisir le mois</Text>
          </Pressable>
          <Pressable
            onPress={() => shiftMonth (1)}
            hitSlop={12}
            accessibilityLabel="Mois suivant"
          >
            <Ionicons name="chevron-forward" size={26} color={colors.primary} />
          </Pressable>
        </View>
        {!demoMode ? (
          <Pressable
            onPress={() => navigation.navigate('DecisionMemoHistory')}
            style={styles.memoHistRow}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Ouvrir l’historique des mémos du foyer"
          >
            <Ionicons name="chatbubbles-outline" size={18} color={colors.primary} />
            <Text style={styles.memoHistTxt}>Historique des mémos du foyer</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.primary} />
          </Pressable>
        ) : null}
      </View>

      {demoMode ? (
        <View style={styles.demoBanner}>
          <Ionicons name="eye-outline" size={18} color={colors.primary} />
          <Text style={styles.demoBannerText}>
            Aperçu — montants indicatifs pour la démo.
          </Text>
        </View>
      ) : null}

      <Card style={styles.hero}>
        <Text style={styles.heroLabel}>Total dépensé</Text>
        <Text style={styles.heroAmount}>
          {formatMoney (spent, household.currency)}
        </Text>
        <Text style={styles.heroHint}>
          {count} mouvement{count > 1 ? 's' : ''} sur la période
        </Text>
      </Card>

      <View style={styles.block}>
        <SectionLabel
          title="Regard guidé"
          subtitle="Quelques repères pour en parler tranquillement à deux."
        />
        <Card variant="soft" padded style={styles.guidedCard}>
          {guidedLines.map ((line, idx) => (
            <Text
              key={idx}
              style={[
                styles.guidedLine,
                idx < guidedLines.length - 1 && styles.guidedLineGap,
              ]}
            >
              {line}
            </Text>
          ))}
        </Card>
      </View>

      <View style={styles.block}>
        <SectionLabel
          title="Point du mois"
          subtitle="Cochez ce qui vous correspond — rien n’est enregistré, c’est pour vous."
        />
        <Card variant="outline" padded style={styles.pointCard}>
          {(
            [
              ['On a fait un point ensemble sur le budget', 0],
              ['On a noté une intention pour le mois prochain', 1],
              ['On a ajusté au moins un réglage (budget, objectif, règle…)', 2],
            ] as const
          ).map(([label, i]) => (
            <Pressable
              key={label}
              style={styles.pointRow}
              onPress={() => togglePoint (i)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: pointTick[i] }}
            >
              <Ionicons
                name={pointTick[i] ? 'checkbox' : 'square-outline'}
                size={22}
                color={pointTick[i] ? colors.primary : colors.textMuted}
              />
              <Text style={styles.pointLabel}>{label}</Text>
            </Pressable>
          ))}
        </Card>
      </View>

      {topCats.length ? (
        <View style={styles.block}>
          <SectionLabel
            title="Par catégorie"
            subtitle="Où est allé l’argent ce mois-ci."
          />
          <Card>
            {topCats.map ((c, i) => (
              <View
                key={c.name}
                style={[styles.row, i < topCats.length - 1 && styles.rowBorder]}
              >
                <Text style={styles.rowName}>{c.name}</Text>
                <Text style={styles.rowAmt}>
                  {formatMoney (c.total, household.currency)}
                </Text>
              </View>
            ))}
          </Card>
        </View>
      ) : (
        <Card variant="soft" padded style={styles.block}>
          <Text style={styles.emptySoft}>
            Aucune dépense enregistrée ce mois-ci — ajoutez-en depuis l’accueil
            ou la liste.
          </Text>
        </Card>
      )}

      {typeRows.length ? (
        <View style={styles.block}>
          <SectionLabel
            title="Par type"
            subtitle="Commun, perso, enfants, maison."
          />
          <Card>
            {typeRows.map ((k, i) => (
              <View
                key={k}
                style={[
                  styles.row,
                  i < typeRows.length - 1 && styles.rowBorder,
                ]}
              >
                <Text style={styles.rowName}>{TYPE_LABEL[k]}</Text>
                <Text style={styles.rowAmt}>
                  {formatMoney (byType[k], household.currency)}
                </Text>
              </View>
            ))}
          </Card>
        </View>
      ) : null}

      {!demoMode ? (
        <View style={styles.block}>
          <SectionLabel
            title="Mémo du mois"
            subtitle="Ce qu’on s’est dit ou qu’on veut se rappeler — sans jugement."
          />
          <Card>
            <InputField
              label="Note (pour vous deux)"
              value={decisionBody}
              onChangeText={setDecisionBody}
              placeholder="Ex. on garde ce rythme pour les courses…"
              multiline
              style={styles.decisionInput}
            />
            <DateInputField
              label="Se reparler le (optionnel)"
              value={decisionRemind}
              onChangeText={setDecisionRemind}
              placeholder="AAAA-MM-JJ"
            />
            {Platform.OS !== 'web' ? (
              <Text style={styles.remindHint}>
                Si tu indiques une date future, une notification locale te rappellera
                ce jour à l’heure définie dans Réglages → Préférences (après
                enregistrement du mémo).
              </Text>
            ) : null}
            <PrimaryButton
              title={
                noteSaving ? 'Enregistrement…' : 'Enregistrer le mémo'
              }
              onPress={() => void saveDecisionNote ()}
            />
          </Card>
        </View>
      ) : (
        <Card variant="soft" padded style={styles.block}>
          <Text style={styles.demoMemoText}>
            Mémo du mois et enregistrement — disponibles hors mode aperçu.
          </Text>
        </Card>
      )}

      <View style={styles.recapActions}>
        <SecondaryButton
          title="Partager ce récap (texte)"
          onPress={() => void shareRecap ()}
        />
        <SecondaryButton
          title="Copier le récap"
          onPress={() => void copyRecapToClipboard ()}
        />
      </View>
      <View style={styles.btnSpaced}>
        <SecondaryButton
          title="Petit rituel du mois"
          onPress={() => {
            setRitualStep (0);
            setRitualOpen (true);
          }}
        />
      </View>

      <PrimaryButton
        title="Voir les dépenses de ce mois"
        onPress={openExpenseListForMonth}
      />
      <Pressable
        style={styles.closeLink}
        onPress={() => navigation.goBack ()}
        hitSlop={12}
      >
        <Text style={styles.closeLinkText}>Fermer</Text>
      </Pressable>
    </ScrollView>

    <Modal
      visible={monthPickOpen}
      animationType="fade"
      transparent
      onRequestClose={() => setMonthPickOpen(false)}
    >
      <Pressable
        style={styles.monthModalBackdrop}
        onPress={() => setMonthPickOpen(false)}
      >
        <Pressable
          style={[
            styles.monthModalCard,
            { paddingBottom: insets.bottom + spacing.lg },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={styles.monthModalTitle}>Mois du récap</Text>
          {Platform.OS === 'web' ? (
            <>
              <MonthInputField
                label="Mois"
                value={webMonthKey}
                onChangeText={setWebMonthKey}
                placeholder="2026-03"
              />
              <PrimaryButton title="Appliquer" onPress={applyWebMonth} />
            </>
          ) : (
            <>
              {NativeDateTimePicker ? (
                <NativeDateTimePicker
                  value={refMonth}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(_: unknown, d: Date | undefined) => {
                    if (Platform.OS === 'android') {
                      setMonthPickOpen(false);
                    }
                    if (d) {
                      setRefMonth(
                        new Date(
                          d.getFullYear(),
                          d.getMonth(),
                          1,
                          12,
                          0,
                          0,
                          0
                        )
                      );
                    }
                  }}
                />
              ) : null}
              {Platform.OS === 'ios' ? (
                <PrimaryButton
                  title="Terminé"
                  onPress={() => setMonthPickOpen(false)}
                />
              ) : null}
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>

    <Modal
      visible={ritualOpen}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => {
        setRitualOpen (false);
        setRitualStep (0);
      }}
    >
      <View
        style={[
          styles.ritualRoot,
          {
            paddingTop: insets.top + spacing.md,
            paddingBottom: insets.bottom + spacing.xl,
          },
        ]}
      >
        <Text style={styles.ritualKicker}>Petit rituel</Text>
        <Text style={styles.ritualTitle}>À deux, deux minutes</Text>
        {ritualStep === 0 ? (
          <Text style={styles.ritualBody}>
            Ce mois ({monthLabel}), vous avez suivi{' '}
            <Text style={styles.ritualEm}>
              {formatMoney (spent, household.currency)}
            </Text>
            {' '}
            sur {count} mouvement{count > 1 ? 's' : ''}. Rien à « corriger » —
            juste à constater ensemble, tranquillement.
          </Text>
        ) : ritualStep === 1 ? (
          <Text style={styles.ritualBody}>
            Une chose liée à l’argent qui vous a semblé alignée ou rassurante
            ce mois-ci ? Même toute petite, elle compte.
          </Text>
        ) : ritualStep === 2 ? (
          <Text style={styles.ritualBody}>
            Un sujet que vous voulez garder à l’œil pour le mois prochain —
            sans pression, comme une intention commune.
          </Text>
        ) : (
          <Text style={styles.ritualBody}>
            Si un chiffre vous interpelle, vous pouvez ajuster budget global,
            budgets par catégorie ou règle de partage dans Réglages — sans
            toucher à l’historique déjà saisi.
          </Text>
        )}
        <PrimaryButton
          title={ritualStep >= 3 ? 'Terminé' : 'Suivant'}
          onPress={() => {
            if (ritualStep >= 3) {
              setRitualOpen (false);
              setRitualStep (0);
            } else {
              setRitualStep ((s) => s + 1);
            }
          }}
        />
        <SecondaryButton
          title="Fermer"
          onPress={() => {
            setRitualOpen (false);
            setRitualStep (0);
          }}
        />
      </View>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create ({
  root: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingHorizontal: screenPaddingH },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.canvas,
  },
  intro: { marginBottom: spacing.md },
  memoHistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingVertical: spacing.xs,
  },
  memoHistTxt: {
    flex: 1,
    fontSize: fontSize.small,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  kicker: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  monthLineWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  monthLine: {
    textAlign: 'center',
    fontSize: fontSize.title,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    letterSpacing: -0.3,
  },
  monthLineHint: {
    marginTop: 2,
    fontSize: fontSize.micro,
    color: colors.textMuted,
    textAlign: 'center',
  },
  monthModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: screenPaddingH,
  },
  monthModalCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: hairline,
    borderColor: colors.borderLight,
    gap: spacing.md,
  },
  monthModalTitle: {
    fontSize: fontSize.titleSm,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  monthModalHint: {
    fontSize: fontSize.small,
    color: colors.textSecondary,
  },
  monthModalInput: {
    borderWidth: hairline,
    borderColor: colors.borderLight,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.body,
    color: colors.text,
    backgroundColor: colors.canvas,
  },
  demoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: hairline,
    borderColor: colors.borderLight,
  },
  demoBannerText: {
    flex: 1,
    fontSize: fontSize.small,
    color: colors.primaryDark,
    lineHeight: 20,
  },
  hero: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  heroLabel: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
    fontWeight: fontWeight.medium,
  },
  heroAmount: {
    marginTop: spacing.xs,
    fontSize: fontSize.hero,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    letterSpacing: -1,
  },
  heroHint: {
    marginTop: spacing.xs,
    fontSize: fontSize.small,
    color: colors.textSecondary,
  },
  block: { marginBottom: spacing.md },
  guidedCard: { marginBottom: 0 },
  guidedLine: {
    fontSize: fontSize.small,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  guidedLineGap: { marginBottom: spacing.xs },
  pointCard: { gap: spacing.sm },
  pointRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: 2,
  },
  pointLabel: {
    flex: 1,
    fontSize: fontSize.small,
    color: colors.text,
    lineHeight: 20,
  },
  btnSpaced: { marginBottom: spacing.sm },
  recapActions: {
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  decisionInput: {
    minHeight: 88,
    paddingTop: spacing.xs,
    textAlignVertical: 'top',
  },
  remindHint: {
    marginTop: -spacing.xs,
    marginBottom: spacing.sm,
    fontSize: fontSize.small,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  demoMemoText: {
    fontSize: fontSize.small,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  ritualRoot: {
    flex: 1,
    backgroundColor: colors.canvas,
    paddingHorizontal: screenPaddingH,
    gap: spacing.md,
  },
  ritualKicker: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.medium,
    color: colors.textMuted,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  ritualTitle: {
    fontSize: fontSize.title,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    letterSpacing: -0.3,
  },
  ritualBody: {
    fontSize: fontSize.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  ritualEm: {
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  rowBorder: {
    borderBottomWidth: hairline,
    borderBottomColor: colors.borderLight,
  },
  rowName: { fontSize: fontSize.body, color: colors.text, flex: 1, paddingRight: spacing.sm },
  rowAmt: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  emptySoft: {
    fontSize: fontSize.small,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  closeLink: { alignItems: 'center', marginTop: spacing.sm, paddingVertical: spacing.xs },
  closeLinkText: {
    fontSize: fontSize.small,
    fontWeight: fontWeight.medium,
    color: colors.primary,
  },
});
