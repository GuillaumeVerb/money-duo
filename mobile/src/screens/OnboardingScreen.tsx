import * as Clipboard from 'expo-clipboard';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useHousehold } from '../context/HouseholdContext';
import { useToast } from '../context/ToastContext';
import { supabase } from '../lib/supabase';
import { buildInviteUrl } from '../lib/inviteUrl';
import { friendlyErrorMessage } from '../lib/userFriendlyError';
import type { SplitRuleKind } from '../lib/types';
import { screenContentPaddingTop } from '../theme/screenLayout';
import {
  colors,
  fontSize,
  fontWeight,
  hairline,
  radius,
  spacing,
} from '../theme/tokens';

const DEFAULT_CATEGORIES = ['Courses', 'Loyer', 'Loisirs', 'Santé', 'Autre'];

function randomInviteToken (): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function OnboardingScreen () {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { refresh } = useHousehold();
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [rule, setRule] = useState<SplitRuleKind>('equal');
  const [customPct, setCustomPct] = useState('50');
  const [busy, setBusy] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);

  const notify = useCallback(
    (
      title: string,
      message?: string,
      variant: 'neutral' | 'success' | 'danger' = 'neutral',
      toastDurationMs?: number
    ) => {
      if (Platform.OS === 'web') {
        const line = message ? `${title} — ${message}` : title;
        showToast(
          line,
          variant === 'danger' ? 'danger' : variant === 'success' ? 'success' : 'neutral',
          toastDurationMs ?? 2800
        );
      } else if (message) {
        Alert.alert(title, message);
      } else {
        Alert.alert(title);
      }
    },
    [showToast]
  );

  const finishInviteFlow = useCallback(async () => {
    const next = await refresh({ silent: true });
    if (!next) {
      notify(
        'Foyer',
        'On n’a pas pu charger ton foyer. Réessaie ou rafraîchis la page.',
        'danger',
        6000
      );
      return;
    }
    setInviteOpen(false);
    setInviteUrl(null);
  }, [refresh, notify]);

  async function createHousehold () {
    if (!user || !name.trim()) {
      notify('Foyer', 'Donne un nom à ton foyer.', 'danger');
      return;
    }
    setBusy(true);
    try {
      const { data: hh, error: hErr } = await supabase
        .from('households')
        .insert({
          name: name.trim(),
          currency: 'EUR',
          default_split_rule: rule,
          default_custom_percent:
            rule === 'custom_percent' ? Number(customPct) : null,
        })
        .select()
        .single();

      if (hErr || !hh) {
        throw hErr ?? new Error('Impossible de créer le foyer.');
      }

      const { error: mErr } = await supabase.from('household_members').insert({
        household_id: hh.id,
        user_id: user.id,
        role: 'owner',
      });
      if (mErr) {
        throw mErr;
      }

      const cats = DEFAULT_CATEGORIES.map((n) => ({
        household_id: hh.id,
        name: n,
      }));
      const { error: catErr } = await supabase.from('categories').insert(cats);
      if (catErr) {
        throw catErr;
      }

      const token = randomInviteToken();
      const expires = new Date();
      expires.setDate(expires.getDate() + 7);

      const { error: invErr } = await supabase.from('household_invites').insert({
        household_id: hh.id,
        token,
        invited_by: user.id,
        expires_at: expires.toISOString(),
      });
      if (invErr) {
        throw invErr;
      }

      const url = buildInviteUrl(token);

      // Ne pas appeler refresh() tout de suite : ça mettait loading=true et remplaçait
      // tout l’écran par le spinner (RootNavigator), ce qui démontait l’onboarding sans feedback.
      setInviteUrl(url);
      setInviteOpen(true);
      notify(
        'Foyer créé',
        'Copie le lien pour ton partenaire (valable 7 jours).',
        'success',
        6000
      );
    } catch (e: unknown) {
      notify('Création', friendlyErrorMessage(e), 'danger', 6000);
    } finally {
      setBusy(false);
    }
  }

  const webPointer =
    Platform.OS === 'web'
      ? ({ cursor: 'pointer' } as { cursor: 'pointer' })
      : {};

  return (
    <ScrollView
      contentContainerStyle={[
        styles.root,
        { paddingTop: screenContentPaddingTop(insets.top) },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.kicker}>Première étape</Text>
      <Text style={styles.title}>Créer ton foyer</Text>
      <Text style={styles.sub}>
        Un espace partagé pour deux — tu pourras inviter ton·ta partenaire
        ensuite.
      </Text>
      <TextInput
        style={styles.input}
        placeholder="Nom du foyer"
        placeholderTextColor={colors.textMuted}
        value={name}
        onChangeText={setName}
      />
      <Text style={styles.label}>Règle par défaut</Text>
      <Text style={styles.ruleExpl}>
        Elle s’applique aux prochaines dépenses ; l’historique déjà saisi garde
        la règle du moment où elles ont été créées.
      </Text>
      <View style={styles.row}>
        {(
          [
            ['equal', '50/50'],
            ['custom_percent', 'Pourcentage'],
            ['proportional_income', 'Revenus'],
          ] as const
        ).map(([k, label]) => (
          <Pressable
            key={k}
            style={[styles.chip, rule === k && styles.chipOn, webPointer]}
            onPress={() => setRule(k)}
          >
            <Text style={[styles.chipText, rule === k && styles.chipTextOn]}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
      {rule === 'custom_percent' && (
        <TextInput
          style={styles.input}
          keyboardType="decimal-pad"
          placeholder="Part du premier membre (%)"
          placeholderTextColor={colors.textMuted}
          value={customPct}
          onChangeText={setCustomPct}
        />
      )}
      <Pressable
        style={[styles.primary, busy && { opacity: 0.6 }, webPointer]}
        disabled={busy}
        onPress={() => void createHousehold()}
      >
        <Text style={styles.primaryText}>Continuer</Text>
      </Pressable>

      <Modal
        visible={inviteOpen}
        transparent
        animationType="fade"
        onRequestClose={() => void finishInviteFlow()}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => void finishInviteFlow()}
        >
          <Pressable
            style={styles.modalCard}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.modalTitle}>Invitation partenaire</Text>
            <Text style={styles.modalSub}>
              Envoie ce lien à ton partenaire — valable 7 jours.
            </Text>
            {inviteUrl ? (
              <Text style={styles.modalUrl} selectable>
                {inviteUrl}
              </Text>
            ) : null}
            <Pressable
              style={[styles.secondaryBtn, webPointer]}
              onPress={() => {
                if (inviteUrl) {
                  void Clipboard.setStringAsync(inviteUrl).then(() => {
                    notify('Copié', 'Lien copié dans le presse-papiers.', 'success');
                  });
                }
              }}
            >
              <Text style={styles.secondaryBtnTxt}>Copier le lien</Text>
            </Pressable>
            {Platform.OS !== 'web' && inviteUrl ? (
              <Pressable
                style={[styles.secondaryBtn, webPointer, { marginTop: spacing.sm }]}
                onPress={() => {
                  void Share.share(
                    Platform.OS === 'ios'
                      ? { url: inviteUrl }
                      : { message: inviteUrl, title: 'Invitation partenaire' }
                  ).catch(() => {
                    /* feuille partage annulée */
                  });
                }}
              >
                <Text style={styles.secondaryBtnTxt}>Partager…</Text>
              </Pressable>
            ) : null}
            <Pressable
              style={[styles.primary, webPointer, { marginTop: spacing.md }]}
              onPress={() => void finishInviteFlow()}
            >
              <Text style={styles.primaryText}>Continuer vers l’app</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.canvas,
    flexGrow: 1,
  },
  kicker: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.medium,
    color: colors.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: fontSize.display,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginBottom: spacing.sm,
    letterSpacing: -0.4,
  },
  sub: {
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    fontSize: fontSize.small,
    lineHeight: 22,
    maxWidth: 360,
  },
  label: {
    fontWeight: fontWeight.medium,
    marginBottom: spacing.xs,
    color: colors.text,
    fontSize: fontSize.caption,
  },
  ruleExpl: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
    lineHeight: 18,
    marginBottom: spacing.sm,
    maxWidth: 360,
  },
  input: {
    borderWidth: hairline,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    fontSize: fontSize.body,
    color: colors.text,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipOn: {
    borderColor: colors.accent,
    backgroundColor: '#E6F2F2',
  },
  chipText: { color: colors.neutralMuted, fontSize: fontSize.small },
  chipTextOn: { color: colors.accent, fontWeight: '600' },
  primary: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  primaryText: { color: colors.surface, fontWeight: '600', fontSize: fontSize.body },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: hairline,
    borderColor: colors.borderLight,
    maxWidth: 420,
    alignSelf: 'center',
    width: '100%',
  },
  modalTitle: {
    fontSize: fontSize.titleSm,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  modalSub: {
    fontSize: fontSize.small,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  modalUrl: {
    fontSize: fontSize.caption,
    color: colors.primary,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  secondaryBtn: {
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.canvas,
  },
  secondaryBtnTxt: {
    fontWeight: fontWeight.semibold,
    fontSize: fontSize.body,
    color: colors.text,
  },
});
