import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fontSize, fontWeight, spacing } from '../../theme/tokens';

type Props = {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
};

export function SectionLabel ({ title, subtitle, action }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.texts}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
    gap: spacing.md,
  },
  texts: { flex: 1 },
  title: {
    fontSize: fontSize.titleSm,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    letterSpacing: -0.2,
  },
  sub: {
    marginTop: 3,
    fontSize: fontSize.caption,
    color: colors.textMuted,
    lineHeight: 16,
    fontWeight: fontWeight.regular,
  },
});
