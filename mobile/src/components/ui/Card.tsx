import React from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import { colors, hairline, radius, shadow, spacing } from '../../theme/tokens';

type CardProps = ViewProps & {
  /** elevated = léger relief ; outline = fil seulement ; soft = fond sable ; ghost = fond transparent + contour très léger */
  variant?: 'elevated' | 'outline' | 'soft' | 'ghost';
  padded?: boolean;
  /** compact = moins de padding interne */
  density?: 'comfortable' | 'compact';
};

export function Card ({
  children,
  style,
  variant = 'elevated',
  padded = true,
  density = 'comfortable',
  ...rest
}: CardProps) {
  return (
    <View
      style={[
        styles.base,
        variant === 'elevated' && styles.elevated,
        variant === 'outline' && styles.outline,
        variant === 'soft' && styles.soft,
        variant === 'ghost' && styles.ghost,
        padded && (density === 'compact' ? styles.paddedCompact : styles.padded),
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  elevated: {
    backgroundColor: colors.surface,
    borderWidth: hairline,
    borderColor: colors.groupBorder,
    ...shadow.card,
  },
  outline: {
    backgroundColor: colors.surface,
    borderWidth: hairline,
    borderColor: colors.border,
  },
  soft: {
    backgroundColor: colors.sandSoft,
    borderWidth: hairline,
    borderColor: colors.borderLight,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderWidth: hairline,
    borderColor: colors.borderLight,
  },
  padded: {
    padding: spacing.lg,
  },
  paddedCompact: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
});
