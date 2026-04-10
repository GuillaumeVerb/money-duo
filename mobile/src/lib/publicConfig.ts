/**
 * Variables publiques (build) : support, liens légaux hébergés ailleurs.
 */

import Constants from 'expo-constants';

function readEnv (key: string): string {
  if (typeof process !== 'undefined' && process.env[key]) {
    return String(process.env[key]).trim();
  }
  return '';
}

const extra = Constants.expoConfig?.extra as
  | {
      supportEmail?: string;
      privacyPolicyUrl?: string;
      termsUrl?: string;
    }
  | undefined;

/** E-mail support (mailto). Optionnel : sans valeur, l’UI masque ou désactive le lien. */
export function getSupportEmail (): string {
  return String(extra?.supportEmail ?? readEnv('EXPO_PUBLIC_SUPPORT_EMAIL')).trim();
}

/** URL optionnelle vers une politique de confidentialité hébergée (sinon écran in-app). */
export function getPrivacyPolicyUrl (): string {
  return String(
    extra?.privacyPolicyUrl ?? readEnv('EXPO_PUBLIC_PRIVACY_POLICY_URL')
  ).trim();
}

/** URL optionnelle vers des CGU hébergées (sinon écran in-app). */
export function getTermsUrl (): string {
  return String(extra?.termsUrl ?? readEnv('EXPO_PUBLIC_TERMS_URL')).trim();
}
