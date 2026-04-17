import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToast } from '../context/ToastContext';
import { isSupabaseConfigured } from '../lib/supabase';
import { friendlyErrorMessage } from '../lib/userFriendlyError';
import { useAuth } from '../context/AuthContext';
import { colors, fontSize, fontWeight, hairline, radius, shadow, spacing } from '../theme/tokens';

export function LoginScreen () {
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const { signIn, signUp, enterDemoMode, resetPasswordForEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetBusy, setResetBusy] = useState(false);

  /** Sur le web, `Alert.alert` est souvent invisible ; on utilise les toasts. */
  const notify = useCallback(
    (
      title: string,
      message?: string,
      variant: 'neutral' | 'success' | 'danger' = 'neutral'
    ) => {
      if (Platform.OS === 'web') {
        const line = message ? `${title} — ${message}` : title;
        showToast(
          line,
          variant === 'danger' ? 'danger' : variant === 'success' ? 'success' : 'neutral'
        );
      } else if (message) {
        Alert.alert(title, message);
      } else {
        Alert.alert(title);
      }
    },
    [showToast]
  );

  async function submit () {
    const em = email.trim();
    if (!em || !password) {
      notify('Champs requis', 'Indique un e-mail et un mot de passe.', 'danger');
      return;
    }
    try {
      if (mode === 'login') {
        await signIn(em, password);
      } else {
        await signUp(em, password);
        notify(
          'Compte créé',
          'Vérifie ta boîte mail si la confirmation est requise par le projet Supabase.',
          'success'
        );
      }
    } catch (e: unknown) {
      notify(
        mode === 'login' ? 'Connexion' : 'Inscription',
        friendlyErrorMessage(e),
        'danger'
      );
    }
  }

  async function sendReset () {
    const em = resetEmail.trim() || email.trim();
    if (!em) {
      notify('E-mail', 'Indique l’adresse du compte.', 'danger');
      return;
    }
    setResetBusy(true);
    try {
      await resetPasswordForEmail(em);
      setResetOpen(false);
      setResetEmail('');
      notify(
        'E-mail envoyé',
        'Si un compte existe, tu recevras un lien pour choisir un nouveau mot de passe.',
        'success'
      );
    } catch (e: unknown) {
      notify('Réinitialisation', friendlyErrorMessage(e), 'danger');
    } finally {
      setResetBusy(false);
    }
  }

  const webPointer =
    Platform.OS === 'web'
      ? ({ cursor: 'pointer' } as { cursor: 'pointer' })
      : {};

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top + spacing.md }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.brand}>
        <View style={styles.logoMark}>
          <Ionicons name="heart" size={22} color={colors.primary} />
        </View>
        <Text style={styles.brandKicker}>Money Duo</Text>
        <Text style={styles.brandTitle}>Votre cockpit financier à deux</Text>
        <Text style={styles.brandSub}>
          Clarté, équilibre, projection — sans stress de tableur.
        </Text>
        {!isSupabaseConfigured ? (
          <View style={styles.configWarn}>
            <Text style={styles.configWarnTxt}>
              Backend non configuré : ajoutez EXPO_PUBLIC_SUPABASE_URL et
              EXPO_PUBLIC_SUPABASE_ANON_KEY dans mobile/.env pour un foyer partagé
              réel.
            </Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.realDataKicker}>Compte — données réelles partagées</Text>
      <Text style={styles.realDataHint}>
        Chaque personne se connecte avec son e-mail ; le même foyer voit les mêmes
        dépenses et objectifs.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          {mode === 'login' ? 'Connexion' : 'Créer un compte'}
        </Text>
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Mot de passe"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <Pressable
          style={[styles.primary, webPointer]}
          onPress={() => void submit()}
        >
          <Text style={styles.primaryText}>
            {mode === 'login' ? 'Se connecter' : 'Créer un compte'}
          </Text>
        </Pressable>
        <Pressable
          style={webPointer}
          onPress={() => setMode(mode === 'login' ? 'register' : 'login')}
        >
          <Text style={styles.link}>
            {mode === 'login'
              ? 'Pas encore de compte ? S’inscrire'
              : 'Déjà un compte ? Se connecter'}
          </Text>
        </Pressable>
        {mode === 'login' ? (
          <Pressable style={webPointer} onPress={() => setResetOpen(true)}>
            <Text style={styles.linkMuted}>Mot de passe oublié ?</Text>
          </Pressable>
        ) : null}
        <View style={styles.divider} />
        <Text style={styles.previewKicker}>Mode aperçu</Text>
        <Pressable
          style={[styles.secondary, webPointer]}
          onPress={() => enterDemoMode()}
        >
          <Ionicons name="play-circle-outline" size={20} color={colors.primary} />
          <Text style={styles.secondaryText}>Explorer sans compte</Text>
        </Pressable>
        <Text style={styles.demoHint}>
          Données fictives sur cet appareil uniquement — rien n’est enregistré sur le
          serveur. Pour à deux, créez un compte puis un foyer et partagez le lien
          d’invitation.
        </Text>
      </View>

      <Modal
        visible={resetOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setResetOpen(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setResetOpen(false)}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Mot de passe oublié</Text>
            <Text style={styles.modalSub}>
              Saisis l’e-mail du compte : tu recevras un lien si l’adresse existe.
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
              value={resetEmail}
              onChangeText={setResetEmail}
            />
            <Pressable
              style={[styles.primary, webPointer, { marginTop: spacing.sm }]}
              disabled={resetBusy}
              onPress={() => void sendReset()}
            >
              <Text style={styles.primaryText}>
                {resetBusy ? 'Envoi…' : 'Envoyer le lien'}
              </Text>
            </Pressable>
            <Pressable
              style={[webPointer, { marginTop: spacing.md }]}
              onPress={() => setResetOpen(false)}
            >
              <Text style={styles.link}>Annuler</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.canvas,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  brand: {
    marginBottom: spacing.xl,
    alignItems: 'center',
  },
  logoMark: {
    width: 52,
    height: 52,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    ...shadow.soft,
  },
  brandKicker: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.semibold,
    letterSpacing: 1.6,
    color: colors.primary,
    textTransform: 'uppercase',
  },
  brandTitle: {
    marginTop: spacing.sm,
    fontSize: fontSize.title,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  brandSub: {
    marginTop: spacing.sm,
    fontSize: fontSize.small,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 300,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: hairline,
    borderColor: colors.borderLight,
    ...shadow.card,
  },
  cardTitle: {
    fontSize: fontSize.titleSm,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    fontSize: fontSize.body,
    color: colors.text,
    backgroundColor: colors.surfaceElevated,
  },
  primary: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md + 2,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: spacing.sm,
    ...shadow.soft,
  },
  primaryText: {
    color: colors.textInverse,
    fontWeight: '600',
    fontSize: fontSize.body,
  },
  link: {
    marginTop: spacing.lg,
    textAlign: 'center',
    color: colors.primary,
    fontSize: fontSize.small,
    fontWeight: '600',
  },
  linkMuted: {
    marginTop: spacing.md,
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: fontSize.small,
    fontWeight: fontWeight.medium,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: hairline,
    borderColor: colors.borderLight,
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
  divider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: spacing.lg,
  },
  secondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.canvas,
  },
  secondaryText: {
    color: colors.text,
    fontWeight: fontWeight.medium,
    fontSize: fontSize.body,
  },
  demoHint: {
    marginTop: spacing.md,
    textAlign: 'center',
    fontSize: fontSize.caption,
    color: colors.textMuted,
    lineHeight: 18,
  },
  configWarn: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.accentWarm + '22',
    borderWidth: hairline,
    borderColor: colors.borderLight,
    maxWidth: 320,
    alignSelf: 'center',
  },
  configWarnTxt: {
    fontSize: fontSize.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  realDataKicker: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  realDataHint: {
    fontSize: fontSize.small,
    color: colors.textMuted,
    lineHeight: 20,
    marginBottom: spacing.md,
    maxWidth: 340,
  },
  previewKicker: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.semibold,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
});
