import { formatMoney } from './format';

export type GuidedRecapInput = {
  currency: string;
  spentThisMonth: number;
  spentPrevMonth: number | null;
  topThis: { name: string; total: number }[];
  topPrev: { name: string; total: number }[];
  /** Part des dépenses « commun » vs reste (0–1). */
  sharedShare?: number | null;
  goalProgress?: number | null;
  monthlyBudgetCap?: number | null;
};

/**
 * Phrases courtes, apaisantes — pas de culpabilisation.
 */
export function buildGuidedRecapLines (i: GuidedRecapInput): string[] {
  const lines: string[] = [];

  if (i.spentPrevMonth != null && i.spentPrevMonth > 0) {
    const delta = i.spentThisMonth - i.spentPrevMonth;
    const pct = (delta / i.spentPrevMonth) * 100;
    if (Math.abs(pct) < 4) {
      lines.push(
        `Ce mois ressemble au précédent côté montant (${formatMoney(
          i.spentThisMonth,
          i.currency
        )} au total).`
      );
    } else if (delta > 0) {
      lines.push(
        `Un peu plus haut que le mois dernier (+${formatMoney(
          delta,
          i.currency
        )}) — ce n’est qu’une photo, pas un jugement.`
      );
    } else {
      lines.push(
        `Un peu plus bas que le mois dernier (${formatMoney(
          -delta,
          i.currency
        )} de moins) — respirez, c’est une tendance courte.`
      );
    }
  } else if (i.spentThisMonth > 0) {
    lines.push(
      `Total du mois : ${formatMoney(i.spentThisMonth, i.currency)} — utile pour vous parler à deux sans tableur.`
    );
  }

  const t0 = i.topThis[0];
  const p0 = i.topPrev[0];
  if (t0 && t0.total > 0) {
    lines.push(
      `Poste le plus présent : ${t0.name} (${formatMoney(
        t0.total,
        i.currency
      )}).`
    );
  }
  if (t0 && p0 && t0.name !== p0.name && i.spentPrevMonth && i.spentPrevMonth > 0) {
    lines.push(
      `Le mois dernier, c’était plutôt « ${p0.name} » en tête — les priorités bougent, c’est normal.`
    );
  }

  if (i.sharedShare != null && i.sharedShare >= 0 && i.sharedShare <= 1) {
    if (i.sharedShare >= 0.55) {
      lines.push(
        'Une grande partie part dans le commun ce mois-ci — vous avancez ensemble sur le quotidien partagé.'
      );
    } else if (i.sharedShare <= 0.35 && i.spentThisMonth > 0) {
      lines.push(
        'Beaucoup de lignes hors « commun » ce mois-ci — peut‑être des perso ou enfants : à garder en tête si vous en parlez.'
      );
    }
  }

  if (i.goalProgress != null && i.goalProgress >= 0) {
    const p = Math.round(Math.min(1, i.goalProgress) * 100);
    if (p >= 95) {
      lines.push(
        'Votre objectif principal est quasiment atteint — un beau moment à célébrer tranquillement.'
      );
    } else if (p >= 40) {
      lines.push(
        `L’objectif avance (environ ${p} % de la cible) — chaque petit geste compte.`
      );
    } else if (i.goalProgress > 0) {
      lines.push(
        'L’objectif progresse doucement — pas de sprint nécessaire, juste de la régularité si vous le souhaitez.'
      );
    }
  }

  if (
    i.monthlyBudgetCap != null &&
    i.monthlyBudgetCap > 0 &&
    i.spentThisMonth > 0
  ) {
    const ratio = i.spentThisMonth / i.monthlyBudgetCap;
    if (ratio <= 0.85) {
      lines.push(
        `Vous êtes sous le budget global indicatif (${formatMoney(
          i.monthlyBudgetCap,
          i.currency
        )}) — marge de confort.`
      );
    } else if (ratio <= 1) {
      lines.push(
        'Vous approchez du budget global du mois — un bon moment pour ajuster ensemble si besoin, sans stress.'
      );
    } else {
      lines.push(
        'Le budget global indicatif est dépassé — ce n’est pas une erreur, juste un signal pour en discuter calmement.'
      );
    }
  }

  if (lines.length === 0) {
    lines.push(
      'Pas assez de données pour un commentaire — ajoutez quelques dépenses pour voir une synthèse ici.'
    );
  }

  return lines;
}
