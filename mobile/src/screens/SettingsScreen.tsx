import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CategoryBudgetsPanel } from '../components/CategoryBudgetsPanel';
import { ExpenseAutoRulesPanel } from '../components/ExpenseAutoRulesPanel';
import { RecurringChargesPanel } from '../components/RecurringChargesPanel';
import {
  SettingsCell,
  SettingsGroup,
  SettingsSectionTitle,
} from '../components/ui/settingsPrimitives';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useHousehold } from '../context/HouseholdContext';
import { parseAmount } from '../lib/parseAmount';
import { clearEvents, getRecentEvents, trackEvent } from '../lib/analytics';
import { exportHouseholdExpensesCsv } from '../lib/exportCsv';
import {
  getAnalyticsOptIn,
  getPreferredReminderHour,
  getRemindersEnabled,
  setAnalyticsOptIn,
  setPreferredReminderHour,
  setRemindersEnabled,
} from '../lib/localPrefs';
import { syncRemindersFromPreference } from '../lib/reminders';
import {
  getPrivacyPolicyUrl,
  getSupportEmail,
  getTermsUrl,
} from '../lib/publicConfig';
import { purgeMyAccountHouseholdData } from '../lib/purgeAccountData';
import { friendlyErrorMessage } from '../lib/userFriendlyError';
import { splitRuleShort } from '../lib/splitRuleCopy';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { openHelp } from '../navigation/openHelp';
import { openLegalInfo } from '../navigation/openLegalInfo';
import {
  openFinancialCharter,
  openLightSimulator,
  openMonthHistory,
} from '../navigation/openMonthlyRecap';
import type { Category, SplitRuleKind } from '../lib/types';
import { screenContentPaddingTop, screenPaddingH } from '../theme/screenLayout';
import {
  colors,
  fontSize,
  fontWeight,
  hairline,
  radius,
  spacing,
} from '../theme/tokens';

export function SettingsScreen () {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { signOut, demoMode, user } = useAuth();
  const supportEmail = useMemo(() => getSupportEmail(), []);
  const { showToast } = useToast();
  const { household, members, categories, refresh } = useHousehold();
  const [hhName, setHhName] = useState('');
  const [monthlyBudgetCap, setMonthlyBudgetCap] = useState('');
  const [rule, setRule] = useState<SplitRuleKind>('equal');
  const [customPct, setCustomPct] = useState('50');
  const [incomes, setIncomes] = useState<Record<string, string>>({});
  const [softReminders, setSoftReminders] = useState(false);
  const [reminderHour, setReminderHour] = useState(9);
  const [analyticsOptIn, setAnalyticsOptInState] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [catDrafts, setCatDrafts] = useState<Record<string, string>>({});
  const [newCatName, setNewCatName] = useState('');
  const [myDisplayName, setMyDisplayName] = useState('');
  const [purgingAccount, setPurgingAccount] = useState(false);

  const myMember = useMemo(
    () => members.find((m) => m.user_id === user?.id),
    [members, user?.id]
  );

  useEffect(() => {
    setMyDisplayName(myMember?.display_name ?? '');
  }, [myMember?.id, myMember?.display_name]);

  useEffect(() => {
    if (household) {
      setHhName(household.name);
      setRule(household.default_split_rule);
      setCustomPct(
        household.default_custom_percent != null
          ? String(household.default_custom_percent)
          : '50'
      );
      setMonthlyBudgetCap(
        household.monthly_budget_cap != null
          ? String(household.monthly_budget_cap)
          : ''
      );
    }
  }, [household]);

  useEffect(() => {
    const m: Record<string, string> = {};
    for (const x of members) {
      m[x.id] =
        x.monthly_income != null ? String(x.monthly_income) : '';
    }
    setIncomes(m);
  }, [members]);

  useEffect(() => {
    const m: Record<string, string> = {};
    for (const c of categories) {
      m[c.id] = c.name;
    }
    setCatDrafts(m);
  }, [categories]);

  useEffect(() => {
    void (async () => {
      const [r, a, h] = await Promise.all([
        getRemindersEnabled(),
        getAnalyticsOptIn(),
        getPreferredReminderHour(),
      ]);
      setSoftReminders(r);
      setAnalyticsOptInState(a);
      setReminderHour(h);
    })();
  }, []);

  async function saveHousehold () {
    if (demoMode) {
      Alert.alert('Mode aperçu', 'Connectez-vous pour enregistrer les réglages.');
      return;
    }
    if (!household) {
      return;
    }
    const capRaw = monthlyBudgetCap.trim();
    let monthly_budget_cap: number | null = null;
    if (capRaw.length > 0) {
      const c = parseAmount(capRaw);
      if (c == null || c <= 0) {
        Alert.alert(
          'Budget global',
          'Indique un montant positif ou laisse le champ vide.'
        );
        return;
      }
      monthly_budget_cap = c;
    }

    const { error } = await supabase
      .from('households')
      .update({
        name: hhName.trim(),
        default_split_rule: rule,
        default_custom_percent:
          rule === 'custom_percent' ? Number(customPct) : null,
        monthly_budget_cap,
      })
      .eq('id', household.id);
    if (error) {
      Alert.alert('Erreur', friendlyErrorMessage(error));
      return;
    }
    await refresh();
    showToast(
      'Règle et nom enregistrés — seules les nouvelles dépenses utiliseront cette règle.',
      'success'
    );
  }

  const openPrivacyDocument = useCallback(() => {
    const u = getPrivacyPolicyUrl();
    if (u.length > 0) {
      void Linking.openURL(u);
    } else {
      openLegalInfo(navigation, 'privacy');
    }
  }, [navigation]);

  const openTermsDocument = useCallback(() => {
    const u = getTermsUrl();
    if (u.length > 0) {
      void Linking.openURL(u);
    } else {
      openLegalInfo(navigation, 'terms');
    }
  }, [navigation]);

  const runPurgeAccount = useCallback(async () => {
    if (purgingAccount) {
      return;
    }
    setPurgingAccount(true);
    try {
      await purgeMyAccountHouseholdData();
      showToast('Données effacées. Déconnexion…', 'success');
      await signOut();
    } catch (e) {
      showToast(friendlyErrorMessage(e), 'danger');
    } finally {
      setPurgingAccount(false);
    }
  }, [purgingAccount, showToast, signOut]);

  const confirmPurgeAccount = useCallback(() => {
    if (demoMode) {
      Alert.alert(
        'Mode aperçu',
        'Les données de démo sont locales à cet appareil. Quittez l’aperçu pour gérer un compte réel.'
      );
      return;
    }
    if (!isSupabaseConfigured) {
      Alert.alert(
        'Synchronisation indisponible',
        'Sans projet Supabase, il n’y a pas de données serveur à effacer.'
      );
      return;
    }
    Alert.alert(
      'Supprimer mes données',
      'Effacement côté serveur de vos foyers et de votre profil Money Duo. En foyer à deux : les règlements où vous figuriez sont supprimés ; les dépenses que vous aviez payées sont réattribuées à l’autre membre ; les parts sont recalculées. Vous serez déconnecté.\n\nLe compte e-mail (connexion Supabase Auth) peut encore exister : supprimez-le depuis le tableau Supabase ou demandez-le au support.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Continuer',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Confirmation',
              'Action définitive pour les données de l’application.',
              [
                { text: 'Annuler', style: 'cancel' },
                {
                  text: 'Supprimer',
                  style: 'destructive',
                  onPress: () => void runPurgeAccount(),
                },
              ]
            );
          },
        },
      ]
    );
  }, [demoMode, runPurgeAccount]);

  async function saveMyDisplayName () {
    if (demoMode) {
      Alert.alert('Mode aperçu', 'Connectez-vous pour enregistrer.');
      return;
    }
    if (!myMember) {
      return;
    }
    const name = myDisplayName.trim();
    const { error } = await supabase
      .from('household_members')
      .update({ display_name: name.length > 0 ? name : null })
      .eq('id', myMember.id);
    if (error) {
      Alert.alert('Erreur', friendlyErrorMessage(error));
      return;
    }
    await refresh();
    showToast('Nom enregistré', 'success');
  }

  async function saveAllIncomes () {
    if (demoMode) {
      Alert.alert('Mode aperçu', 'Les revenus ne sont pas enregistrés en démo.');
      return;
    }
    for (const m of members) {
      const n = parseAmount(incomes[m.id] ?? '');
      if (n == null || n < 0) {
        Alert.alert('Revenu', 'Vérifie les montants saisis.');
        return;
      }
    }
    for (const m of members) {
      const n = parseAmount(incomes[m.id] ?? '')!;
      const { error } = await supabase
        .from('household_members')
        .update({ monthly_income: n })
        .eq('id', m.id);
      if (error) {
        Alert.alert('Erreur', friendlyErrorMessage(error));
        return;
      }
    }
    await refresh();
    showToast('Revenus enregistrés', 'success');
  }

  async function saveCategoryName (cat: Category) {
    if (demoMode) {
      Alert.alert('Mode aperçu', 'Non disponible en démo.');
      return;
    }
    if (!household) {
      return;
    }
    const name = (catDrafts[cat.id] ?? '').trim();
    if (!name) {
      Alert.alert('Catégorie', 'Le nom ne peut pas être vide.');
      return;
    }
    const { error } = await supabase
      .from('categories')
      .update({ name })
      .eq('id', cat.id)
      .eq('household_id', household.id);
    if (error) {
      Alert.alert('Erreur', friendlyErrorMessage(error));
      return;
    }
    showToast('Catégorie mise à jour', 'success');
    await refresh();
  }

  async function addCategory () {
    if (demoMode) {
      Alert.alert('Mode aperçu', 'Non disponible en démo.');
      return;
    }
    if (!household) {
      return;
    }
    const name = newCatName.trim();
    if (!name) {
      return;
    }
    const { error } = await supabase.from('categories').insert({
      household_id: household.id,
      name,
      parent_id: null,
    });
    if (error) {
      Alert.alert('Erreur', friendlyErrorMessage(error));
      return;
    }
    setNewCatName('');
    showToast('Catégorie ajoutée', 'success');
    await refresh();
  }

  async function onSoftRemindersToggle (value: boolean) {
    setSoftReminders(value);
    await setRemindersEnabled(value);
    const result = await syncRemindersFromPreference(value, reminderHour);
    if (!result.ok) {
      Alert.alert('Rappels', result.message);
      const revert = !value;
      setSoftReminders(revert);
      await setRemindersEnabled(revert);
    } else if (result.ok && value) {
      showToast(
        `Rappel hebdomadaire activé (lundi, ${reminderHour} h).`,
        'success'
      );
      void trackEvent('reminders_enabled', {});
    } else if (result.ok && !value) {
      void trackEvent('reminders_disabled', {});
    }
  }

  async function applyReminderHour (hour: number) {
    await setPreferredReminderHour(hour);
    setReminderHour(hour);
    if (softReminders && Platform.OS !== 'web') {
      const result = await syncRemindersFromPreference(true, hour);
      if (!result.ok) {
        Alert.alert('Rappels', result.message);
      } else {
        showToast(`Rappels planifiés vers ${hour} h`, 'success');
      }
    }
  }

  async function onAnalyticsToggle (value: boolean) {
    setAnalyticsOptInState(value);
    await setAnalyticsOptIn(value);
    void trackEvent(value ? 'analytics_opt_in' : 'analytics_opt_out', {});
  }

  async function handleExportCsv () {
    if (!household) {
      return;
    }
    setExporting(true);
    try {
      const result = await exportHouseholdExpensesCsv({
        householdId: household.id,
        currency: household.currency,
        demoMode,
        members,
        categories,
      });
      if (!result.ok) {
        Alert.alert('Export', result.message);
        return;
      }
      showToast('Fichier prêt — choisissez où l’enregistrer.', 'success');
      void trackEvent('export_csv', { demo: demoMode });
    } finally {
      setExporting(false);
    }
  }

  function showAnalyticsJournal () {
    void (async () => {
      const ev = await getRecentEvents(25);
      if (ev.length === 0) {
        Alert.alert('Journal', 'Aucun événement enregistré pour l’instant.');
        return;
      }
      const lines = ev.map(
        (e) =>
          `${e.ts.slice(0, 19)}  ${e.name}${
            e.payload ? `  ${JSON.stringify(e.payload)}` : ''
          }`
      );
      Alert.alert(
        'Journal local',
        lines.join('\n'),
        [
          {
            text: 'Effacer',
            style: 'destructive',
            onPress: () => {
              void (async () => {
                await clearEvents();
                showToast('Journal effacé', 'neutral');
              })();
            },
          },
          { text: 'Fermer', style: 'cancel' },
        ],
        { cancelable: true }
      );
    })();
  }

  function confirmDeleteCategory (cat: Category) {
    if (demoMode) {
      Alert.alert('Mode aperçu', 'Non disponible en démo.');
      return;
    }
    Alert.alert(
      'Supprimer cette catégorie ?',
      'Impossible si des dépenses y sont encore liées.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('categories')
              .delete()
              .eq('id', cat.id)
              .eq('household_id', household!.id);
            if (error) {
              const raw = friendlyErrorMessage(error);
              Alert.alert(
                'Suppression impossible',
                error.message.includes('foreign')
                  ? 'Des dépenses utilisent encore cette catégorie.'
                  : raw
              );
              return;
            }
            showToast('Catégorie supprimée', 'neutral');
            await refresh();
          },
        },
      ]
    );
  }

  if (!household) {
    return null;
  }

  const inputRight: StyleProp<TextStyle> = [
    styles.inputRight,
    { color: colors.text },
  ];

  return (
    <>
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: screenContentPaddingTop(insets.top),
          paddingBottom: insets.bottom + spacing.xxl,
        },
      ]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.pageKicker}>Réglages</Text>
      <Text style={styles.pageTitle}>Foyer & habitudes</Text>
      <Text style={styles.pageSub}>
        Règles de partage, revenus et modèles — sans effet sur l’historique des
        dépenses déjà saisies.
      </Text>

      {demoMode ? (
        <View style={styles.accountBanner}>
          <Text style={styles.accountBannerTitle}>Mode aperçu</Text>
          <Text style={styles.accountBannerSub}>
            Données fictives — pour un foyer partagé à deux, déconnectez-vous et
            connectez-vous avec un compte réel.
          </Text>
        </View>
      ) : (
        <View style={styles.accountBannerReal}>
          <Text style={styles.accountBannerTitle}>Compte & foyer</Text>
          <Text style={styles.accountBannerSub}>
            {user?.email ?? 'Session active'}
            {household ? ` · ${household.name}` : ''}
          </Text>
          {!isSupabaseConfigured ? (
            <Text style={styles.accountBannerWarn}>
              Variables Supabase manquantes — les données ne peuvent pas être
              synchronisées.
            </Text>
          ) : null}
        </View>
      )}

      <SettingsSectionTitle>Membres</SettingsSectionTitle>
      <SettingsGroup>
        {members.map((m, i) => (
          <View
            key={m.id}
            style={[
              styles.memberStrip,
              i < members.length - 1 && styles.memberStripBorder,
            ]}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarLetter}>
                {(m.display_name ?? '?').slice(0, 1).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.memberTitle}>
                {m.display_name ?? 'Membre'}
              </Text>
              <Text style={styles.memberHint}>
                {m.role === 'owner' ? 'Référent' : 'Membre'}
              </Text>
            </View>
          </View>
        ))}
      </SettingsGroup>

      {myMember ? (
        <>
          <SettingsSectionTitle>Votre nom</SettingsSectionTitle>
          <SettingsGroup>
            <SettingsCell
              label="Affichage"
              sublabel="Comme vous apparaissez dans l’app et les soldes"
              showDivider={false}
            >
              <TextInput
                value={myDisplayName}
                onChangeText={setMyDisplayName}
                placeholder="Votre prénom"
                placeholderTextColor={colors.textMuted}
                style={inputRight}
                returnKeyType="done"
              />
            </SettingsCell>
            <View style={styles.groupFooter}>
              <Pressable onPress={() => void saveMyDisplayName()} hitSlop={8}>
                <Text style={styles.linkAction}>Enregistrer</Text>
              </Pressable>
            </View>
          </SettingsGroup>
        </>
      ) : null}

      <SettingsSectionTitle>Foyer</SettingsSectionTitle>
      <SettingsGroup>
        <SettingsCell
          label="Nom du foyer"
          sublabel="Affiché dans l’app"
          showDivider
        >
          <TextInput
            value={hhName}
            onChangeText={setHhName}
            placeholder="Notre foyer"
            placeholderTextColor={colors.textMuted}
            style={[styles.inputRight, { color: colors.text }]}
            returnKeyType="done"
          />
        </SettingsCell>
        <SettingsCell
          label="Budget global du mois"
          sublabel="Optionnel — total de toutes les dépenses du mois civil"
          showDivider={false}
        >
          <TextInput
            value={monthlyBudgetCap}
            onChangeText={setMonthlyBudgetCap}
            placeholder="ex. 3000"
            keyboardType="decimal-pad"
            placeholderTextColor={colors.textMuted}
            style={[styles.inputRight, { color: colors.text, minWidth: 88 }]}
            accessibilityLabel="Plafond de budget global pour le mois"
          />
        </SettingsCell>
        <View style={styles.groupFooter}>
          <Pressable onPress={() => void saveHousehold()} hitSlop={8}>
            <Text style={styles.linkAction}>Enregistrer</Text>
          </Pressable>
        </View>
      </SettingsGroup>

      <SettingsSectionTitle>Règle de partage</SettingsSectionTitle>
      <SettingsGroup>
        <View style={styles.segmentPad}>
          <Text style={styles.inlineHint}>
            « Appliquer la règle » met à jour le foyer : les dépenses déjà
            saisies conservent la règle d’origine ; seules les nouvelles lignes
            suivent la règle affichée ici.
          </Text>
          <View style={styles.segment}>
            {(
              [
                ['equal', '50/50'],
                ['custom_percent', 'Sur mesure'],
                ['proportional_income', 'Revenus'],
              ] as const
            ).map(([k, label]) => {
              const on = rule === k;
              return (
                <Pressable
                  key={k}
                  onPress={() => setRule(k)}
                  style={[styles.seg, on && styles.segOn]}
                >
                  <Text style={[styles.segTxt, on && styles.segTxtOn]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.ruleFoot}>
            Actif : {splitRuleShort(rule)}
            {rule === 'proportional_income'
              ? ' · basé sur les revenus ci-dessous'
              : ''}
          </Text>
          {rule === 'custom_percent' ? (
            <View style={styles.customRow}>
              <Text style={styles.customLabel}>% 1er membre</Text>
              <TextInput
                keyboardType="decimal-pad"
                value={customPct}
                onChangeText={setCustomPct}
                placeholder="50"
                placeholderTextColor={colors.textMuted}
                style={[styles.inputRight, { minWidth: 56 }]}
              />
            </View>
          ) : null}
        </View>
        <View style={styles.groupFooter}>
          <Pressable onPress={() => void saveHousehold()} hitSlop={8}>
            <Text style={styles.linkAction}>Appliquer la règle</Text>
          </Pressable>
        </View>
      </SettingsGroup>

      <SettingsSectionTitle>Revenus mensuels</SettingsSectionTitle>
      <SettingsGroup>
        {members.map((m, i) => (
          <SettingsCell
            key={m.id}
            label={m.display_name ?? 'Membre'}
            sublabel="Pour le mode proportionnel"
            showDivider={i < members.length - 1}
          >
            <View style={styles.incomeRight}>
              <TextInput
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={colors.textMuted}
                value={incomes[m.id] ?? ''}
                onChangeText={(v) => setIncomes((s) => ({ ...s, [m.id]: v }))}
                style={[styles.inputRight, { minWidth: 72 }]}
              />
              <Text style={styles.eur}>€</Text>
            </View>
          </SettingsCell>
        ))}
        <View style={styles.groupFooter}>
          <Pressable onPress={() => void saveAllIncomes()} hitSlop={8}>
            <Text style={styles.linkAction}>Enregistrer les revenus</Text>
          </Pressable>
        </View>
      </SettingsGroup>

      <RecurringChargesPanel />

      <SettingsSectionTitle>Catégories</SettingsSectionTitle>
      <SettingsGroup>
        {categories.map((c, i) => (
          <View
            key={c.id}
            style={[
              styles.catRow,
              i < categories.length - 1 && styles.catRowBorder,
            ]}
          >
            <TextInput
              style={styles.catInput}
              value={catDrafts[c.id] ?? c.name}
              onChangeText={(v) =>
                setCatDrafts((s) => ({ ...s, [c.id]: v }))
              }
              placeholder="Nom"
              placeholderTextColor={colors.textMuted}
            />
            <View style={styles.catRowActions}>
              <Pressable
                onPress={() => void saveCategoryName(c)}
                hitSlop={8}
                style={styles.catIconBtn}
              >
                <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
              </Pressable>
              <Pressable
                onPress={() => confirmDeleteCategory(c)}
                hitSlop={8}
                style={styles.catIconBtn}
              >
                <Ionicons name="trash-outline" size={20} color={colors.danger} />
              </Pressable>
            </View>
          </View>
        ))}
        <View style={styles.newCatPad}>
          <Text style={styles.addLabel}>Nouvelle catégorie</Text>
          <View style={styles.newCatRow}>
            <TextInput
              style={styles.catInput}
              value={newCatName}
              onChangeText={setNewCatName}
              placeholder="Ex. Abonnements"
              placeholderTextColor={colors.textMuted}
            />
            <Pressable
              onPress={() => void addCategory()}
              style={styles.newCatAdd}
              hitSlop={8}
            >
              <Text style={styles.newCatAddTxt}>Ajouter</Text>
            </Pressable>
          </View>
        </View>
      </SettingsGroup>

      <CategoryBudgetsPanel />

      <ExpenseAutoRulesPanel />

      <SettingsSectionTitle>Préférences</SettingsSectionTitle>
      <SettingsGroup>
        <SettingsCell
          label="Rappels doux"
          sublabel={
            Platform.OS === 'web'
              ? 'Indisponible sur le web'
              : `Rappel hebdomadaire (lundi · ${reminderHour} h)`
          }
          showDivider
        >
          <Switch
            value={softReminders}
            onValueChange={(v) => void onSoftRemindersToggle(v)}
            disabled={Platform.OS === 'web'}
            trackColor={{ false: colors.border, true: colors.primarySoft }}
            thumbColor={softReminders ? colors.primary : colors.surface}
          />
        </SettingsCell>
        {Platform.OS !== 'web' ? (
          <View style={styles.hourPad}>
            <Text style={styles.hourLabel}>Heure des rappels locaux</Text>
            <Text style={styles.hourHint}>
              S’applique au rappel hebdo et au rappel « se reparler » du mémo du
              mois.
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.hourScroll}
            >
              {[7, 8, 9, 12, 18, 20, 21].map((h) => {
                const on = reminderHour === h;
                return (
                  <Pressable
                    key={h}
                    onPress={() => void applyReminderHour(h)}
                    style={[styles.hourChip, on && styles.hourChipOn]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={`Rappels à ${h} heures`}
                  >
                    <Text style={[styles.hourChipTxt, on && styles.hourChipTxtOn]}>
                      {h} h
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}
        <SettingsCell
          label="Stats anonymes locales"
          sublabel="Journal sur l’appareil uniquement"
          showDivider={false}
        >
          <Switch
            value={analyticsOptIn}
            onValueChange={(v) => void onAnalyticsToggle(v)}
            trackColor={{ false: colors.border, true: colors.primarySoft }}
            thumbColor={analyticsOptIn ? colors.primary : colors.surface}
          />
        </SettingsCell>
      </SettingsGroup>

      <SettingsSectionTitle>Données</SettingsSectionTitle>
      <SettingsGroup>
        <SettingsCell
          label="Exporter"
          sublabel={
            exporting
              ? 'Préparation…'
              : demoMode
                ? 'CSV (exemple démo)'
                : 'CSV (point-virgule, Excel)'
          }
          showDivider={analyticsOptIn}
          onPress={() => {
            if (exporting) {
              return;
            }
            void handleExportCsv();
          }}
        >
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </SettingsCell>
        {analyticsOptIn ? (
          <SettingsCell
            label="Voir le journal"
            sublabel="Derniers événements enregistrés ici"
            onPress={showAnalyticsJournal}
            showDivider
          >
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </SettingsCell>
        ) : null}
        <SettingsCell
          label="Aide"
          sublabel="FAQ & bonnes pratiques"
          showDivider={false}
          onPress={() => openHelp(navigation)}
        >
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </SettingsCell>
      </SettingsGroup>

      <SettingsSectionTitle>Confiance & données</SettingsSectionTitle>
      <SettingsGroup>
        <SettingsCell
          label="Confidentialité"
          sublabel="Traitement des données"
          showDivider
          onPress={openPrivacyDocument}
        >
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </SettingsCell>
        <SettingsCell
          label="Conditions d’utilisation"
          sublabel="CGU (modèle indicatif)"
          showDivider={supportEmail.length > 0}
          onPress={openTermsDocument}
        >
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </SettingsCell>
        {supportEmail.length > 0 ? (
          <SettingsCell
            label="Contacter le support"
            sublabel={supportEmail}
            showDivider
            onPress={() => void Linking.openURL(`mailto:${supportEmail}`)}
          >
            <Ionicons name="mail-outline" size={18} color={colors.textMuted} />
          </SettingsCell>
        ) : null}
        <SettingsCell
          label="Supprimer mes données"
          sublabel={
            purgingAccount
              ? 'Suppression en cours…'
              : 'Foyers, profil app — puis déconnexion'
          }
          showDivider={false}
          onPress={() => {
            if (purgingAccount) {
              return;
            }
            confirmPurgeAccount();
          }}
        >
          <Ionicons name="warning-outline" size={18} color={colors.danger} />
        </SettingsCell>
      </SettingsGroup>

      <Pressable
        style={styles.signOut}
        onPress={() => void signOut()}
      >
        <Text style={styles.signOutTxt}>Se déconnecter</Text>
      </Pressable>
    </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingHorizontal: screenPaddingH },
  pageKicker: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.medium,
    color: colors.textMuted,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  pageTitle: {
    marginTop: spacing.xs,
    fontSize: fontSize.title,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    letterSpacing: -0.3,
  },
  pageSub: {
    marginTop: spacing.xs,
    marginBottom: spacing.md,
    fontSize: fontSize.small,
    color: colors.textMuted,
    lineHeight: 20,
    fontWeight: fontWeight.regular,
  },
  memberStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  memberStripBorder: {
    borderBottomWidth: hairline,
    borderBottomColor: colors.borderLight,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: fontSize.titleSm,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
  memberTitle: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.medium,
    color: colors.text,
  },
  memberHint: {
    marginTop: 1,
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
  inputRight: {
    fontSize: fontSize.body,
    textAlign: 'right',
    paddingVertical: 4,
    paddingHorizontal: 0,
    minWidth: 120,
  },
  groupFooter: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderTopWidth: hairline,
    borderTopColor: colors.borderLight,
    alignItems: 'flex-end',
  },
  linkAction: {
    fontSize: fontSize.small,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
  segmentPad: { padding: spacing.md },
  inlineHint: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  segment: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  seg: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: hairline,
    borderColor: colors.border,
    alignItems: 'center',
  },
  segOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  segTxt: {
    fontSize: fontSize.micro,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
  },
  segTxtOn: {
    color: colors.primaryDark,
    fontWeight: fontWeight.semibold,
  },
  ruleFoot: {
    marginTop: spacing.md,
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: hairline,
    borderTopColor: colors.borderLight,
  },
  customLabel: {
    fontSize: fontSize.small,
    color: colors.textSecondary,
  },
  incomeRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  eur: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
  addLabel: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.semibold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  catRowBorder: {
    borderBottomWidth: hairline,
    borderBottomColor: colors.borderLight,
  },
  catInput: {
    flex: 1,
    fontSize: fontSize.body,
    color: colors.text,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: hairline,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  catRowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  catIconBtn: { padding: 4 },
  newCatPad: {
    padding: spacing.md,
    borderTopWidth: hairline,
    borderTopColor: colors.borderLight,
    gap: spacing.sm,
  },
  newCatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  newCatAdd: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  newCatAddTxt: {
    fontSize: fontSize.small,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
  hourPad: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: hairline,
    borderTopColor: colors.borderLight,
    gap: spacing.sm,
  },
  hourLabel: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.semibold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  hourHint: {
    fontSize: fontSize.caption,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  hourScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  hourChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: hairline,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  hourChipOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  hourChipTxt: {
    fontSize: fontSize.small,
    fontWeight: fontWeight.medium,
    color: colors.textMuted,
  },
  hourChipTxtOn: {
    color: colors.primaryDark,
    fontWeight: fontWeight.semibold,
  },
  accountBanner: {
    marginBottom: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    borderWidth: hairline,
    borderColor: colors.borderLight,
  },
  accountBannerReal: {
    marginBottom: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: hairline,
    borderColor: colors.borderLight,
  },
  accountBannerTitle: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: spacing.xs,
  },
  accountBannerSub: {
    fontSize: fontSize.small,
    color: colors.text,
    lineHeight: 20,
  },
  accountBannerWarn: {
    marginTop: spacing.sm,
    fontSize: fontSize.caption,
    color: colors.accentWarm,
    lineHeight: 18,
  },
  signOut: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    marginBottom: spacing.md,
  },
  signOutTxt: {
    fontSize: fontSize.small,
    fontWeight: fontWeight.medium,
    color: colors.danger,
  },
});
