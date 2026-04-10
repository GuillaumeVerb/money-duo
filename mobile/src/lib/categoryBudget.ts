import { formatMoney } from './format';

export type BudgetLevel = 'ok' | 'warn' | 'over';

/** Compare les dépenses cumulées du mois au plafond (80 % = alerte douce). */
export function budgetLevel (spent: number, monthlyCap: number): BudgetLevel {
  if (
    monthlyCap <= 0 ||
    !Number.isFinite(spent) ||
    !Number.isFinite(monthlyCap)
  ) {
    return 'ok';
  }
  const ratio = spent / monthlyCap;
  if (ratio >= 1) {
    return 'over';
  }
  if (ratio >= 0.8) {
    return 'warn';
  }
  return 'ok';
}

export function budgetFollowUpMessage (opts: {
  categoryName: string;
  spent: number;
  monthlyCap: number;
  currency: string;
  previousLevel: BudgetLevel;
  newLevel: BudgetLevel;
}): string | null {
  if (opts.newLevel === 'ok') {
    return null;
  }
  if (opts.previousLevel === opts.newLevel && opts.newLevel !== 'over') {
    return null;
  }
  const { categoryName, spent, monthlyCap, currency, newLevel } = opts;
  const s = formatMoney(spent, currency);
  const c = formatMoney(monthlyCap, currency);
  if (newLevel === 'over') {
    return `${categoryName} : budget dépassé (${s} / ${c}).`;
  }
  return `${categoryName} : plus de 80 % du budget utilisé (${s} / ${c}).`;
}
