import { aggregateMemberNets, applySettlements, pairwiseOwed } from './balance';
import type { ExpenseSplitRow } from './balanceTypes';
import type { ExpenseType } from './types';

/** Ligne dépense minimale pour le calcul de solde (tout l’historique pertinent). */
export type LedgerExpenseRow = {
  id: string;
  amount: number;
  payer_member_id: string;
  expense_type: ExpenseType;
  spent_at: string;
  category_id: string | null;
};

export type SettlementLine = {
  from_member_id: string;
  to_member_id: string;
  amount: number;
};

/** Soldes nets par membre après dépenses (hors perso) + régularisations. */
export function netBalancesFromLedger (
  expenses: LedgerExpenseRow[],
  splitsByExpense: Record<string, ExpenseSplitRow[]>,
  settlements: SettlementLine[]
): Record<string, number> {
  const items = expenses
    .filter ((e) => e.expense_type !== 'personal')
    .map ((e) => ({
      expense: {
        amount: e.amount,
        payer_member_id: e.payer_member_id,
      },
      splits: splitsByExpense[e.id] ?? [],
    }));

  let nets = aggregateMemberNets (items);
  nets = applySettlements (nets, settlements);
  return nets;
}

/** Écart à deux : solde algébrique du premier membre (convention `pairwiseOwed`). */
export function pairwiseOwedForMembers (
  memberIdsOrdered: string[],
  nets: Record<string, number>
): number {
  const m0 = memberIdsOrdered[0];
  const m1 = memberIdsOrdered[1];
  if (!m0) {
    return 0;
  }
  if (!m1) {
    return nets[m0] ?? 0;
  }
  return pairwiseOwed (m0, m1, nets);
}
