/**
 * Messages d’erreur lisibles pour l’utilisateur (Supabase / réseau).
 */
export function friendlyErrorMessage (e: unknown): string {
  let m: string;
  if (e instanceof Error) {
    m = e.message;
  } else if (
    e !== null &&
    typeof e === 'object' &&
    'message' in e &&
    typeof (e as { message: unknown }).message === 'string'
  ) {
    m = (e as { message: string }).message;
  } else {
    return 'Une erreur est survenue.';
  }
  const lower = m.toLowerCase ();
  if (
    lower.includes ('jwt') ||
    lower.includes ('session') ||
    lower.includes ('auth')
  ) {
    return 'Session expirée ou invalide. Reconnectez-vous.';
  }
  if (
    lower.includes ('network') ||
    lower.includes ('fetch') ||
    lower.includes ('failed to fetch')
  ) {
    return 'Problème de connexion. Vérifiez le réseau et réessayez.';
  }
  if (
    lower.includes ('duplicate') ||
    lower.includes ('unique') ||
    lower.includes ('already exists')
  ) {
    return 'Cette valeur existe déjà.';
  }
  if (lower.includes ('violates foreign key') || lower.includes ('foreign key')) {
    return 'Impossible : des données y sont encore liées.';
  }
  if (m.length > 180) {
    return `${m.slice (0, 177)}…`;
  }
  return m;
}
