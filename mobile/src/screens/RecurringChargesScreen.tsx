import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RecurringChargesPanel } from '../components/RecurringChargesPanel';
import { screenContentPaddingTop, screenPaddingH } from '../theme/screenLayout';
import { colors, fontSize, fontWeight, spacing } from '../theme/tokens';

export function RecurringChargesScreen () {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: screenContentPaddingTop(insets.top),
          paddingBottom: insets.bottom + spacing.xl,
        },
      ]}
    >
      <Text style={styles.kicker}>Prévisions</Text>
      <Text style={styles.title}>Charges récurrentes</Text>
      <Text style={styles.sub}>
        Loyer, assurances, abonnements — générez la dépense quand c’est joué.
      </Text>
      <RecurringChargesPanel showSectionTitle={false} />
      <View style={styles.footer}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={styles.close}>Fermer</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingHorizontal: screenPaddingH },
  kicker: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.medium,
    color: colors.textMuted,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  title: {
    marginTop: spacing.xs,
    fontSize: fontSize.title,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  sub: {
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    fontSize: fontSize.small,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  footer: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  close: {
    fontSize: fontSize.small,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
});
