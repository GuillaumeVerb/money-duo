import type { Goal } from './types';

/** Mensualité indicative pour atteindre la cible à la date indiquée. */
export function suggestedMonthlyContribution (goal: Goal): number | null {
  if (!goal.target_date) {
    return null;
  }
  const end = new Date(goal.target_date + 'T12:00:00');
  const now = new Date();
  if (end <= now) {
    return null;
  }
  const months =
    (end.getFullYear() - now.getFullYear()) * 12 +
    (end.getMonth() - now.getMonth());
  const m = Math.max(1, months);
  const remaining =
    Number(goal.target_amount) - Number(goal.current_amount);
  if (remaining <= 0) {
    return 0;
  }
  return Math.ceil((remaining / m) * 100) / 100;
}

export function daysUntilTarget (goal: Goal): number | null {
  if (!goal.target_date) {
    return null;
  }
  const end = new Date(goal.target_date + 'T12:00:00');
  const now = new Date();
  const d = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, d);
}
