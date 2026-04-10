import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
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
} from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useHousehold } from '../context/HouseholdContext';
import { demoGoal } from '../lib/demoData';
import { formatISODateFr } from '../lib/dates';
import { getNextGoalMilestone, goalMilestoneSteps } from '../lib/goalMilestones';
import { insertGoalContributionRow } from '../lib/goalContributions';
import { daysUntilTarget, suggestedMonthlyContribution } from '../lib/goalInsight';
import { formatMoney } from '../lib/format';
import { parseAmount } from '../lib/parseAmount';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { supabase } from '../lib/supabase';
import type { Goal, GoalContribution } from '../lib/types';
import { screenPaddingH } from '../theme/screenLayout';
import {
  colors,
  fontSize,
  fontWeight,
  hairline,
  radius,
  spacing,
} from '../theme/tokens';

function goalStatus (g: Goal): { label: string; tone: 'success' | 'neutral' | 'warning' } {
  const status = g.status ?? (g.archived_at ? 'archived' : 'in_progress');
  if (status === 'archived') {
    return { label: 'Archivé', tone: 'neutral' };
  }
  if (status === 'future') {
    return { label: 'Futur', tone: 'neutral' };
  }
  if (status === 'done') {
    return { label: 'Termine', tone: 'success' };
  }
  if (status === 'paused') {
    return { label: 'En pause', tone: 'neutral' };
  }
  const t = Number(g.target_amount);
  const c = Number(g.current_amount);
  if (t > 0 && c >= t) {
    return { label: 'Cible atteinte', tone: 'success' };
  }
  if (t > 0 && c / t >= 0.85) {
    return { label: 'Presque là', tone: 'neutral' };
  }
  return { label: 'En cours', tone: 'warning' };
}

export function GoalDetailScreen () {
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'GoalDetail'>>();
  const goalId = route.params?.goalId;
  const goalSnapshot = route.params?.goalSnapshot ?? null;
  const { demoMode, user } = useAuth();
  const { showToast } = useToast();
  const { household, members, refresh } = useHousehold();
  const [goal, setGoal] = useState<Goal | null>(null);
  const [loading, setLoading] = useState(true);
  const [contrib, setContrib] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editTarget, setEditTarget] = useState('');
  const [editTargetDate, setEditTargetDate] = useState('');
  const [editStatus, setEditStatus] =
    useState<NonNullable<Goal['status']>>('in_progress');
  const [editPriority, setEditPriority] =
    useState<NonNullable<Goal['priority']>>('medium');
  const [editEstimated, setEditEstimated] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editLinks, setEditLinks] = useState('');
  const [editType, setEditType] =
    useState<NonNullable<Goal['project_type']>>('shared');
  const [editHorizon, setEditHorizon] =
    useState<NonNullable<Exclude<Goal['horizon'], null>>>('this_year');
  const [editNextStep, setEditNextStep] = useState('');
  const [editWhy, setEditWhy] = useState('');
  const [editFocus, setEditFocus] = useState(false);
  const [contribHistory, setContribHistory] = useState<GoalContribution[]>([]);
  const [loadedFromSnapshot, setLoadedFromSnapshot] = useState(false);

  const load = useCallback(async () => {
    if (demoMode) {
      // In preview mode, keep detail consistent with cards by using snapshot/demo fallback.
      const fallback = goalSnapshot ?? (goalId === demoGoal.id ? demoGoal : null) ?? demoGoal;
      setGoal(fallback);
      setContribHistory([]);
      setLoadedFromSnapshot(true);
      setLoading(false);
      return;
    }
    if (!household) {
      setLoading(false);
      return;
    }
    if (!goalId) {
      setGoal(goalSnapshot);
      setContribHistory([]);
      setLoadedFromSnapshot(goalSnapshot != null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .eq('id', goalId)
      .eq('household_id', household.id)
      .maybeSingle();
    if (error || !data) {
      // Fallback if the card snapshot exists (deleted/archived/race condition).
      setGoal(goalSnapshot);
      setContribHistory([]);
      setLoadedFromSnapshot(goalSnapshot != null);
      setLoading(false);
      return;
    }
    setGoal(data as Goal);
    setLoadedFromSnapshot(false);
    const { data: hist, error: histErr } = await supabase
      .from('goal_contributions')
      .select('*')
      .eq('goal_id', goalId)
      .eq('household_id', household.id)
      .order('contributed_at', { ascending: false })
      .limit(50);
    setContribHistory(
      histErr || !hist ? [] : (hist as GoalContribution[])
    );
    setLoading(false);
  }, [demoMode, goalId, goalSnapshot, household]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  function openEdit () {
    if (!goal) {
      return;
    }
    setEditName(goal.name);
    setEditTarget(String(goal.target_amount));
    setEditTargetDate(goal.target_date?.slice(0, 10) ?? '');
    setEditStatus(goal.status ?? (goal.archived_at ? 'archived' : 'in_progress'));
    setEditPriority(goal.priority ?? 'medium');
    setEditEstimated(
      goal.estimated_amount != null ? String(goal.estimated_amount) : ''
    );
    setEditNote(goal.note ?? '');
    setEditLinks((goal.links ?? []).join('\n'));
    setEditType(goal.project_type ?? 'shared');
    setEditHorizon(goal.horizon ?? 'this_year');
    setEditNextStep(goal.next_step ?? '');
    setEditWhy(goal.why_it_matters ?? '');
    setEditFocus(Boolean(goal.focus_on_home));
    setEditOpen(true);
  }

  async function saveEdit () {
    if (demoMode || !household || !goal) {
      if (demoMode) {
        Alert.alert('Mode aperçu', 'Connectez-vous pour enregistrer.');
      }
      return;
    }
    const t = parseAmount(editTarget);
    if (!editName.trim() || t == null || t <= 0) {
      Alert.alert('Objectif', 'Nom et montant cible valides requis.');
      return;
    }
    const payload: {
      name: string;
      target_amount: number;
      target_date?: string | null;
      status: NonNullable<Goal['status']>;
      priority: NonNullable<Goal['priority']>;
      estimated_amount?: number | null;
      note?: string | null;
      links?: string[];
      project_type: NonNullable<Goal['project_type']>;
      horizon?: Goal['horizon'];
      next_step?: string | null;
      why_it_matters?: string | null;
      focus_on_home?: boolean;
    } = {
      name: editName.trim(),
      target_amount: t,
      status: editStatus,
      priority: editPriority,
      project_type: editType,
      horizon: editHorizon,
      next_step: editNextStep.trim() || null,
      why_it_matters: editWhy.trim() || null,
      focus_on_home: editFocus,
    };
    if (editTargetDate.trim().length >= 8) {
      payload.target_date = editTargetDate.trim().slice(0, 10);
    } else {
      payload.target_date = null;
    }
    const est = parseAmount(editEstimated);
    payload.estimated_amount =
      editEstimated.trim().length > 0 && est != null && est >= 0 ? est : null;
    payload.note = editNote.trim().length > 0 ? editNote.trim() : null;
    payload.links = editLinks
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => /^https?:\/\//i.test(l));
    const { error } = await supabase
      .from('goals')
      .update(payload)
      .eq('id', goal.id)
      .eq('household_id', household.id);
    if (error) {
      Alert.alert('Erreur', error.message);
      return;
    }
    setEditOpen(false);
    showToast('Objectif mis à jour', 'success');
    await refresh();
    await load();
  }

  function confirmDelete () {
    if (demoMode) {
      Alert.alert('Mode aperçu', 'La suppression n’est pas disponible en démo.');
      return;
    }
    if (!goal) {
      return;
    }
    Alert.alert(
      'Supprimer cet objectif ?',
      'La progression sera perdue.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.from('goals').delete().eq('id', goal.id);
            if (error) {
              Alert.alert('Erreur', error.message);
              return;
            }
            showToast('Objectif supprimé', 'neutral');
            await refresh();
            navigation.goBack();
          },
        },
      ]
    );
  }

  async function addContribution () {
    if (demoMode) {
      Alert.alert('Mode aperçu', 'Les contributions ne sont pas enregistrées en démo.');
      return;
    }
    if (!household || !goal) {
      return;
    }
    if (goal.archived_at) {
      Alert.alert('Objectif archivé', 'Réactivez-le pour ajouter des contributions.');
      return;
    }
    const n = parseAmount(contrib);
    if (n == null || n <= 0) {
      Alert.alert('Montant', 'Indique un montant positif.');
      return;
    }
    const next = Number(goal.current_amount) + n;
    const { error } = await supabase
      .from('goals')
      .update({ current_amount: next })
      .eq('id', goal.id);
    if (error) {
      Alert.alert('Erreur', error.message);
      return;
    }
    const byMember = members.find((m) => m.user_id === user?.id)?.id;
    void insertGoalContributionRow(household.id, goal.id, n, byMember);
    setContrib('');
    showToast('Contribution enregistrée', 'success');
    await refresh();
    await load(    );
  }

  async function setArchived (archived: boolean) {
    if (demoMode || !household || !goal) {
      if (demoMode) {
        Alert.alert('Mode aperçu', 'Non disponible en démo.');
      }
      return;
    }
    const { error } = await supabase
      .from('goals')
      .update({
        archived_at: archived ? new Date().toISOString() : null,
        status: archived ? 'archived' : 'in_progress',
      })
      .eq('id', goal.id)
      .eq('household_id', household.id);
    if (error) {
      Alert.alert('Erreur', error.message);
      return;
    }
    showToast(archived ? 'Objectif archivé' : 'Objectif réactivé', 'success');
    await refresh();
    await load();
  }

  if (!household) {
    return null;
  }

  if (loading) {
    return (
      <View style={styles.missWrap}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!goal) {
    return (
      <View style={styles.missWrap}>
        <Text style={styles.miss}>Objectif introuvable.</Text>
        <SecondaryButton title="Fermer" onPress={() => navigation.goBack()} />
      </View>
    );
  }

  const progress =
    Number(goal.target_amount) > 0
      ? Math.min(1, Number(goal.current_amount) / Number(goal.target_amount))
      : 0;
  const remaining = Math.max(
    0,
    Number(goal.target_amount) - Number(goal.current_amount)
  );
  const monthly = suggestedMonthlyContribution(goal);
  const days = daysUntilTarget(goal);
  const status = goalStatus(goal);
  const nextMilestone = getNextGoalMilestone(goal);
  const steps = goalMilestoneSteps(goal);
  const cleanLinks = (goal.links ?? []).filter((l) => /^https?:\/\//i.test(l));
  const projectTypeLabel =
    goal.project_type === 'household'
      ? 'Foyer'
      : goal.project_type === 'child'
        ? 'Enfant'
        : goal.project_type === 'personal_visible'
          ? 'Perso visible'
          : 'Commun';
  const horizonLabel =
    goal.horizon === 'this_month'
      ? 'Ce mois-ci'
      : goal.horizon === 'this_quarter'
        ? 'Ce trimestre'
        : goal.horizon === 'this_year'
          ? 'Cette annee'
          : goal.horizon === 'later'
            ? 'Plus tard'
            : '—';

  return (
    <>
      <ScrollView
        style={styles.root}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: spacing.md,
            paddingBottom: insets.bottom + spacing.xxl,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.kicker}>Objectif</Text>
        <Text style={styles.title}>{goal.name}</Text>
        {loadedFromSnapshot ? (
          <Card variant="soft" density="compact" style={styles.snapshotNotice}>
            <Text style={styles.snapshotNoticeText}>
              Affichage local de la fiche (synchronisation en cours).
            </Text>
          </Card>
        ) : null}
        <View style={styles.badgeRow}>
          <View
            style={[
              styles.statusPill,
              status.tone === 'success' && styles.statusPillOk,
              status.tone === 'warning' && styles.statusPillWarn,
            ]}
          >
            <Text
              style={[
                styles.statusTxt,
                status.tone === 'success' && styles.statusTxtOk,
              ]}
            >
              {status.label}
            </Text>
          </View>
        </View>

        <Card style={styles.hero}>
          <ProgressBar progress={progress} height={10} />
          <View style={styles.milestoneRow}>
            {steps.map((s) => (
              <View
                key={s.percent}
                style={[
                  styles.milestonePill,
                  s.reached && styles.milestonePillOn,
                ]}
              >
                <Text
                  style={[
                    styles.milestonePillTxt,
                    s.reached && styles.milestonePillTxtOn,
                  ]}
                >
                  {s.percent}%
                </Text>
              </View>
            ))}
          </View>
          {nextMilestone ? (
            <Text style={styles.milestoneHint}>
              Prochain repère : ~{nextMilestone.percent}% de la cible — encore{' '}
              {formatMoney(nextMilestone.amountToNext, household.currency)} à
              épargner (ordre de grandeur).
            </Text>
          ) : progress >= 1 ? (
            <Text style={styles.milestoneHint}>
              Cible atteinte — profitez du moment ensemble.
            </Text>
          ) : null}
          <View style={styles.heroFigures}>
            <View>
              <Text style={styles.muted}>Déjà mis de côté</Text>
              <Text style={styles.bigFig}>
                {formatMoney(Number(goal.current_amount), household.currency)}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.muted}>Cible</Text>
              <Text style={styles.bigFigMuted}>
                {formatMoney(Number(goal.target_amount), household.currency)}
              </Text>
            </View>
          </View>
          <View style={styles.metaRow}>
            <View style={styles.metaCell}>
              <Text style={styles.muted}>Reste</Text>
              <Text style={styles.metaVal}>
                {formatMoney(remaining, household.currency)}
              </Text>
            </View>
            <View style={styles.metaCell}>
              <Text style={styles.muted}>Date cible</Text>
              <Text style={styles.metaVal}>
                {goal.target_date?.slice(0, 10) ?? '—'}
              </Text>
            </View>
            <View style={styles.metaCell}>
              <Text style={styles.muted}>Jours</Text>
              <Text style={styles.metaVal}>{days != null ? `${days}` : '—'}</Text>
            </View>
          </View>
          <View style={styles.metaRow}>
            <View style={styles.metaCell}>
              <Text style={styles.muted}>Priorite</Text>
              <Text style={styles.metaVal}>
                {goal.priority === 'high'
                  ? 'Haute'
                  : goal.priority === 'low'
                    ? 'Basse'
                    : 'Moyenne'}
              </Text>
            </View>
            <View style={styles.metaCell}>
              <Text style={styles.muted}>Statut</Text>
              <Text style={styles.metaVal}>
                {goal.status === 'future'
                  ? 'Futur'
                  : goal.status === 'done'
                    ? 'Termine'
                    : goal.status === 'archived'
                      ? 'Archive'
                      : 'En cours'}
              </Text>
            </View>
            <View style={styles.metaCell}>
              <Text style={styles.muted}>Prix estime</Text>
              <Text style={styles.metaVal}>
                {goal.estimated_amount != null
                  ? formatMoney(Number(goal.estimated_amount), household.currency)
                  : '—'}
              </Text>
            </View>
          </View>
          <View style={styles.metaRow}>
            <View style={styles.metaCell}>
              <Text style={styles.muted}>Type</Text>
              <Text style={styles.metaVal}>{projectTypeLabel}</Text>
            </View>
            <View style={styles.metaCell}>
              <Text style={styles.muted}>Horizon</Text>
              <Text style={styles.metaVal}>{horizonLabel}</Text>
            </View>
            <View style={styles.metaCell}>
              <Text style={styles.muted}>Focus accueil</Text>
              <Text style={styles.metaVal}>{goal.focus_on_home ? 'Oui' : 'Non'}</Text>
            </View>
          </View>
          {monthly != null ? (
            <View style={styles.reco}>
              <Ionicons name="leaf-outline" size={18} color={colors.success} />
              <Text style={styles.recoText}>
                Environ {formatMoney(monthly, household.currency)} / mois pour
                tenir le rythme.
              </Text>
            </View>
          ) : null}
        </Card>

        <Text style={styles.blockLabel}>Ajouter une contribution</Text>
        <Card variant="outline" density="compact">
          <View style={styles.contribRow}>
            <InputField
              keyboardType="decimal-pad"
              value={contrib}
              onChangeText={setContrib}
              placeholder="Montant"
              editable={!goal.archived_at}
            />
            <PrimaryButton
              title="Ajouter"
              onPress={() => void addContribution()}
              style={styles.contribBtn}
              disabled={Boolean(goal.archived_at)}
            />
          </View>
        </Card>

        {contribHistory.length > 0 ? (
          <>
            <Text style={[styles.blockLabel, { marginTop: spacing.lg }]}>
              Historique des contributions
            </Text>
            <Card variant="outline" density="compact">
              {contribHistory.map((row, i) => (
                <View
                  key={row.id}
                  style={[
                    styles.histRow,
                    i < contribHistory.length - 1 && styles.histRowBorder,
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.histDate}>
                      {formatISODateFr(row.contributed_at)}
                    </Text>
                    {row.member_id ? (
                      <Text style={styles.histBy}>
                        Par{' '}
                        {members.find((m) => m.id === row.member_id)
                          ?.display_name ?? '—'}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={styles.histAmt}>
                    {formatMoney(Number(row.amount), household.currency)}
                  </Text>
                </View>
              ))}
            </Card>
          </>
        ) : null}

        {goal.note?.trim() ? (
          <Card variant="outline" density="compact" style={{ marginTop: spacing.md }}>
            <Text style={styles.blockLabel}>Note</Text>
            <Text style={styles.noteText}>{goal.note.trim()}</Text>
          </Card>
        ) : null}
        {goal.next_step?.trim() ? (
          <Card variant="outline" density="compact" style={{ marginTop: spacing.md }}>
            <Text style={styles.blockLabel}>Prochaine etape</Text>
            <Text style={styles.noteText}>{goal.next_step.trim()}</Text>
          </Card>
        ) : null}
        {goal.why_it_matters?.trim() ? (
          <Card variant="outline" density="compact" style={{ marginTop: spacing.md }}>
            <Text style={styles.blockLabel}>Pourquoi ce projet compte</Text>
            <Text style={styles.noteText}>{goal.why_it_matters.trim()}</Text>
          </Card>
        ) : null}

        {cleanLinks.length > 0 ? (
          <Card variant="outline" density="compact" style={{ marginTop: spacing.md }}>
            <Text style={styles.blockLabel}>Liens utiles</Text>
            {cleanLinks.map((link, idx) => (
              <Pressable
                key={link + String(idx)}
                onPress={() => void Linking.openURL(link)}
                style={[styles.linkRow, idx < cleanLinks.length - 1 && styles.histRowBorder]}
              >
                <Text style={styles.linkText} numberOfLines={1}>
                  {link}
                </Text>
                <Ionicons name="open-outline" size={18} color={colors.primary} />
              </Pressable>
            ))}
          </Card>
        ) : null}

        <Pressable style={styles.editRow} onPress={openEdit} hitSlop={8}>
          <Text style={styles.editRowTxt}>Modifier nom, cible ou date</Text>
          <Ionicons name="chevron-forward" size={20} color={colors.primary} />
        </Pressable>
        {goal.status === 'archived' || goal.archived_at ? (
          <Pressable
            style={styles.editRow}
            onPress={() => void setArchived(false)}
            hitSlop={8}
          >
            <Text style={styles.editRowTxt}>Rouvrir dans l’accueil</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.primary} />
          </Pressable>
        ) : (
          <Pressable
            style={styles.editRow}
            onPress={() => {
              Alert.alert(
                'Archiver cet objectif ?',
                'Il disparaît du cockpit principal mais reste consultable ici.',
                [
                  { text: 'Annuler', style: 'cancel' },
                  {
                    text: 'Archiver',
                    onPress: () => void setArchived(true),
                  },
                ]
              );
            }}
            hitSlop={8}
          >
            <Text style={styles.editRowTxt}>Archiver</Text>
            <Ionicons name="archive-outline" size={20} color={colors.primary} />
          </Pressable>
        )}
        {goal.status !== 'done' ? (
          <Pressable
            style={styles.editRow}
            onPress={() => {
              void supabase
                .from('goals')
                .update({ status: 'done' })
                .eq('id', goal.id)
                .then(async ({ error }) => {
                  if (error) {
                    Alert.alert('Erreur', error.message);
                    return;
                  }
                  showToast('Projet marque comme termine', 'success');
                  await refresh();
                  await load();
                });
            }}
            hitSlop={8}
          >
            <Text style={styles.editRowTxt}>Marquer comme termine</Text>
            <Ionicons name="checkmark-circle-outline" size={20} color={colors.primary} />
          </Pressable>
        ) : null}
        <Pressable style={styles.delRow} onPress={confirmDelete} hitSlop={8}>
          <Text style={styles.delTxt}>Supprimer cet objectif</Text>
        </Pressable>
      </ScrollView>

      <Modal
        visible={editOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditOpen(false)}
      >
        <View style={[styles.modalRoot, { paddingTop: insets.top + spacing.md }]}>
          <View style={styles.modalHead}>
            <Text style={styles.modalTitle}>Modifier l’objectif</Text>
            <Pressable onPress={() => setEditOpen(false)} hitSlop={12}>
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
              Le montant deja epargne reste inchange.
            </Text>
            <InputField label="Nom" value={editName} onChangeText={setEditName} />
            <InputField
              label="Montant cible"
              keyboardType="decimal-pad"
              value={editTarget}
              onChangeText={setEditTarget}
            />
            <DateInputField
              label="Date cible (optionnel)"
              value={editTargetDate}
              onChangeText={setEditTargetDate}
              placeholder="AAAA-MM-JJ"
            />
            <InputField
              label="Prix estime (optionnel)"
              value={editEstimated}
              keyboardType="decimal-pad"
              onChangeText={setEditEstimated}
              placeholder="0,00"
            />
            <InputField
              label="Note libre"
              value={editNote}
              onChangeText={setEditNote}
              multiline
            />
            <InputField
              label="Liens utiles (1 URL par ligne)"
              value={editLinks}
              onChangeText={setEditLinks}
              multiline
              placeholder="https://..."
            />
            <Text style={styles.modalSub}>Statut et priorite</Text>
            <View style={styles.pickerRow}>
              {(['future', 'in_progress', 'paused', 'done', 'archived'] as const).map((k) => (
                <Pressable
                  key={k}
                  style={[styles.pickerChip, editStatus === k && styles.pickerChipOn]}
                  onPress={() => setEditStatus(k)}
                >
                  <Text style={[styles.pickerTxt, editStatus === k && styles.pickerTxtOn]}>
                    {k === 'future'
                      ? 'Futur'
                      : k === 'in_progress'
                        ? 'En cours'
                        : k === 'paused'
                          ? 'En pause'
                        : k === 'done'
                          ? 'Termine'
                          : 'Archive'}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.modalSub}>Type, horizon et repere</Text>
            <View style={styles.pickerRow}>
              {(['shared', 'household', 'child', 'personal_visible'] as const).map((k) => (
                <Pressable
                  key={k}
                  style={[styles.pickerChip, editType === k && styles.pickerChipOn]}
                  onPress={() => setEditType(k)}
                >
                  <Text style={[styles.pickerTxt, editType === k && styles.pickerTxtOn]}>
                    {k === 'shared'
                      ? 'Commun'
                      : k === 'household'
                        ? 'Foyer'
                        : k === 'child'
                          ? 'Enfant'
                          : 'Perso visible'}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.pickerRow}>
              {(['this_month', 'this_quarter', 'this_year', 'later'] as const).map((k) => (
                <Pressable
                  key={k}
                  style={[styles.pickerChip, editHorizon === k && styles.pickerChipOn]}
                  onPress={() => setEditHorizon(k)}
                >
                  <Text style={[styles.pickerTxt, editHorizon === k && styles.pickerTxtOn]}>
                    {k === 'this_month'
                      ? 'Ce mois-ci'
                      : k === 'this_quarter'
                        ? 'Ce trimestre'
                        : k === 'this_year'
                          ? 'Cette annee'
                          : 'Plus tard'}
                  </Text>
                </Pressable>
              ))}
            </View>
            <InputField
              label="Prochaine etape"
              value={editNextStep}
              onChangeText={setEditNextStep}
              placeholder="Ex. demander un devis"
            />
            <InputField
              label="Pourquoi ce projet compte"
              value={editWhy}
              onChangeText={setEditWhy}
              multiline
            />
            <Pressable style={styles.editRow} onPress={() => setEditFocus((v) => !v)}>
              <Text style={styles.editRowTxt}>
                {editFocus ? 'Retirer du focus accueil' : 'Mettre en focus accueil'}
              </Text>
              <Ionicons
                name={editFocus ? 'radio-button-on-outline' : 'radio-button-off-outline'}
                size={20}
                color={colors.primary}
              />
            </Pressable>
            <View style={styles.pickerRow}>
              {(['high', 'medium', 'low'] as const).map((k) => (
                <Pressable
                  key={k}
                  style={[styles.pickerChip, editPriority === k && styles.pickerChipOn]}
                  onPress={() => setEditPriority(k)}
                >
                  <Text style={[styles.pickerTxt, editPriority === k && styles.pickerTxtOn]}>
                    {k === 'high' ? 'Haute' : k === 'low' ? 'Basse' : 'Moyenne'}
                  </Text>
                </Pressable>
              ))}
            </View>
            <PrimaryButton title="Enregistrer" onPress={() => void saveEdit()} />
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingHorizontal: screenPaddingH },
  hero: {
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  kicker: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.medium,
    color: colors.textMuted,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  title: {
    marginTop: spacing.xs,
    fontSize: fontSize.display,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    letterSpacing: -0.5,
  },
  badgeRow: { marginTop: spacing.sm, marginBottom: spacing.md },
  snapshotNotice: { marginTop: spacing.sm, marginBottom: spacing.xs },
  snapshotNoticeText: {
    fontSize: fontSize.caption,
    color: colors.textSecondary,
  },
  statusPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.lg,
    backgroundColor: colors.sandSoft,
    borderWidth: hairline,
    borderColor: colors.borderLight,
  },
  statusPillOk: {
    backgroundColor: colors.successSoft,
  },
  statusPillWarn: {
    backgroundColor: colors.accentWarm + '22',
  },
  statusTxt: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  statusTxtOk: {
    color: colors.success,
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
  milestoneRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  milestonePill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.md,
    backgroundColor: colors.sandSoft,
    borderWidth: hairline,
    borderColor: colors.borderLight,
  },
  milestonePillOn: {
    backgroundColor: colors.successSoft,
    borderColor: colors.success + '55',
  },
  milestonePillTxt: {
    fontSize: fontSize.micro,
    fontWeight: fontWeight.semibold,
    color: colors.textMuted,
  },
  milestonePillTxtOn: {
    color: colors.success,
  },
  milestoneHint: {
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
  metaRow: {
    flexDirection: 'row',
    marginTop: spacing.lg,
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
    borderWidth: hairline,
    borderColor: colors.borderLight,
  },
  recoText: {
    flex: 1,
    fontSize: fontSize.small,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  blockLabel: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  contribRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  contribBtn: { minWidth: 110 },
  histRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  histRowBorder: {
    borderBottomWidth: hairline,
    borderBottomColor: colors.borderLight,
  },
  histDate: { fontSize: fontSize.small, color: colors.textSecondary },
  histBy: {
    marginTop: 2,
    fontSize: fontSize.micro,
    color: colors.textMuted,
  },
  histAmt: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  noteText: {
    fontSize: fontSize.small,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  linkText: {
    flex: 1,
    fontSize: fontSize.small,
    color: colors.primary,
    marginRight: spacing.sm,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
    borderTopWidth: hairline,
    borderTopColor: colors.borderLight,
  },
  editRowTxt: {
    fontSize: fontSize.small,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
  delRow: { alignItems: 'center', paddingVertical: spacing.lg },
  delTxt: {
    fontSize: fontSize.small,
    fontWeight: fontWeight.medium,
    color: colors.danger,
  },
  missWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.canvas,
  },
  miss: {
    fontSize: fontSize.small,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
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
  pickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  pickerChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
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
});
