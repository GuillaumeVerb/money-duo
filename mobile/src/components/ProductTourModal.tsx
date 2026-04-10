import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PrimaryButton, SecondaryButton } from './ui';
import {
  colors,
  fontSize,
  fontWeight,
  radius,
  spacing,
} from '../theme/tokens';

const STEPS: { title: string; body: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  {
    title: 'Un cockpit pour le foyer',
    body:
      'L’accueil résume le mois, l’équilibre entre vous et un repère de dépenses — sans jargon comptable.',
    icon: 'home-outline',
  },
  {
    title: 'Dépenses & équilibre',
    body:
      'Ajoutez une dépense en un geste, consultez la liste et l’onglet Équilibre pour voir qui a avancé quoi.',
    icon: 'receipt-outline',
  },
  {
    title: 'Réglages utiles',
    body:
      'Règle de partage, revenus, charges récurrentes et export CSV — tout est dans Réglages quand vous êtes connectés.',
    icon: 'settings-outline',
  },
];

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function ProductTourModal ({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);

  const step = STEPS[index]!;
  const isLast = index >= STEPS.length - 1;

  function goNext () {
    if (isLast) {
      setIndex(0);
      onClose();
      return;
    }
    setIndex((i) => i + 1);
  }

  function skip () {
    setIndex(0);
    onClose();
  }

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={skip}
    >
      <View style={styles.backdrop}>
        <View
          style={[
            styles.sheet,
            {
              paddingBottom: Math.max(insets.bottom, spacing.lg),
              marginBottom: insets.bottom,
            },
          ]}
        >
          <View style={styles.iconWrap}>
            <Ionicons name={step.icon} size={32} color={colors.primary} />
          </View>
          <Text style={styles.kicker}>
            Visite rapide · {index + 1}/{STEPS.length}
          </Text>
          <Text style={styles.title}>{step.title}</Text>
          <Text style={styles.body}>{step.body}</Text>
          <View style={styles.dots}>
            {STEPS.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i === index && styles.dotOn]}
              />
            ))}
          </View>
          <PrimaryButton
            title={isLast ? 'C’est parti' : 'Suivant'}
            onPress={goNext}
          />
          <SecondaryButton title="Passer" onPress={skip} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(28, 24, 20, 0.45)',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    gap: spacing.md,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  kicker: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.medium,
    color: colors.textMuted,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  title: {
    fontSize: fontSize.title,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    textAlign: 'center',
  },
  body: {
    fontSize: fontSize.small,
    color: colors.textSecondary,
    lineHeight: 22,
    textAlign: 'center',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginVertical: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  dotOn: {
    backgroundColor: colors.primary,
    width: 22,
  },
});
