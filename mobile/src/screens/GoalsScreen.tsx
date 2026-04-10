import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Card,
  DateInputField,
  InputField,
  PrimaryButton,
  ProgressBar,
  SecondaryButton,
  SectionLabel,
} from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useHousehold } from '../context/HouseholdContext';
import { getNextGoalMilestone } from '../lib/goalMilestones';
import { insertGoalContributionRow } from '../lib/goalContributions';
import { daysUntilTarget, suggestedMonthlyContribution } from '../lib/goalInsight';
import { formatMoney } from '../lib/format';
import { parseAmount } from '../lib/parseAmount';
import { openGoalDetail } from '../navigation/openGoalDetail';
import { supabase } from '../lib/supabase';
import type { Goal } from '../lib/types';
import { screenContentPaddingTop, screenPaddingH } from '../theme/screenLayout';
import { colors, fontSize, fontWeight, hairline, radius, spacing } from '../theme/tokens';

const STATUS_LABEL: Record<NonNullable<Goal['status']>, string> = {
  future: 'Futur',
  in_progress: 'En cours',
  paused: 'En pause',
  done: 'Termine',
  archived: 'Archive',
};

const PRIORITY_LABEL: Record<NonNullable<Goal['priority']>, string> = {
  high: 'Haute',
  medium: 'Moyenne',
  low: 'Basse',
};

const PROJECT_TYPE_LABEL: Record<NonNullable<Goal['project_type']>, string> = {
  shared: 'Commun',
  household: 'Foyer',
  child: 'Enfant',
  personal_visible: 'Perso visible',
};

const HORIZON_LABEL: Record<NonNullable<Exclude<Goal['horizon'], null>>, string> = {
  this_month: 'Ce mois-ci',
  this_quarter: 'Ce trimestre',
  this_year: 'Cette annee',
  later: 'Plus tard',
};

export function GoalsScreen () {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { demoMode, user } = useAuth();
  const { showToast } = useToast();
  const { household, members, refresh } = useHousehold();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [contrib, setContrib] = useState<Record<string, string>>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [status, setStatus] = useState<NonNullable<Goal['status']>>('in_progress');
  const [priority, setPriority] = useState<NonNullable<Goal['priority']>>('medium');
  const [estimated, setEstimated] = useState('');
  const [projectType, setProjectType] =
    useState<NonNullable<Goal['project_type']>>('shared');
  const [horizon, setHorizon] = useState<NonNullable<Exclude<Goal['horizon'], null>>>(
    'this_year'
  );
  const [nextStep, setNextStep] = useState('');
  const [whyItMatters, setWhyItMatters] = useState('');
  const [focusOnHome, setFocusOnHome] = useState(false);

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
    if (demoMode) {
      Alert.alert(
        'Mode aperçu',
        'Créez un objectif après connexion pour l’enregistrer.'
      );
      return;
    }
    if (!household) {
      return;
    }
    const t = parseAmount(target);
    if (!name.trim() || t == null || t <= 0) {
      Alert.alert(
        'Objectif',
        'Donnez un nom et un montant cible pour commencer sereinement.'
      );
      return;
    }
    const payload: {
      household_id: string;
      name: string;
      target_amount: number;
      current_amount: number;
      owner_scope: string;
      target_date?: string | null;
      status: NonNullable<Goal['status']>;
      priority: NonNullable<Goal['priority']>;
      estimated_amount?: number | null;
      project_type: NonNullable<Goal['project_type']>;
      horizon?: Goal['horizon'];
      next_step?: string | null;
      why_it_matters?: string | null;
      focus_on_home: boolean;
    } = {
      household_id: household.id,
      name: name.trim(),
      target_amount: t,
      current_amount: 0,
      owner_scope: 'household',
      status,
      priority,
      project_type: projectType,
      horizon,
      next_step: nextStep.trim() || null,
      why_it_matters: whyItMatters.trim() || null,
      focus_on_home: focusOnHome,
    };
    if (targetDate.trim().length >= 8) {
      payload.target_date = targetDate.trim().slice(0, 10);
    }
    const est = parseAmount(estimated);
    if (estimated.trim().length > 0 && est != null && est >= 0) {
      payload.estimated_amount = est;
    }
    const { error } = await supabase.from('goals').insert(payload);
    if (error) {
      Alert.alert('Erreur', error.message);
      return;
    }
    setName('');
    setTarget('');
    setTargetDate('');
    setEstimated('');
    setStatus('in_progress');
    setPriority('medium');
    setProjectType('shared');
    setHorizon('this_year');
    setNextStep('');
    setWhyItMatters('');
    setFocusOnHome(false);
    setModalOpen(false);
    showToast('Objectif créé — visible aussi sur l’accueil.', 'success');
    await refresh();
    await load();
  }

  async function addContribution (g: Goal) {
    if (demoMode) {
      Alert.alert(
        'Mode aperçu',
        'Les contributions ne sont pas enregistrées en démo.'
      );
      return;
    }
    if (!household) {
      return;
    }
    const raw = contrib[g.id] ?? '';
    const n = parseAmount(raw);
    if (n == null || n <= 0) {
      Alert.alert('Montant', 'Indique un montant positif.');
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
    const byMember = members.find((m) => m.user_id === user?.id)?.id;
    void insertGoalContributionRow(household.id, g.id, n, byMember);
    setContrib((c) => ({ ...c, [g.id]: '' }));
    showToast('Contribution enregistrée', 'success');
    await refresh();
    await load();
  }

  if (!household) {
    return null;
  }

  const activeGoals = goals.filter(
    (g) => (g.status ?? (g.archived_at ? 'archived' : 'in_progress')) === 'in_progress'
  );
  const futureGoals = goals.filter(
    (g) => (g.status ?? (g.archived_at ? 'archived' : 'in_progress')) === 'future'
  );
  const doneGoals = goals.filter(
    (g) => (g.status ?? (g.archived_at ? 'archived' : 'in_progress')) === 'done'
  );
  const pausedGoals = goals.filter(
    (g) => (g.status ?? (g.archived_at ? 'archived' : 'in_progress')) === 'paused'
  );
  const archivedGoals = goals.filter(
    (g) => (g.status ?? (g.archived_at ? 'archived' : 'in_progress')) === 'archived'
  );
  const primary = activeGoals[0];
  const others = activeGoals.slice(1);
  const progress =
    primary && Number(primary.target_amount) > 0
      ? Math.min(1, Number(primary.current_amount) / Number(primary.target_amount))
      : 0;
  const monthly = primary ? suggestedMonthlyContribution(primary) : null;
  const days = primary ? daysUntilTarget(primary) : null;
  const remaining =
    primary != null
      ? Math.max(
          0,
          Number(primary.target_amount) - Number(primary.current_amount)
        )
      : 0;
  const primaryMilestone = primary ? getNextGoalMilestone(primary) : null;

  return (
    <View style={styles.flex}>
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
      >
        <View style={styles.intro}>
          <Text style={styles.kicker}>Objectifs</Text>
          <Text style={styles.title}>Caps à deux</Text>
          <Text style={styles.sub}>
            Un montant cible, une progression lisible — sans jugement sur le rythme.
          </Text>
        </View>

        {primary ? (
          <Card density="compact" style={styles.hero}>
            <View style={styles.heroTop}>
              <View style={styles.heroIcon}>
                <Ionicons name="flag" size={26} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.heroLabel}>Objectif principal</Text>
                <Pressable
                  onPress={() => openGoalDetail(navigation, primary.id, primary)}
                  hitSlop={6}
                >
                  <Text style={styles.heroName}>{primary.name}</Text>
                </Pressable>
              </View>
            </View>
            <ProgressBar progress={progress} height={10} />
            {primaryMilestone ? (
              <Text style={styles.milestoneLine}>
                Prochain repère ~{primaryMilestone.percent}% — encore{' '}
                {formatMoney(
                  primaryMilestone.amountToNext,
                  household.currency
                )}{' '}
                (ordre de grandeur).
              </Text>
            ) : primary && progress >= 1 ? (
              <Text style={styles.milestoneLine}>Cible atteinte.</Text>
            ) : null}
            <View style={styles.heroFigures}>
              <View>
                <Text style={styles.muted}>Atteint</Text>
                <Text style={styles.bigFig}>
                  {formatMoney(Number(primary.current_amount), household.currency)}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.muted}>Cible</Text>
                <Text style={styles.bigFigMuted}>
                  {formatMoney(Number(primary.target_amount), household.currency)}
                </Text>
              </View>
            </View>
            <View style={styles.heroMeta}>
              <View style={styles.metaCell}>
                <Text style={styles.muted}>Reste</Text>
                <Text style={styles.metaVal}>
                  {formatMoney(remaining, household.currency)}
                </Text>
              </View>
              <View style={styles.metaCell}>
                <Text style={styles.muted}>Date cible</Text>
                <Text style={styles.metaVal}>
                  {primary.target_date ?? '—'}
                </Text>
              </View>
              <View style={styles.metaCell}>
                <Text style={styles.muted}>Jours restants</Text>
                <Text style={styles.metaVal}>
                  {days != null ? `${days} j` : '—'}
                </Text>
              </View>
            </View>
            {monthly != null ? (
              <View style={styles.reco}>
                <Ionicons name="leaf-outline" size={18} color={colors.success} />
                <Text style={styles.recoText}>
                  Environ {formatMoney(monthly, household.currency)} / mois pour
                  tenir le rythme jusqu’à la date.
                </Text>
              </View>
            ) : null}
            <View style={styles.contribBlock}>
              <Text style={styles.contribLabel}>Ajouter une contribution</Text>
              <View style={styles.contribRow}>
                <InputField
                  keyboardType="decimal-pad"
                  value={contrib[primary.id] ?? ''}
                  onChangeText={(v) =>
                    setContrib((c) => ({ ...c, [primary.id]: v }))
                  }
                  placeholder="Montant"
                />
                <PrimaryButton
                  title="Ajouter"
                  onPress={() => void addContribution(primary)}
                  style={styles.contribBtn}
                />
              </View>
            </View>
            <Pressable
              style={styles.editLink}
              onPress={() => openGoalDetail(navigation, primary.id, primary)}
              hitSlop={8}
            >
              <Text style={styles.editLinkText}>Fiche complète et réglages</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.primary} />
            </Pressable>
          </Card>
        ) : (
          <Card variant="soft" padded style={styles.emptyHero}>
            <Text style={styles.emptyEmoji}>◇</Text>
            <Text style={styles.emptyTitle}>Votre premier objectif commun</Text>
            <Text style={styles.emptyDesc}>
              Vacances, coussin de sécurité, projet maison… donnez un nom à
              votre prochain cap.
            </Text>
            <PrimaryButton
              title="Créer un objectif"
              onPress={() => setModalOpen(true)}
            />
          </Card>
        )}

        {others.length ? (
          <View style={styles.block}>
            <SectionLabel
              title="Autres objectifs"
              subtitle="Liste compacte — même attention, moins de bruit."
            />
            {others.map((g) => (
              <Card key={g.id} variant="outline" padded style={styles.smallGoal}>
                <Pressable
                  onPress={() => openGoalDetail(navigation, g.id, g)}
                  hitSlop={6}
                >
                  <Text style={styles.smallName}>{g.name}</Text>
                  <Text style={styles.smallFiche}>Fiche et réglages</Text>
                </Pressable>
                <ProgressBar
                  progress={
                    Number(g.target_amount) > 0
                      ? Math.min(
                          1,
                          Number(g.current_amount) / Number(g.target_amount)
                        )
                      : 0
                  }
                />
                <Text style={styles.smallFig}>
                  {formatMoney(Number(g.current_amount), household.currency)} /{' '}
                  {formatMoney(Number(g.target_amount), household.currency)}
                </Text>
                <View style={styles.contribRow}>
                  <InputField
                    dense
                    keyboardType="decimal-pad"
                    value={contrib[g.id] ?? ''}
                    onChangeText={(v) =>
                      setContrib((c) => ({ ...c, [g.id]: v }))
                    }
                    placeholder="Montant"
                  />
                  <SecondaryButton
                    title="Ajouter"
                    onPress={() => void addContribution(g)}
                  />
                </View>
              </Card>
            ))}
          </View>
        ) : null}

        {primary ? (
          <SecondaryButton
            title="Créer un autre objectif"
            onPress={() => setModalOpen(true)}
          />
        ) : null}

        {futureGoals.length > 0 ? (
          <View style={styles.block}>
            <SectionLabel
              title="Futurs projets / wishlist"
              subtitle="Envies et besoins non urgents, gardes ici sans pression."
            />
            {futureGoals.map((g) => (
              <Card key={g.id} variant="outline" padded style={styles.smallGoal}>
                <Pressable onPress={() => openGoalDetail(navigation, g.id, g)} hitSlop={6}>
                  <Text style={styles.smallName}>{g.name}</Text>
                </Pressable>
                <Text style={styles.futureMeta}>
                  {PROJECT_TYPE_LABEL[g.project_type ?? 'shared']} · Priorite{' '}
                  {PRIORITY_LABEL[g.priority ?? 'medium']}
                  {g.estimated_amount != null
                    ? ` · Estime ${formatMoney(Number(g.estimated_amount), household.currency)}`
                    : ''}
                  {g.horizon ? ` · ${HORIZON_LABEL[g.horizon]}` : ''}
                </Text>
                <SecondaryButton
                  title="Passer en projet actif"
                  onPress={() => {
                    void supabase
                      .from('goals')
                      .update({ status: 'in_progress' })
                      .eq('id', g.id)
                      .then(async ({ error }) => {
                        if (error) {
                          Alert.alert('Erreur', error.message);
                          return;
                        }
                        showToast('Projet passe en en cours', 'success');
                        await refresh();
                        await load();
                      });
                  }}
                />
              </Card>
            ))}
          </View>
        ) : null}

        {doneGoals.length > 0 ? (
          <View style={styles.block}>
            <SectionLabel
              title="Projets termines"
              subtitle="Memoire positive des caps deja atteints."
            />
            {doneGoals.map((g) => (
              <Pressable
                key={g.id}
                onPress={() => openGoalDetail(navigation, g.id, g)}
                style={styles.archivedRow}
              >
                <Text style={styles.archivedName}>{g.name}</Text>
                <Text style={styles.archivedMeta}>
                  {STATUS_LABEL[g.status ?? 'done']}
                </Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Pressable>
            ))}
          </View>
        ) : null}

        {pausedGoals.length > 0 ? (
          <View style={styles.block}>
            <SectionLabel
              title="Projets en pause"
              subtitle="En attente sans etre perdus."
            />
            {pausedGoals.map((g) => (
              <Pressable
                key={g.id}
                onPress={() => openGoalDetail(navigation, g.id, g)}
                style={styles.archivedRow}
              >
                <Text style={styles.archivedName}>{g.name}</Text>
                <Text style={styles.archivedMeta}>
                  {PROJECT_TYPE_LABEL[g.project_type ?? 'shared']}
                </Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Pressable>
            ))}
          </View>
        ) : null}

        {archivedGoals.length > 0 ? (
          <View style={styles.block}>
            <SectionLabel
              title="Archivés"
              subtitle="Hors cockpit — toujours visibles ici."
            />
            {archivedGoals.map((g) => (
              <Pressable
                key={g.id}
                onPress={() => openGoalDetail(navigation, g.id, g)}
                style={styles.archivedRow}
              >
                <Text style={styles.archivedName}>{g.name}</Text>
                <Text style={styles.archivedMeta}>
                  {formatMoney(Number(g.current_amount), household.currency)} /{' '}
                  {formatMoney(Number(g.target_amount), household.currency)}
                </Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Pressable>
            ))}
          </View>
        ) : null}
      </ScrollView>

      <Modal
        visible={modalOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalOpen(false)}
      >
        <View style={[styles.modalRoot, { paddingTop: insets.top + spacing.md }]}>
          <View style={styles.modalHead}>
            <Text style={styles.modalTitle}>Nouvel objectif</Text>
            <Pressable
              onPress={() => setModalOpen(false)}
              hitSlop={12}
              accessibilityRole="button"
            >
              <Ionicons name="close" size={28} color={colors.text} />
            </Pressable>
          </View>
          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.modalScrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.modalSub}>
              Un nom, une cible, quelques repères utiles. Ajustable plus tard.
            </Text>
            <InputField
              label="Nom"
              value={name}
              onChangeText={setName}
              placeholder="Ex. Vacances été"
            />
            <InputField
              label="Montant cible"
              keyboardType="decimal-pad"
              value={target}
              onChangeText={setTarget}
              placeholder="0,00"
            />
            <DateInputField
              label="Date cible (optionnel)"
              value={targetDate}
              onChangeText={setTargetDate}
              placeholder="AAAA-MM-JJ"
            />
            <InputField
              label="Prix estime (optionnel)"
              value={estimated}
              keyboardType="decimal-pad"
              onChangeText={setEstimated}
              placeholder="0,00"
            />
            <Text style={styles.modalFieldLabel}>Type de projet</Text>
            <View style={styles.pickerRow}>
              {(
                ['shared', 'household', 'child', 'personal_visible'] as const
              ).map((k) => (
                <Pressable
                  key={k}
                  style={[styles.pickerChip, projectType === k && styles.pickerChipOn]}
                  onPress={() => setProjectType(k)}
                >
                  <Text style={[styles.pickerTxt, projectType === k && styles.pickerTxtOn]}>
                    {PROJECT_TYPE_LABEL[k]}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.modalFieldLabel}>Horizon</Text>
            <View style={styles.pickerRow}>
              {(['this_month', 'this_quarter', 'this_year', 'later'] as const).map((k) => (
                <Pressable
                  key={k}
                  style={[styles.pickerChip, horizon === k && styles.pickerChipOn]}
                  onPress={() => setHorizon(k)}
                >
                  <Text style={[styles.pickerTxt, horizon === k && styles.pickerTxtOn]}>
                    {HORIZON_LABEL[k]}
                  </Text>
                </Pressable>
              ))}
            </View>
            <InputField
              label="Prochaine etape (optionnel)"
              value={nextStep}
              onChangeText={setNextStep}
              placeholder="Ex. comparer 3 modeles"
            />
            <InputField
              label="Pourquoi ce projet compte (optionnel)"
              value={whyItMatters}
              onChangeText={setWhyItMatters}
              multiline
            />
            <Pressable
              style={styles.focusToggle}
              onPress={() => setFocusOnHome((v) => !v)}
            >
              <Ionicons
                name={focusOnHome ? 'radio-button-on-outline' : 'radio-button-off-outline'}
                size={18}
                color={colors.primary}
              />
              <Text style={styles.focusToggleText}>Mettre ce projet en focus sur l’accueil</Text>
            </Pressable>
            <Text style={styles.modalFieldLabel}>Statut initial</Text>
            <View style={styles.pickerRow}>
              {(['future', 'in_progress', 'paused'] as const).map((k) => (
                <Pressable
                  key={k}
                  style={[styles.pickerChip, status === k && styles.pickerChipOn]}
                  onPress={() => setStatus(k)}
                >
                  <Text style={[styles.pickerTxt, status === k && styles.pickerTxtOn]}>
                    {STATUS_LABEL[k]}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.modalFieldLabel}>Priorite</Text>
            <View style={styles.pickerRow}>
              {(['high', 'medium', 'low'] as const).map((k) => (
                <Pressable
                  key={k}
                  style={[styles.pickerChip, priority === k && styles.pickerChipOn]}
                  onPress={() => setPriority(k)}
                >
                  <Text style={[styles.pickerTxt, priority === k && styles.pickerTxtOn]}>
                    {PRIORITY_LABEL[k]}
                  </Text>
                </Pressable>
              ))}
            </View>
            <PrimaryButton title="Enregistrer l’objectif" onPress={() => void addGoal()} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.canvas },
  root: { flex: 1 },
  content: { paddingHorizontal: screenPaddingH },
  editLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: hairline,
    borderTopColor: colors.borderLight,
  },
  editLinkText: {
    fontSize: fontSize.small,
    fontWeight: fontWeight.medium,
    color: colors.primary,
  },
  intro: { marginBottom: spacing.lg },
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
    letterSpacing: -0.6,
  },
  sub: {
    marginTop: spacing.sm,
    fontSize: fontSize.small,
    color: colors.textSecondary,
    lineHeight: 22,
    maxWidth: 360,
  },
  hero: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  heroTop: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroLabel: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.medium,
    color: colors.textMuted,
  },
  heroName: {
    marginTop: 4,
    fontSize: fontSize.title,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  milestoneLine: {
    marginTop: spacing.sm,
    fontSize: fontSize.small,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  heroFigures: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
  },
  muted: { fontSize: fontSize.caption, color: colors.textMuted },
  bigFig: {
    marginTop: 4,
    fontSize: fontSize.title,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  bigFigMuted: {
    marginTop: 4,
    fontSize: fontSize.body,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
  },
  heroMeta: {
    flexDirection: 'row',
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  metaCell: { flex: 1 },
  metaVal: {
    marginTop: 4,
    fontSize: fontSize.small,
    fontWeight: fontWeight.medium,
    color: colors.text,
  },
  reco: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.successSoft,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  recoText: {
    flex: 1,
    fontSize: fontSize.small,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  contribBlock: { marginTop: spacing.xl },
  contribLabel: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  contribRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  contribBtn: { minWidth: 110 },
  archivedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: hairline,
    borderColor: colors.borderLight,
    gap: spacing.sm,
  },
  archivedName: {
    flex: 1,
    fontSize: fontSize.body,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
  },
  archivedMeta: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
  block: { marginBottom: spacing.lg },
  smallGoal: { marginBottom: spacing.md },
  smallName: {
    fontSize: fontSize.titleSm,
    fontWeight: fontWeight.semibold,
    marginBottom: 2,
    color: colors.text,
  },
  smallFiche: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.medium,
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  smallFig: {
    marginTop: spacing.sm,
    fontSize: fontSize.small,
    color: colors.textSecondary,
  },
  futureMeta: {
    marginBottom: spacing.sm,
    fontSize: fontSize.small,
    color: colors.textSecondary,
  },
  emptyHero: { alignItems: 'center', marginBottom: spacing.xl },
  emptyEmoji: {
    fontSize: 32,
    color: colors.primary,
    opacity: 0.35,
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    fontSize: fontSize.titleSm,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    textAlign: 'center',
  },
  emptyDesc: {
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
    fontSize: fontSize.small,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  modalRoot: {
    flex: 1,
    backgroundColor: colors.canvas,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  modalScroll: { marginTop: spacing.sm },
  modalScrollContent: { paddingBottom: spacing.xl },
  modalHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: fontSize.title,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  modalSub: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    fontSize: fontSize.small,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  modalFieldLabel: {
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
    fontSize: fontSize.caption,
    color: colors.textMuted,
    fontWeight: fontWeight.medium,
  },
  pickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  pickerChip: {
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: hairline,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pickerChipOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  pickerTxt: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  pickerTxtOn: {
    color: colors.primaryDark,
    fontWeight: fontWeight.medium,
  },
  focusToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  focusToggleText: {
    fontSize: fontSize.small,
    color: colors.textSecondary,
  },
});
