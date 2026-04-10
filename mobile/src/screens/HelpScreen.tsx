import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { screenPaddingH } from '../theme/screenLayout';
import {
  colors,
  fontSize,
  fontWeight,
  hairline,
  spacing,
} from '../theme/tokens';

const FAQ: { q: string; a: string }[] = [
  {
    q: 'Comment supprimer mes données ?',
    a:
      'Réglages → Confiance & données → Supprimer mes données foyer. Cela efface vos foyers et votre profil côté serveur, puis vous déconnecte. En foyer à deux, les règlements où vous figuriez sont retirés et les parts des dépenses sont recalculées pour votre partenaire. La suppression définitive du compte e-mail peut nécessiter une action dans Supabase ou un message au support.',
  },
  {
    q: 'À quoi sert la « règle de partage » ?',
    a:
      'Elle s’applique aux nouvelles dépenses que vous ajoutez. L’historique déjà saisi garde la règle du moment où la dépense a été créée.',
  },
  {
    q: 'Pourquoi « Repère doux » et « Marge » ?',
    a:
      'Le repère est une moyenne récente sur vos dépenses ; la marge est simplement repère − dépensé ce mois-ci. Ce sont des indicateurs, pas des budgets imposés.',
  },
  {
    q: 'Comment exporte-t-on mes données ?',
    a:
      'Réglages → Données → Exporter : un fichier CSV (séparateur point-virgule) est généré et vous pouvez l’enregistrer ou partager via le système.',
  },
  {
    q: 'Que sont les « notifications locales » ?',
    a:
      'Un rappel hebdomadaire discret sur votre téléphone, sans aucun serveur externe. Vous pouvez désactiver l’option à tout moment.',
  },
  {
    q: 'Qu’est-ce que « Stats anonymes locales » ?',
    a:
      'Un journal d’événements enregistré uniquement sur l’appareil, pour comprendre comment vous utilisez l’app. Aucune donnée n’est envoyée à un tiers.',
  },
  {
    q: 'À quoi sert le « contrat léger » ?',
    a:
      'Une page pour noter ensemble ce qui est partagé, ce qui reste perso, et vos intentions — pour s’aligner, pas pour formaliser juridiquement.',
  },
  {
    q: 'Historique mensuel vs récap ?',
    a:
      'L’historique liste un total par mois ; le récap ouvre le détail (catégories, types, mémo) pour le mois choisi.',
  },
];

export function HelpScreen () {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + spacing.md,
          paddingBottom: insets.bottom + spacing.xxl,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <Ionicons name="help-circle-outline" size={40} color={colors.primary} />
        <Text style={styles.title}>Aide & bonnes pratiques</Text>
        <Text style={styles.sub}>
          Réponses courtes pour utiliser Money Duo sereinement.
        </Text>
      </View>

      {FAQ.map((item, i) => (
        <View
          key={i}
          style={[
            styles.block,
            i < FAQ.length - 1 && styles.blockBorder,
          ]}
        >
          <Text style={styles.q}>{item.q}</Text>
          <Text style={styles.a}>{item.a}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingHorizontal: screenPaddingH },
  hero: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    gap: spacing.sm,
  },
  title: {
    fontSize: fontSize.title,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    textAlign: 'center',
  },
  sub: {
    fontSize: fontSize.small,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 320,
  },
  block: {
    paddingVertical: spacing.lg,
  },
  blockBorder: {
    borderBottomWidth: hairline,
    borderBottomColor: colors.borderLight,
  },
  q: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  a: {
    fontSize: fontSize.small,
    color: colors.textSecondary,
    lineHeight: 22,
  },
});
