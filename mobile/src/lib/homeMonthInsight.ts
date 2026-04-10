export type MonthPulse = 'ok' | 'watch' | 'tight';

/**
 * Synthèse légère (heuristique) — ton apaisant, non culpabilisant.
 */
export function monthInsight ({
  spent,
  monthlyGuide,
  owedAbs,
  topCategoryShare,
}: {
  spent: number;
  monthlyGuide: number | null;
  owedAbs: number;
  /** Part du top poste dans le mois (0–1), si connu */
  topCategoryShare?: number;
}): { pulse: MonthPulse; message: string } {
  const hasGuide = monthlyGuide != null && monthlyGuide > 0;
  const ratio = hasGuide ? spent / monthlyGuide! : null;

  if (ratio != null && ratio > 0.95) {
    return {
      pulse: 'tight',
      message:
        'Le mois est chargé — un œil bienveillant sur les prochains jours suffit.',
    };
  }

  if (ratio != null && ratio > 0.78) {
    return {
      pulse: 'watch',
      message:
        'Vous avancez sereinement ; quelques ajustements peuvent garder le cap.',
    };
  }

  if (topCategoryShare != null && topCategoryShare > 0.45 && spent > 400) {
    return {
      pulse: 'watch',
      message:
        'Une catégorie pèse un peu plus ce mois-ci — rien d’alarmant, juste à noter.',
    };
  }

  if (owedAbs > 120) {
    return {
      pulse: 'watch',
      message:
        'Un petit écart à l’équilibre — un rappel doux pour plus tard.',
    };
  }

  if (ratio != null && ratio < 0.55) {
    return {
      pulse: 'ok',
      message: 'Mois sous contrôle — vous gardez de la marge pour respirer.',
    };
  }

  return {
    pulse: 'ok',
    message: 'Vous êtes dans un bon rythme pour votre foyer.',
  };
}
