import { isDateInRangeInclusive, monthBoundsISO, monthKeyFromDate } from './dates';

export type MonthSpendRow = { amount: number; spent_at: string };

/** Agrège les montants par clé mois `YYYY-MM`. */
export function totalsByMonthKey (rows: MonthSpendRow[]): Record<string, number> {
  const acc: Record<string, number> = {};
  for (const r of rows) {
    const k = String(r.spent_at).slice(0, 7);
    if (k.length !== 7 || k[4] !== '-') {
      continue;
    }
    acc[k] = (acc[k] ?? 0) + Number(r.amount);
  }
  return acc;
}

/** Total dépensé sur un mois civil donné (Date au 1er du mois). */
export function totalSpentInMonth (
  rows: MonthSpendRow[],
  monthRef: Date
): number {
  const { start, end } = monthBoundsISO(monthRef);
  return rows.reduce((s, r) => {
    const d = String(r.spent_at).slice(0, 10);
    return isDateInRangeInclusive(d, start, end) ? s + Number(r.amount) : s;
  }, 0);
}

/** Top catégories pour un mois (sommes par libellé). */
export function topCategoriesInMonth (
  rows: { amount: number; spent_at: string; category_id: string | null }[],
  monthRef: Date,
  catName: (id: string | null) => string
): { name: string; total: number }[] {
  const { start, end } = monthBoundsISO(monthRef);
  const map: Record<string, number> = {};
  for (const r of rows) {
    const d = String(r.spent_at).slice(0, 10);
    if (!isDateInRangeInclusive(d, start, end)) {
      continue;
    }
    const n = catName(r.category_id);
    map[n] = (map[n] ?? 0) + Number(r.amount);
  }
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, total]) => ({ name, total }));
}

export function monthKeysDescending (count: number): string[] {
  const out: string[] = [];
  const d = new Date();
  d.setDate(1);
  d.setHours(12, 0, 0, 0);
  for (let i = 0; i < count; i++) {
    out.push(monthKeyFromDate(d));
    d.setMonth(d.getMonth() - 1);
  }
  return out;
}
