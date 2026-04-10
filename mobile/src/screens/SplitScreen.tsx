import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Badge,
  Card,
  InputField,
  PrimaryButton,
  SecondaryButton,
  SectionLabel,
} from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useHousehold } from '../context/HouseholdContext';
import {
  formatISODateFr,
  isDateInRangeInclusive,
  monthBoundsISO,
} from '../lib/dates';
import { formatMoney } from '../lib/format';
import {
  fetchLedgerExpenseRows,
  fetchSettlementsFull,
  fetchSplitsByExpenseIds,
  netBalancesFromLedger,
  pairwiseOwedForMembers,
} from '../lib/ledger';
import { monthPaidAndTheoreticalShare } from '../lib/monthSplitInsights';
import { friendlyErrorMessage } from '../lib/userFriendlyError';
import { parseAmount } from '../lib/parseAmount';
import { hypotheticalCustomShares } from '../lib/splitSimulator';
import { splitRuleLabel } from '../lib/splitRuleCopy';
import { supabase } from '../lib/supabase';
import type { Settlement } from '../lib/types';
import { screenContentPaddingTop, screenPaddingH } from '../theme/screenLayout';
import { colors, fontSize, fontWeight, hairline, radius, spacing } from '../theme/tokens';

export function SplitScreen () {
  const insets = useSafeAreaInsets();
  const { demoMode } = useAuth();
  const { showToast } = useToast();
  const { household, members, refresh } = useHousehold ();
  const [owed, setOwed] = useState (0);
  const [settlements, setSettlements] = useState<Settlement[]> ([]);
  const [amount, setAmount] = useState ('');
  const [note, setNote] = useState ('');
  const [paid, setPaid] = useState<Record<string, number>> ({});
  const [theoretical, setTheoretical] = useState<Record<string, number>> ({});
  const [monthTotal, setMonthTotal] = useState (0);
  const [editStl, setEditStl] = useState<Settlement | null>(null);
  const [editAmt, setEditAmt] = useState('');
  const [editNt, setEditNt] = useState('');
  const [saisiesMonth, setSaisiesMonth] = useState<Record<string, number>>(
    {}
  );
  const [payeurLignesMonth, setPayeurLignesMonth] = useState<
    Record<string, number>
  >({});
  const [simPct, setSimPct] = useState('50');

  useEffect(() => {
    if (
      household?.default_split_rule === 'custom_percent' &&
      household.default_custom_percent != null
    ) {
      setSimPct(String(household.default_custom_percent));
    } else {
      setSimPct('50');
    }
  }, [
    household?.id,
    household?.default_split_rule,
    household?.default_custom_percent,
  ]);

  const load = useCallback (async () => {
    if (!household) {
      return;
    }
    if (members.length < 2) {
      setOwed (0);
      setSettlements ([]);
      setPaid ({});
      setTheoretical ({});
      setMonthTotal (0);
      setSaisiesMonth ({});
      setPayeurLignesMonth ({});
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

      const m = monthPaidAndTheoreticalShare (
        expenseRows,
        splitsMap,
        memberIds
      );
      setPaid (m.paid);
      setTheoretical (m.theoretical);
      setMonthTotal (m.monthTotal);

      const { start, end } = monthBoundsISO();
      const { data: metaRows, error: metaErr } = await supabase
        .from ('expenses')
        .select ('payer_member_id, created_by_member_id, spent_at')
        .eq ('household_id', household.id)
        .gte ('spent_at', start)
        .lte ('spent_at', end);
      const saisies: Record<string, number> = {};
      const payeurLignes: Record<string, number> = {};
      if (!metaErr && metaRows) {
        for (const row of metaRows) {
          const spent = String (row.spent_at).slice (0, 10);
          if (!isDateInRangeInclusive (spent, start, end)) {
            continue;
          }
          const p = row.payer_member_id as string;
          payeurLignes[p] = (payeurLignes[p] ?? 0) + 1;
          const c = row.created_by_member_id as string | null | undefined;
          if (c) {
            saisies[c] = (saisies[c] ?? 0) + 1;
          }
        }
      }
      setSaisiesMonth (saisies);
      setPayeurLignesMonth (payeurLignes);
    } catch {
      setOwed (0);
      setSettlements ([]);
      setPaid ({});
      setTheoretical ({});
      setMonthTotal (0);
      setSaisiesMonth ({});
      setPayeurLignesMonth ({});
    }
  }, [household, members]);

  useFocusEffect (
    useCallback (() => {
      void load ();
    }, [load])
  );

  async function addSettlement () {
    if (demoMode) {
      Alert.alert (
        'Mode aperçu',
        'Les régularisations ne sont pas enregistrées en démo.'
      );
      return;
    }
    if (!household || members.length < 2) {
      return;
    }
    const n = parseAmount (amount);
    if (n == null || n <= 0) {
      Alert.alert ('Montant', 'Indique un montant valide pour enregistrer la régularisation.');
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
      Alert.alert ('Erreur', friendlyErrorMessage(error));
      return;
    }
    setAmount ('');
    setNote ('');
    showToast ('Régularisation enregistrée', 'success');
    await refresh ();
    await load ();
  }

  function openEditSettlement (s: Settlement) {
    setEditStl (s);
    setEditAmt (String (s.amount));
    setEditNt (s.note ?? '');
  }

  async function saveEditSettlement () {
    if (demoMode || !household || !editStl) {
      return;
    }
    const n = parseAmount (editAmt);
    if (n == null || n <= 0) {
      Alert.alert ('Montant', 'Indique un montant valide.');
      return;
    }
    const { error } = await supabase
      .from ('settlements')
      .update ({
        amount: n,
        note: editNt.trim ().length > 0 ? editNt.trim () : null,
      })
      .eq ('id', editStl.id)
      .eq ('household_id', household.id);
    if (error) {
      Alert.alert ('Erreur', friendlyErrorMessage (error));
      return;
    }
    setEditStl (null);
    showToast ('Régularisation mise à jour', 'success');
    await refresh ();
    await load ();
  }

  function confirmDeleteSettlement (s: Settlement) {
    if (demoMode) {
      Alert.alert (
        'Mode aperçu',
        'La suppression n’est pas disponible en démo.'
      );
      return;
    }
    if (!household) {
      return;
    }
    Alert.alert (
      'Supprimer cette régularisation ?',
      'L’historique sera mis à jour ; l’équilibre recalculé en conséquence.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from ('settlements')
              .delete ()
              .eq ('id', s.id)
              .eq ('household_id', household.id);
            if (error) {
              Alert.alert ('Erreur', friendlyErrorMessage (error));
              return;
            }
            showToast ('Régularisation supprimée', 'neutral');
            await refresh ();
            await load ();
          },
        },
      ]
    );
  }

  const ruleCopy = useMemo (() => {
    if (!household) {
      return '';
    }
    return splitRuleLabel (household.default_split_rule, household);
  }, [household]);

  const statusBadge = useMemo (() => {
    if (members.length < 2) {
      return { label: 'En attente', tone: 'neutral' as const };
    }
    if (owed === 0) {
      return { label: 'Équilibré', tone: 'success' as const };
    }
    return { label: 'Écart actif', tone: 'warning' as const };
  }, [owed, members.length]);

  const suggestion = useMemo (() => {
    if (members.length < 2 || !household) {
      return null;
    }
    const m0 = members[0];
    const m1 = members[1];
    if (owed === 0) {
      return 'Rien à régulariser pour l’instant — continuez comme ça.';
    }
    const abs = formatMoney (Math.abs (owed), household.currency);
    if (owed > 0) {
      return `${m1.display_name ?? 'Partenaire'} peut verser ${abs} à ${m0.display_name ?? 'toi'} pour se rapprocher de l’équilibre.`;
    }
    return `${m0.display_name ?? 'Toi'} peux verser ${abs} à ${m1.display_name ?? 'ton partenaire'} pour équilibrer.`;
  }, [owed, members, household]);

  if (!household) {
    return null;
  }

  const m0 = members[0];
  const m1 = members[1];

  return (
    <>
    <FlatList
      data={settlements}
      keyExtractor={(s) => s.id}
      contentContainerStyle={[
        styles.list,
        {
          paddingTop: screenContentPaddingTop (insets.top),
          paddingBottom: insets.bottom + spacing.xxl,
        },
      ]}
      ListHeaderComponent={
        <View>
          <View style={styles.intro}>
            <Text style={styles.kicker}>Équilibre du foyer</Text>
            <Text style={styles.title}>Répartition</Text>
            <Text style={styles.sub}>
              Qui a payé quoi ce mois-ci, quelle était la part théorique, et où
              en est l’équilibre — sans tableur.
            </Text>
          </View>

          {members.length > 2 ? (
            <Card variant="soft" padded style={styles.warn3Card}>
              <Text style={styles.warn3Text}>
                Répartition est optimisée pour deux personnes. Avec{' '}
                {members.length} membres, le solde suggéré et les montants du
                mois ne portent que sur les deux premiers profils — le reste du
                foyer n’y figure pas encore.
              </Text>
            </Card>
          ) : null}

          <Card style={styles.cardPad}>
            <View style={styles.ruleRow}>
              <Ionicons name="options-outline" size={22} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.ruleLabel}>Règle active</Text>
                <Text style={styles.ruleValue}>{ruleCopy}</Text>
              </View>
            </View>
            <View style={styles.badgeRow}>
              <Badge label={statusBadge.label} tone={statusBadge.tone} />
            </View>
            {suggestion ? (
              <Text style={styles.suggestion}>{suggestion}</Text>
            ) : null}
          </Card>

          {members.length >= 2 ? (
            <Card style={styles.whoCard}>
              <Text style={styles.whoKicker}>Qui doit quoi</Text>
              {owed === 0 ? (
                <>
                  <Text style={styles.whoZero}>À l’équilibre</Text>
                  <Text style={styles.whoHint}>
                    Aucun solde à régulariser entre vous — les débours se
                    compensent.
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.whoAmount}>
                    {formatMoney (Math.abs (owed), household.currency)}
                  </Text>
                  <Text style={styles.whoLine}>
                    {owed > 0
                      ? `${m1?.display_name ?? 'Partenaire'} doit verser ce montant à ${m0?.display_name ?? 'toi'}.`
                      : `${m0?.display_name ?? 'Tu'} dois verser ce montant à ${m1?.display_name ?? 'ton partenaire'}.`}
                  </Text>
                  <Text style={styles.whoSub}>
                    C’est le sens du remboursement pour se rapprocher d’un solde
                    nul — indépendamment du détail du mois.
                  </Text>
                </>
              )}
            </Card>
          ) : null}

          {members.length >= 2 ? (
            <Card variant="outline" padded style={styles.explainCard}>
              <Text style={styles.explainKicker}>Comment lire tout ça ?</Text>
              <Text style={styles.explainBullet}>
                • Le montant principal « qui doit quoi » cumule tout l’historique
                des dépenses communes (hors perso) et des régularisations — pas
                seulement le mois affiché ci-dessous.
              </Text>
              <Text style={styles.explainBullet}>
                • Le tableau « Ce mois-ci » ne porte que sur le mois civil en
                cours : débours réels et parts théoriques selon la règle de
                chaque dépense.
              </Text>
              <Text style={styles.explainBullet}>
                • Quand un sens de remboursement est suggéré, c’est pour vous
                rapprocher d’un solde nul ensemble — sans tenir compte du détail
                jour par jour.
              </Text>
            </Card>
          ) : null}

          {members.length >= 2 ? (
            <>
              <SectionLabel
                title="Ce mois-ci (hors perso)"
                subtitle="Débours réels vs parts théoriques selon vos règles."
              />
              <Card>
                <View style={styles.compareGrid}>
                  <View style={styles.compareCol}>
                    <View style={styles.compareHeadRow}>
                      <View style={styles.memAvatar}>
                        <Text style={styles.memAvatarTxt}>
                          {(m0?.display_name ?? '?').trim().slice(0, 1).toUpperCase()}
                        </Text>
                      </View>
                      <Text style={styles.compareHead} numberOfLines={1}>
                        {m0?.display_name ?? 'M1'}
                      </Text>
                    </View>
                    <Text style={styles.compareLabel}>Payé</Text>
                    <Text style={styles.compareFig}>
                      {formatMoney (paid[m0!.id] ?? 0, household.currency)}
                    </Text>
                    <Text style={styles.compareLabel}>Part théorique</Text>
                    <Text style={styles.compareSub}>
                      {formatMoney (
                        theoretical[m0!.id] ?? 0,
                        household.currency
                      )}
                    </Text>
                  </View>
                  <View style={styles.vsep} />
                  <View style={styles.compareCol}>
                    <View style={styles.compareHeadRow}>
                      <View style={[styles.memAvatar, styles.memAvatarAlt]}>
                        <Text style={styles.memAvatarTxtAlt}>
                          {(m1?.display_name ?? '?').trim().slice(0, 1).toUpperCase()}
                        </Text>
                      </View>
                      <Text style={styles.compareHead} numberOfLines={1}>
                        {m1?.display_name ?? 'M2'}
                      </Text>
                    </View>
                    <Text style={styles.compareLabel}>Payé</Text>
                    <Text style={styles.compareFig}>
                      {formatMoney (paid[m1!.id] ?? 0, household.currency)}
                    </Text>
                    <Text style={styles.compareLabel}>Part théorique</Text>
                    <Text style={styles.compareSub}>
                      {formatMoney (
                        theoretical[m1!.id] ?? 0,
                        household.currency
                      )}
                    </Text>
                  </View>
                </View>
                <View style={styles.totalBar}>
                  <Text style={styles.totalLabel}>Total commun ce mois</Text>
                  <Text style={styles.totalFig}>
                    {formatMoney (monthTotal, household.currency)}
                  </Text>
                </View>
                <View style={styles.deltaBox}>
                  <Text style={styles.deltaLabel}>Écart courant (solde)</Text>
                  <Text style={styles.deltaFig}>
                    {formatMoney (Math.abs (owed), household.currency)}
                  </Text>
                  <Text style={styles.deltaHint}>
                    {owed === 0
                      ? 'Vous êtes alignés sur la période cumulée.'
                      : owed > 0
                        ? `${m1?.display_name ?? 'M2'} est en avance de débours.`
                        : `${m0?.display_name ?? 'M1'} est en avance de débours.`}
                  </Text>
                </View>
              </Card>

              <Card variant="outline" padded style={styles.simCard}>
                <Text style={styles.simTitle}>
                  Et si le partage du total commun était…
                </Text>
                <Text style={styles.simSub}>
                  Repère pour discuter : si tout le total commun du mois était
                  réparti en un pourcentage pour {m0?.display_name ?? 'M1'} (le
                  reste pour {m1?.display_name ?? 'M2'}), sans refléter les
                  règles ligne par ligne.
                </Text>
                <InputField
                  label={`Part pour ${m0?.display_name ?? 'M1'} (%)`}
                  keyboardType="decimal-pad"
                  value={simPct}
                  onChangeText={setSimPct}
                  placeholder="50"
                />
                {(() => {
                  const p = parseAmount (simPct);
                  const pct =
                    p != null && p >= 0 && p <= 100 ? p : 50;
                  const hypo = hypotheticalCustomShares (monthTotal, pct);
                  return (
                    <View style={styles.simResult}>
                      <Text style={styles.simResultLabel}>
                        Parts théoriques « simulées » sur le total du mois
                      </Text>
                      <Text style={styles.simResultLine}>
                        {m0?.display_name ?? 'M1'} :{' '}
                        {formatMoney (hypo.first, household.currency)} ·{' '}
                        {m1?.display_name ?? 'M2'} :{' '}
                        {formatMoney (hypo.second, household.currency)}
                      </Text>
                      <Text style={styles.simCompare}>
                        Avec vos vraies règles ce mois :{' '}
                        {formatMoney (
                          theoretical[m0!.id] ?? 0,
                          household.currency
                        )}{' '}
                        /{' '}
                        {formatMoney (
                          theoretical[m1!.id] ?? 0,
                          household.currency
                        )}
                      </Text>
                    </View>
                  );
                })()}
              </Card>

              {(Object.keys (saisiesMonth).length > 0 ||
                Object.keys (payeurLignesMonth).length > 0) && (
                <Card variant="soft" padded style={styles.mentalCard}>
                  <Text style={styles.mentalKicker}>
                    Transparence sur la saisie (ce mois)
                  </Text>
                  <Text style={styles.mentalSub}>
                    Pas un jugement — juste une photographie de qui apparaît
                    dans l’app.
                  </Text>
                  {members.map ((mem) => {
                    const saisies = saisiesMonth[mem.id] ?? 0;
                    const payeur = payeurLignesMonth[mem.id] ?? 0;
                    if (saisies === 0 && payeur === 0) {
                      return null;
                    }
                    return (
                      <View key={mem.id} style={styles.mentalRow}>
                        <Text style={styles.mentalName}>
                          {mem.display_name ?? 'Membre'}
                        </Text>
                        {saisies > 0 ? (
                          <Text style={styles.mentalStat}>
                            {saisies} ligne{saisies > 1 ? 's' : ''} enregistrée
                            {saisies > 1 ? 's' : ''} par cette personne
                          </Text>
                        ) : null}
                        {payeur > 0 ? (
                          <Text style={styles.mentalStat}>
                            {payeur} ligne{payeur > 1 ? 's' : ''} avec elle
                            comme payeur·se indiqué·e
                          </Text>
                        ) : null}
                      </View>
                    );
                  })}
                </Card>
              )}
            </>
          ) : (
            <Card variant="soft" padded>
              <Text style={styles.softText}>
                Invite ton partenaire pour voir la répartition à deux et
                suggérer des régularisations simples.
              </Text>
            </Card>
          )}

          {members.length >= 2 ? (
            <View style={styles.block}>
              <SectionLabel
                title="Régulariser"
                subtitle="Un virement ou remboursement réel — enregistré ici pour la clarté."
              />
              <Card>
                <InputField
                  label="Montant"
                  hint="Montant que vous vous transférez pour équilibrer."
                  keyboardType="decimal-pad"
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="0,00"
                />
                <InputField
                  label="Note (optionnel)"
                  value={note}
                  onChangeText={setNote}
                  placeholder="Ex. virement du 12"
                />
                <PrimaryButton
                  title="Enregistrer la régularisation"
                  onPress={() => void addSettlement ()}
                />
              </Card>
            </View>
          ) : null}

          <SectionLabel
            title="Historique des régularisations"
            subtitle={
              settlements.length === 0
                ? 'Aucun remboursement enregistré pour l’instant.'
                : `${settlements.length} entrée${settlements.length > 1 ? 's' : ''} — la plus récente en haut.`
            }
          />
        </View>
      }
      ListEmptyComponent={
        settlements.length === 0 ? (
          <Card variant="outline" padded style={styles.emptyCard}>
            <Ionicons
              name="sparkles-outline"
              size={28}
              color={colors.textMuted}
              style={{ alignSelf: 'center', marginBottom: spacing.sm }}
            />
            <Text style={styles.emptyTitle}>Aucune régularisation encore</Text>
            <Text style={styles.emptyDesc}>
              Quand l’un de vous rembourse l’autre, enregistrez-le ici : le
              suivi reste doux et clair.
            </Text>
          </Card>
        ) : null
      }
      renderItem={({ item }) => {
        const fromName =
          members.find ((m) => m.id === item.from_member_id)?.display_name ??
          'Membre';
        const toName =
          members.find ((m) => m.id === item.to_member_id)?.display_name ??
          'Membre';
        return (
          <Card variant="outline" padded style={styles.historyCard}>
            <Text style={styles.histFlow}>
              {fromName} → {toName}
            </Text>
            <View style={styles.histTop}>
              <Text style={styles.histDate}>
                {formatISODateFr (item.settled_at)}
              </Text>
              <Text style={styles.histAmt}>
                {formatMoney (Number (item.amount), household.currency)}
              </Text>
            </View>
            {item.note ? (
              <Text style={styles.histNote}>{item.note}</Text>
            ) : null}
            {!demoMode ? (
              <View style={styles.histActions}>
                <Pressable
                  onPress={() => openEditSettlement (item)}
                  hitSlop={8}
                >
                  <Text style={styles.histLink}>Modifier</Text>
                </Pressable>
                <Text style={styles.histSep}> · </Text>
                <Pressable
                  onPress={() => confirmDeleteSettlement (item)}
                  hitSlop={8}
                >
                  <Text style={styles.histLinkDel}>Supprimer</Text>
                </Pressable>
              </View>
            ) : null}
          </Card>
        );
      }}
    />
    <Modal
      visible={editStl != null}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setEditStl (null)}
    >
      <View
        style={[
          styles.editModalRoot,
          { paddingTop: insets.top + spacing.md },
        ]}
      >
        <Text style={styles.editModalTitle}>Modifier la régularisation</Text>
        <Text style={styles.editModalSub}>
          Ajustez le montant ou la note ; la date d’enregistrement reste celle
          d’origine.
        </Text>
        <InputField
          label="Montant"
          keyboardType="decimal-pad"
          value={editAmt}
          onChangeText={setEditAmt}
          placeholder="0,00"
        />
        <InputField
          label="Note (optionnel)"
          value={editNt}
          onChangeText={setEditNt}
          placeholder="Ex. virement du 12"
        />
        <PrimaryButton
          title="Enregistrer"
          onPress={() => void saveEditSettlement ()}
        />
        <SecondaryButton
          title="Annuler"
          onPress={() => setEditStl (null)}
        />
      </View>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create ({
  list: { paddingHorizontal: screenPaddingH, backgroundColor: colors.canvas },
  intro: { marginBottom: spacing.md, marginTop: 0 },
  warn3Card: { marginBottom: spacing.md },
  warn3Text: {
    fontSize: fontSize.small,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  editModalRoot: {
    flex: 1,
    backgroundColor: colors.canvas,
    paddingHorizontal: screenPaddingH,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  editModalTitle: {
    fontSize: fontSize.title,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  editModalSub: {
    fontSize: fontSize.small,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  whoCard: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  whoKicker: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.semibold,
    color: colors.textMuted,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  whoZero: {
    marginTop: spacing.md,
    fontSize: fontSize.title,
    fontWeight: fontWeight.semibold,
    color: colors.success,
  },
  whoAmount: {
    marginTop: spacing.sm,
    fontSize: fontSize.display,
    fontWeight: fontWeight.semibold,
    color: colors.accentWarm,
    letterSpacing: -0.6,
  },
  whoLine: {
    marginTop: spacing.sm,
    fontSize: fontSize.body,
    fontWeight: fontWeight.medium,
    color: colors.text,
    lineHeight: 22,
  },
  whoSub: {
    marginTop: spacing.md,
    fontSize: fontSize.small,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  whoHint: {
    marginTop: spacing.sm,
    fontSize: fontSize.small,
    color: colors.textSecondary,
    lineHeight: 22,
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
    fontSize: fontSize.title,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    letterSpacing: -0.4,
  },
  sub: {
    marginTop: spacing.sm,
    fontSize: fontSize.small,
    color: colors.textSecondary,
    lineHeight: 22,
    maxWidth: 360,
  },
  cardPad: { padding: spacing.md, marginBottom: spacing.md },
  ruleRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  ruleLabel: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.medium,
    color: colors.textMuted,
  },
  ruleValue: {
    marginTop: 4,
    fontSize: fontSize.body,
    fontWeight: fontWeight.medium,
    color: colors.text,
    lineHeight: 22,
  },
  badgeRow: { marginTop: spacing.md },
  suggestion: {
    marginTop: spacing.md,
    fontSize: fontSize.small,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  block: { marginBottom: spacing.xl },
  compareGrid: { flexDirection: 'row' },
  compareCol: { flex: 1 },
  compareHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
    minHeight: 36,
  },
  memAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memAvatarAlt: {
    backgroundColor: colors.sandSoft,
  },
  memAvatarTxt: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
  memAvatarTxtAlt: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.semibold,
    color: colors.accentWarm,
  },
  compareHead: {
    flex: 1,
    fontSize: fontSize.titleSm,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  compareLabel: {
    fontSize: fontSize.micro,
    fontWeight: fontWeight.medium,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  compareFig: {
    marginTop: 4,
    fontSize: fontSize.title,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  compareSub: {
    marginTop: 4,
    fontSize: fontSize.body,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
  },
  vsep: {
    width: 1,
    backgroundColor: colors.borderLight,
    marginHorizontal: spacing.md,
  },
  totalBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: hairline,
    borderTopColor: colors.borderLight,
  },
  totalLabel: { fontSize: fontSize.small, color: colors.textSecondary },
  totalFig: { fontSize: fontSize.titleSm, fontWeight: fontWeight.semibold, color: colors.text },
  deltaBox: {
    marginTop: spacing.lg,
    backgroundColor: colors.sandSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: hairline,
    borderColor: colors.borderLight,
  },
  deltaLabel: { fontSize: fontSize.caption, color: colors.textSecondary },
  deltaFig: {
    marginTop: 4,
    fontSize: fontSize.display,
    fontWeight: fontWeight.semibold,
    color: colors.accentWarm,
  },
  deltaHint: {
    marginTop: spacing.sm,
    fontSize: fontSize.small,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  softText: {
    fontSize: fontSize.small,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  emptyCard: { alignItems: 'center', marginBottom: spacing.md },
  emptyTitle: {
    fontSize: fontSize.titleSm,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    textAlign: 'center',
  },
  emptyDesc: {
    marginTop: spacing.sm,
    fontSize: fontSize.small,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  historyCard: { marginBottom: spacing.sm },
  histFlow: {
    fontSize: fontSize.small,
    fontWeight: fontWeight.semibold,
    color: colors.primaryDark,
    marginBottom: spacing.sm,
  },
  histTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  histDate: { fontSize: fontSize.caption, color: colors.textMuted },
  histAmt: { fontSize: fontSize.body, fontWeight: fontWeight.semibold, color: colors.text },
  histNote: {
    marginTop: spacing.sm,
    fontSize: fontSize.small,
    color: colors.textSecondary,
  },
  histActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    flexWrap: 'wrap',
  },
  histLink: {
    fontSize: fontSize.small,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
  histSep: { fontSize: fontSize.small, color: colors.textMuted },
  histLinkDel: {
    fontSize: fontSize.small,
    fontWeight: fontWeight.semibold,
    color: colors.danger,
  },
  explainCard: { marginBottom: spacing.md },
  explainKicker: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.semibold,
    color: colors.primaryDark,
    marginBottom: spacing.sm,
  },
  explainBullet: {
    fontSize: fontSize.small,
    color: colors.textSecondary,
    lineHeight: 21,
    marginBottom: spacing.xs,
  },
  simCard: { marginBottom: spacing.md },
  simTitle: {
    fontSize: fontSize.titleSm,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  simSub: {
    fontSize: fontSize.small,
    color: colors.textSecondary,
    lineHeight: 21,
    marginBottom: spacing.md,
  },
  simResult: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: hairline,
    borderTopColor: colors.borderLight,
  },
  simResultLabel: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  simResultLine: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.medium,
    color: colors.text,
    lineHeight: 22,
  },
  simCompare: {
    marginTop: spacing.sm,
    fontSize: fontSize.small,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  mentalCard: { marginBottom: spacing.md },
  mentalKicker: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  mentalSub: {
    fontSize: fontSize.small,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  mentalRow: { marginBottom: spacing.md },
  mentalName: {
    fontSize: fontSize.small,
    fontWeight: fontWeight.semibold,
    color: colors.primaryDark,
    marginBottom: 4,
  },
  mentalStat: {
    fontSize: fontSize.small,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});
