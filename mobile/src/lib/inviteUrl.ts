import * as Linking from 'expo-linking';

/**
 * URL partagée pour rejoindre un foyer.
 * En production web, définir EXPO_PUBLIC_WEB_APP_URL (ex. https://moneyduo.vercel.app)
 * pour que le lien ouvert sur le téléphone pointe vers la même app.
 */
export function buildInviteUrl (token: string): string {
  const base =
    typeof process !== 'undefined' && process.env.EXPO_PUBLIC_WEB_APP_URL
      ? String(process.env.EXPO_PUBLIC_WEB_APP_URL).replace(/\/$/, '')
      : '';
  if (base.length > 0) {
    try {
      const u = new URL(base);
      u.searchParams.set('token', token);
      return u.toString();
    } catch {
      /* URL invalide : retomber sur le deep link natif */
    }
  }
  return Linking.createURL('invite', {
    scheme: 'moneyduo',
    queryParams: { token },
  });
}
