import { Ionicons } from '@expo/vector-icons';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getPrivacyPolicyUrl,
  getSupportEmail,
  getTermsUrl,
} from '../lib/publicConfig';
import { screenPaddingH } from '../theme/screenLayout';
import {
  colors,
  fontSize,
  fontWeight,
  hairline,
  spacing,
} from '../theme/tokens';

type LegalRoute = RouteProp<
  { LegalInfo: { document: 'privacy' | 'terms' } },
  'LegalInfo'
>;

const PRIVACY_BODY = `Dernière mise à jour : indicatif — faites relire par un professionnel avant diffusion large.

1. Responsable du traitement
L’éditeur de Money Duo (vous / votre structure) est responsable des données traitées dans le cadre du service.

2. Données traitées
• Compte : adresse e-mail, identifiant technique.
• Foyer : dépenses, catégories, objectifs, notes et contenus que vous saisissez.
• Données techniques : journaux côté hébergeur (connexions, erreurs) selon la configuration Supabase / hébergeur front.

3. Finalités
Fournir le service (synchronisation du foyer, invitation du partenaire), améliorer la fiabilité et le support.

4. Hébergement
Les données sont stockées chez le prestataire que vous configurez (ex. Supabase / PostgreSQL). La localisation des serveurs dépend du projet choisi.

5. Durée
Conservation tant que le compte et le foyer sont actifs ; suppression possible via la fonction « Supprimer mes données » dans l’app (données applicatives) et demande pour le compte e-mail si besoin.

6. Droits (RGPD)
Accès, rectification, effacement, limitation, opposition, portabilité lorsque applicable. Contact : l’e-mail support indiqué dans l’application.

7. Stats locales
Les statistiques optionnelles « sur l’appareil » décrites dans l’app ne sont pas envoyées à un serveur par cette fonctionnalité.`;

const TERMS_BODY = `Dernière mise à jour : indicatif — faites relire par un professionnel avant diffusion large.

1. Objet
Money Duo est un outil d’aide à l’organisation budgétaire de couple / foyer. Ce n’est pas un conseil financier, fiscal ou juridique.

2. Compte
Vous êtes responsable de la confidentialité de vos identifiants. Toute activité réalisée depuis votre compte est réputée effectuée par vous.

3. Contenu utilisateur
Vous restez propriétaire des données que vous saisissez. Vous garantissez disposer des droits nécessaires pour les enregistrer.

4. Disponibilité
Le service est fourni « en l’état ». Une interruption ou une perte de données ne peut donner lieu à garantie au-delà des obligations légales applicables.

5. Limitation
Dans les limites permises par la loi, la responsabilité de l’éditeur ne couvre pas les dommages indirects ou la perte de données due à une mauvaise configuration ou à un tiers.

6. Résiliation
Vous pouvez cesser d’utiliser le service et demander la suppression des données selon les modalités indiquées dans l’app et la politique de confidentialité.

7. Droit applicable
Précisez ici le droit applicable et le tribunal compétent (ex. droit français, tribunaux de Paris).`;

export function LegalInfoScreen () {
  const insets = useSafeAreaInsets();
  const route = useRoute<LegalRoute>();
  const doc = route.params?.document ?? 'privacy';
  const isPrivacy = doc === 'privacy';
  const title = isPrivacy
    ? 'Confidentialité'
    : 'Conditions d’utilisation';
  const body = isPrivacy ? PRIVACY_BODY : TERMS_BODY;
  const externalUrl = isPrivacy ? getPrivacyPolicyUrl() : getTermsUrl();
  const support = getSupportEmail();

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: spacing.md,
          paddingBottom: insets.bottom + spacing.xxl,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.kicker}>Document type</Text>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.banner}>
        <Ionicons name="alert-circle-outline" size={22} color={colors.textMuted} />
        <Text style={styles.bannerTxt}>
          Texte générique à adapter à votre situation et à faire valider avant une
          ouverture publique large.
        </Text>
      </View>
      {externalUrl.length > 0 ? (
        <Pressable
          onPress={() => void Linking.openURL(externalUrl)}
          style={styles.externalBtn}
        >
          <Text style={styles.externalBtnTxt}>Ouvrir la version en ligne</Text>
          <Ionicons name="open-outline" size={18} color={colors.primary} />
        </Pressable>
      ) : null}
      <Text style={styles.body}>{body}</Text>
      {support.length > 0 ? (
        <View style={styles.contact}>
          <Text style={styles.contactLabel}>Contact</Text>
          <Pressable onPress={() => void Linking.openURL(`mailto:${support}`)}>
            <Text style={styles.contactLink}>{support}</Text>
          </Pressable>
        </View>
      ) : null}
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
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  title: {
    marginTop: spacing.xs,
    fontSize: fontSize.title,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: hairline,
    borderColor: colors.borderLight,
  },
  bannerTxt: {
    flex: 1,
    fontSize: fontSize.small,
    color: colors.textMuted,
    lineHeight: 20,
  },
  externalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
  },
  externalBtnTxt: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.medium,
    color: colors.primary,
  },
  body: {
    marginTop: spacing.xl,
    fontSize: fontSize.small,
    color: colors.text,
    lineHeight: 22,
  },
  contact: {
    marginTop: spacing.xxl,
    paddingTop: spacing.lg,
    borderTopWidth: hairline,
    borderTopColor: colors.borderLight,
  },
  contactLabel: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  contactLink: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.medium,
    color: colors.primary,
  },
});
