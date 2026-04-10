import React from 'react';
import { StyleSheet, Text, View, type ViewProps } from 'react-native';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme/tokens';

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'accent';

const toneMap: Record<
  Tone,
  { bg: string; fg: string }
> = {
  neutral: {
    bg: colors.surfaceMuted,
    fg: colors.textSecondary,
  },
  success: {
    bg: colors.successSoft,
    fg: colors.success,
  },
  warning: {
    bg: colors.warningSoft,
    fg: colors.warning,
  },
  danger: {
    bg: colors.dangerSoft,
    fg: colors.danger,
  },
  accent: {
    bg: colors.primarySoft,
    fg: colors.primary,
  },
};

type Props = ViewProps & {
  label: string;
  tone?: Tone;
};

export function Badge ({ label, tone = 'neutral', style, ...rest }: Props) {
  const t = toneMap[tone];
  return (
    <View
      style={[styles.wrap, { backgroundColor: t.bg }, style]}
      {...rest}
    >
      <Text style={[styles.text, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xxs + 2,
    borderRadius: radius.sm,
  },
  text: {
    fontSize: fontSize.micro,
    fontWeight: fontWeight.medium,
    letterSpacing: 0.2,
  },
});
