import type { ExpenseSplitRow } from './balanceTypes';
import { netBalancesFromLedger, type LedgerExpenseRow } from './ledgerCompute';

describe('netBalancesFromLedger', () => {
  it('agrège dépenses partagées et settlements', () => {
    const expenses: LedgerExpenseRow[] = [
      {
        id: 'e1',
        amount: 100,
        payer_member_id: 'a',
        expense_type: 'shared',
        spent_at: '2025-01-01',
        category_id: null,
      },
    ];
    const splits: Record<string, ExpenseSplitRow[]> = {
      e1: [
        { member_id: 'a', amount_due: 50 },
        { member_id: 'b', amount_due: 50 },
      ],
    };
    const nets = netBalancesFromLedger(expenses, splits, [
      { from_member_id: 'b', to_member_id: 'a', amount: 50 },
    ]);
    expect(nets.a).toBe(0);
    expect(nets.b).toBe(0);
  });

  it('ignore les dépenses perso pour le solde mutuel', () => {
    const expenses: LedgerExpenseRow[] = [
      {
        id: 'e1',
        amount: 200,
        payer_member_id: 'a',
        expense_type: 'personal',
        spent_at: '2025-01-01',
        category_id: null,
      },
    ];
    const nets = netBalancesFromLedger(expenses, {}, []);
    expect(nets.a ?? 0).toBe(0);
    expect(nets.b ?? 0).toBe(0);
  });
});
