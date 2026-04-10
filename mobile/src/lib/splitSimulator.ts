/**
 * Approximation : si tout le total commun du mois était partagé en custom % pour m0.
 * (Les vraies lignes peuvent avoir d’autres règles — c’est un repère de discussion.)
 */
export function hypotheticalCustomShares (
  monthTotalCommun: number,
  percentForFirstMember: number
): { first: number; second: number } {
  const p = Math.min(100, Math.max(0, percentForFirstMember));
  const first = (monthTotalCommun * p) / 100;
  return {
    first,
    second: Math.max(0, monthTotalCommun - first),
  };
}
