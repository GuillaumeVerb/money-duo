import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontSize, radius, spacing } from '../../theme/tokens';

type Props = PressableProps & {
  title: string;
  subtitle?: string;
  value?: string;
  showChevron?: boolean;
  destructive?: boolean;
};

export function SettingRow ({
  title,
  subtitle,
  value,
  showChevron = true,
  destructive,
  style,
  ...rest
}: Props) {
  return (
    <Pressable
      style={(state) => {
        const userStyle: StyleProp<ViewStyle> =
          typeof style === 'function' ? style(state) : style;
        return [styles.row, state.pressed && styles.pressed, userStyle];
      }}
      {...rest}
    >
      <View style={styles.texts}>
        <Text style={[styles.title, destructive && styles.destructive]}>
          {title}
        </Text>
        {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
      </View>
      {value ? (
        <Text style={styles.value} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {showChevron ? (
        <Ionicons
          name="chevron-forward"
          size={18}
          color={colors.textMuted}
          style={styles.chev}
        />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    gap: spacing.sm,
  },
  pressed: {
    backgroundColor: colors.overlay,
  },
  texts: { flex: 1 },
  title: {
    fontSize: fontSize.body,
    fontWeight: '500',
    color: colors.text,
  },
  destructive: {
    color: colors.danger,
  },
  sub: {
    marginTop: 2,
    fontSize: fontSize.caption,
    color: colors.textSecondary,
  },
  value: {
    maxWidth: '42%',
    fontSize: fontSize.small,
    color: colors.textMuted,
    textAlign: 'right',
  },
  chev: { marginLeft: spacing.xs },
});
