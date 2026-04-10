import React from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { colors, fontSize, fontWeight, hairline, radius, spacing } from '../../theme/tokens';

type Props = TextInputProps & {
  label?: string;
  hint?: string;
  /** Supprime la marge basse (ex. champs en ligne). */
  dense?: boolean;
  containerStyle?: ViewStyle;
};

export function InputField ({
  label,
  hint,
  style,
  dense,
  containerStyle,
  ...rest
}: Props) {
  return (
    <View style={[styles.wrap, dense && styles.wrapDense, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.textMuted}
        style={[styles.input, style]}
        {...rest}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.md,
  },
  wrapDense: {
    marginBottom: 0,
    flex: 1,
  },
  label: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    letterSpacing: 0.15,
  },
  input: {
    borderWidth: hairline,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: 11,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.body,
    color: colors.text,
    backgroundColor: colors.surfaceMuted,
  },
  hint: {
    marginTop: spacing.xs,
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
});
