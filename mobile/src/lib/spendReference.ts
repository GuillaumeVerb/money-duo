/**
 * Moyenne des totaux mensuels sur les N derniers mois calendaires ayant des données.
 */
export function averageRecentMonthlySpend (
  expenses: Array<{ amount: number; spent_at: string }>,
  monthCount = 3
): number | null {
  const byMonth: Record<string, number> = {};
  for (const e of expenses) {
    const m = e.spent_at.slice(0, 7);
    byMonth[m] = (byMonth[m] ?? 0) + e.amount;
  }
  const keys = Object.keys(byMonth).sort().reverse();
  if (keys.length === 0) {
    return null;
  }
  const slice = keys.slice(0, monthCount);
  const sum = slice.reduce((s, k) => s + byMonth[k], 0);
  return Math.round((sum / slice.length) * 100) / 100;
}
