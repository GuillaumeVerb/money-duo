import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { colors, fontSize, radius, spacing } from '../theme/tokens';

export function LoginScreen () {
  const { signIn, signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'register'>('login');

  async function submit () {
    try {
      if (mode === 'login') {
        await signIn(email.trim(), password);
      } else {
        await signUp(email.trim(), password);
        Alert.alert(
          'Compte créé',
          'Vérifie ta boîte mail si la confirmation est requise par le projet Supabase.'
        );
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erreur';
      Alert.alert('Connexion', msg);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.title}>Money Duo</Text>
        <Text style={styles.subtitle}>
          Cockpit financier du couple — connexion sécurisée.
        </Text>
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={colors.neutralMuted}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Mot de passe"
          placeholderTextColor={colors.neutralMuted}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <Pressable style={styles.primary} onPress={() => void submit()}>
          <Text style={styles.primaryText}>
            {mode === 'login' ? 'Se connecter' : 'Créer un compte'}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setMode(mode === 'login' ? 'register' : 'login')}
        >
          <Text style={styles.link}>
            {mode === 'login'
              ? 'Pas encore de compte ? S’inscrire'
              : 'Déjà un compte ? Se connecter'}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.neutralWarm,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    fontSize: fontSize.title,
    fontWeight: '700',
    color: colors.neutralText,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: fontSize.small,
    color: colors.neutralMuted,
    marginBottom: spacing.lg,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    fontSize: fontSize.body,
    color: colors.neutralText,
  },
  primary: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  primaryText: {
    color: colors.surface,
    fontWeight: '600',
    fontSize: fontSize.body,
  },
  link: {
    marginTop: spacing.lg,
    textAlign: 'center',
    color: colors.accent,
    fontSize: fontSize.small,
  },
});
