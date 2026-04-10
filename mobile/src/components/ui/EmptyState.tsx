import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme/tokens';
import { PrimaryButton } from './PrimaryButton';

type Props = {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState ({
  title,
  description,
  actionLabel,
  onAction,
}: Props) {
  return (
    <View style={styles.box}>
      <View style={styles.mark} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.desc}>{description}</Text>
      {actionLabel && onAction ? (
        <View style={styles.cta}>
          <PrimaryButton title={actionLabel} onPress={onAction} size="compact" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  mark: {
    width: 36,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
    opacity: 0.8,
  },
  title: {
    fontSize: fontSize.titleSm,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    textAlign: 'center',
  },
  desc: {
    marginTop: spacing.sm,
    fontSize: fontSize.small,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: fontWeight.regular,
    maxWidth: 320,
    alignSelf: 'center',
  },
  cta: {
    marginTop: spacing.lg,
    width: '100%',
  },
});
