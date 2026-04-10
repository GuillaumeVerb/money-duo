import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, fontSize, fontWeight, radius, shadow, spacing } from '../../theme/tokens';

type Props = PressableProps & {
  title: string;
  loading?: boolean;
  variant?: 'solid' | 'outlineWarm';
  /** compact = hauteur réduite, sans ombre sur solid */
  size?: 'default' | 'compact';
};

export function PrimaryButton ({
  title,
  loading,
  variant = 'solid',
  size = 'default',
  disabled,
  style,
  ...rest
}: Props) {
  const isOutline = variant === 'outlineWarm';
  const compact = size === 'compact';
  return (
    <Pressable
      accessibilityRole="button"
      style={(state) => {
        const userStyle: StyleProp<ViewStyle> =
          typeof style === 'function' ? style(state) : style;
        return [
          styles.btn,
          compact && styles.btnCompact,
          isOutline ? styles.outline : styles.solid,
          !isOutline && !compact && shadow.soft,
          (disabled || loading) && styles.disabled,
          state.pressed && !disabled && styles.pressed,
          userStyle,
        ];
      }}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={isOutline ? colors.primary : colors.textInverse} />
      ) : (
        <Text style={[styles.label, isOutline && styles.labelOutline, compact && styles.labelCompact]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingVertical: 13,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  btnCompact: {
    minHeight: 40,
    paddingVertical: 9,
    paddingHorizontal: spacing.lg,
  },
  solid: {
    backgroundColor: colors.primary,
  },
  outline: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: {
    opacity: 0.88,
  },
  disabled: {
    opacity: 0.45,
  },
  label: {
    color: colors.textInverse,
    fontSize: fontSize.body,
    fontWeight: fontWeight.medium,
    letterSpacing: 0.15,
  },
  labelCompact: {
    fontSize: fontSize.small,
  },
  labelOutline: {
    color: colors.primary,
  },
});
