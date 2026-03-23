import type { ExpenseSplitRow, Settlement } from './balanceTypes';

export type { ExpenseSplitRow };

export type ExpenseForBalance = {
  amount: number;
  payer_member_id: string;
};

/**
 * Net par membre pour une dépense : payé (si payeur) − part due (R-05).
 */
export function memberNetFromExpense (
  expense: ExpenseForBalance,
  splits: ExpenseSplitRow[]
): Record<string, number> {
  const net: Record<string, number> = {};
  const payer = expense.payer_member_id;
  for (const s of splits) {
    const paid = s.member_id === payer ? expense.amount : 0;
    net[s.member_id] = paid - s.amount_due;
  }
  return net;
}

export function aggregateMemberNets (
  items: { expense: ExpenseForBalance; splits: ExpenseSplitRow[] }[]
): Record<string, number> {
  const acc: Record<string, number> = {};
  for (const it of items) {
    const partial = memberNetFromExpense(it.expense, it.splits);
    for (const [k, v] of Object.entries(partial)) {
      acc[k] = (acc[k] ?? 0) + v;
    }
  }
  return acc;
}

/** Transfert d’argent : `from_member` paie `to_member` (réduit le déséquilibre). */
export function applySettlements (
  nets: Record<string, number>,
  settlements: Pick<Settlement, 'from_member_id' | 'to_member_id' | 'amount'>[]
): Record<string, number> {
  const out = { ...nets };
  for (const s of settlements) {
    out[s.from_member_id] = (out[s.from_member_id] ?? 0) + s.amount;
    out[s.to_member_id] = (out[s.to_member_id] ?? 0) - s.amount;
  }
  return out;
}

/** À deux : solde algébrique du premier membre (= ce que le second doit au premier si > 0). */
export function pairwiseOwed (memberA: string, memberB: string, nets: Record<string, number>): number {
  void memberB;
  return nets[memberA] ?? 0;
}
