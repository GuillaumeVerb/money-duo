import type { ExpenseSplitRow } from './balanceTypes';
import { isDateInRangeInclusive, monthBoundsISO } from './dates';
import type { LedgerExpenseRow } from './ledgerCompute';
import type { ExpenseType } from './types';

/** Dépenses du mois courant (hors perso) pour analyse répartition. */
export function filterMonthSharedExpenses (
  expenses: LedgerExpenseRow[]
): LedgerExpenseRow[] {
  const { start, end } = monthBoundsISO();
  return expenses.filter(
    (e) =>
      e.expense_type !== 'personal' &&
      isDateInRangeInclusive(e.spent_at, start, end)
  );
}

/**
 * Montants payés par membre ce mois (hors perso) et parts théoriques (splits).
 */
export function monthPaidAndTheoreticalShare (
  expenses: LedgerExpenseRow[],
  splitsByExpense: Record<string, ExpenseSplitRow[]>,
  memberIds: string[]
): {
  paid: Record<string, number>;
  theoretical: Record<string, number>;
  monthTotal: number;
} {
  const monthExp = filterMonthSharedExpenses(expenses);
  const paid: Record<string, number> = {};
  const theoretical: Record<string, number> = {};
  for (const id of memberIds) {
    paid[id] = 0;
    theoretical[id] = 0;
  }
  let monthTotal = 0;
  for (const e of monthExp) {
    monthTotal += e.amount;
    paid[e.payer_member_id] = (paid[e.payer_member_id] ?? 0) + e.amount;
    const splits = splitsByExpense[e.id] ?? [];
    for (const s of splits) {
      theoretical[s.member_id] =
        (theoretical[s.member_id] ?? 0) + s.amount_due;
    }
  }
  return { paid, theoretical, monthTotal };
}

/** Total dépensé par membre ce mois (tous types), pour transparence. */
export function monthTotalPaidAllTypes (
  expenses: Array<{ amount: number; payer_member_id: string; spent_at: string; expense_type: ExpenseType }>,
  memberIds: string[]
): Record<string, number> {
  const { start, end } = monthBoundsISO();
  const paid: Record<string, number> = {};
  for (const id of memberIds) {
    paid[id] = 0;
  }
  for (const e of expenses) {
    if (!isDateInRangeInclusive(e.spent_at, start, end)) {
      continue;
    }
    paid[e.payer_member_id] =
      (paid[e.payer_member_id] ?? 0) + e.amount;
  }
  return paid;
}
