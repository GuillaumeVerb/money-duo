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
  if (
    lower.includes ('row-level security') ||
    lower.includes ('rls') ||
    lower.includes ('violates row-level')
  ) {
    return (
      'La base de données a refusé l’action (sécurité). Réessaie après t’être reconnecté·e ; ' +
      'si ça continue, vérifie que les migrations Supabase du dépôt sont bien appliquées sur ton projet.'
    );
  }
  if (
    lower.includes ('rate limit') ||
    lower.includes ('too many requests') ||
    lower.includes ('429') ||
    lower.includes ('over_email_send_rate_limit') ||
    lower.includes ('email rate limit')
  ) {
    return 'Trop de tentatives pour l’instant (protection Supabase). Attends 10 à 15 minutes ou réessaie plus tard.';
  }
  if (m.length > 180) {
    return `${m.slice (0, 177)}…`;
  }
  return m;
}
