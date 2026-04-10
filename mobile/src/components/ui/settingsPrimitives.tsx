import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { colors, fontSize, fontWeight, hairline, radius, spacing } from '../../theme/tokens';

/** Groupe type iOS : un seul bloc arrondi, bord fin. */
export function SettingsGroup ({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[styles.group, style]}>{children}</View>;
}

export function SettingsSectionTitle ({ children }: { children: string }) {
  return (
    <Text style={styles.sectionTitle} accessibilityRole="header">
      {children}
    </Text>
  );
}

type CellProps = {
  label: string;
  sublabel?: string;
  children?: React.ReactNode;
  showDivider?: boolean;
  onPress?: () => void;
};

/** Ligne standard : titre à gauche, contrôle à droite. */
export function SettingsCell ({
  label,
  sublabel,
  children,
  showDivider = true,
  onPress,
}: CellProps) {
  const row = (
    <View style={styles.cellRow}>
      <View style={styles.cellLabelCol}>
        <Text style={styles.cellLabel}>{label}</Text>
        {sublabel ? <Text style={styles.cellSublabel}>{sublabel}</Text> : null}
      </View>
      {children != null ? (
        <View style={styles.cellValue}>{children}</View>
      ) : null}
    </View>
  );

  const body = onPress ? (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.cellPress, pressed && styles.cellPressed]}
    >
      {row}
    </Pressable>
  ) : (
    <View style={styles.cellStatic}>{row}</View>
  );

  return (
    <View>
      {body}
      {showDivider ? <View style={styles.hairline} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: hairline,
    borderColor: colors.groupBorder,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: fontSize.micro,
    fontWeight: fontWeight.semibold,
    color: colors.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
    marginLeft: spacing.xs,
  },
  cellRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  cellPress: {},
  cellPressed: {
    backgroundColor: colors.overlay,
  },
  cellStatic: {},
  cellLabelCol: {
    flex: 1,
    minWidth: 0,
  },
  cellLabel: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.regular,
    color: colors.text,
  },
  cellSublabel: {
    marginTop: 2,
    fontSize: fontSize.caption,
    color: colors.textMuted,
    lineHeight: 16,
  },
  cellValue: {
    maxWidth: '48%',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  hairline: {
    height: hairline,
    backgroundColor: colors.borderLight,
    marginLeft: spacing.md,
  },
});
