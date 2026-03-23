import type { ExpenseSplitRow } from './balanceTypes';
import type { LedgerExpenseRow, SettlementLine } from './ledgerCompute';
export {
  netBalancesFromLedger,
  pairwiseOwedForMembers,
  type LedgerExpenseRow,
  type SettlementLine,
} from './ledgerCompute';
import { supabase } from './supabase';
import type { ExpenseType, Settlement } from './types';

export async function fetchSettlementsFull (
  householdId: string
): Promise<Settlement[]> {
  const { data, error } = await supabase
    .from ('settlements')
    .select ('*')
    .eq ('household_id', householdId)
    .order ('settled_at', { ascending: false });

  if (error) {
    throw error;
  }
  return (data ?? []) as Settlement[];
}

export async function fetchLedgerExpenseRows (
  householdId: string
): Promise<LedgerExpenseRow[]> {
  const { data, error } = await supabase
    .from ('expenses')
    .select (
      'id, amount, payer_member_id, expense_type, spent_at, category_id'
    )
    .eq ('household_id', householdId)
    .order ('spent_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map ((row) => ({
    id: row.id as string,
    amount: Number (row.amount),
    payer_member_id: row.payer_member_id as string,
    expense_type: row.expense_type as ExpenseType,
    spent_at: String (row.spent_at).slice (0, 10),
    category_id: (row.category_id as string | null) ?? null,
  }));
}

export async function fetchSplitsByExpenseIds (
  expenseIds: string[]
): Promise<Record<string, ExpenseSplitRow[]>> {
  const map: Record<string, ExpenseSplitRow[]> = {};
  if (expenseIds.length === 0) {
    return map;
  }

  const { data, error } = await supabase
    .from ('expense_splits')
    .select ('expense_id, member_id, amount_due')
    .in ('expense_id', expenseIds);

  if (error) {
    throw error;
  }

  for (const row of data ?? []) {
    const eid = row.expense_id as string;
    if (!map[eid]) {
      map[eid] = [];
    }
    map[eid].push ({
      member_id: row.member_id as string,
      amount_due: Number (row.amount_due),
    });
  }
  return map;
}

export async function fetchSettlementLines (
  householdId: string
): Promise<SettlementLine[]> {
  const { data, error } = await supabase
    .from ('settlements')
    .select ('from_member_id, to_member_id, amount')
    .eq ('household_id', householdId);

  if (error) {
    throw error;
  }

  return (data ?? []).map ((s) => ({
    from_member_id: s.from_member_id as string,
    to_member_id: s.to_member_id as string,
    amount: Number (s.amount),
  }));
}
