import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme/tokens';

type Props = PressableProps & {
  title: string;
};

export function SecondaryButton ({ title, style, ...rest }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      style={(state) => {
        const userStyle: StyleProp<ViewStyle> =
          typeof style === 'function' ? style(state) : style;
        return [styles.wrap, state.pressed && styles.pressed, userStyle];
      }}
      {...rest}
    >
      <Text style={styles.text}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.85,
  },
  text: {
    color: colors.primaryDark,
    fontWeight: fontWeight.medium,
    fontSize: fontSize.small,
  },
});
