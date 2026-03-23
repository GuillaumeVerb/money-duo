import {
  aggregateMemberNets,
  applySettlements,
  memberNetFromExpense,
  pairwiseOwed,
} from './balance';

describe('memberNetFromExpense', () => {
  it('splits 50/50 when payer is A', () => {
    const n = memberNetFromExpense(
      { amount: 100, payer_member_id: 'a' },
      [
        { member_id: 'a', amount_due: 50 },
        { member_id: 'b', amount_due: 50 },
      ]
    );
    expect(n.a).toBe(50);
    expect(n.b).toBe(-50);
  });
});

describe('aggregateMemberNets + settlements', () => {
  it('règle le déséquilibre avec un settlement', () => {
    const nets = aggregateMemberNets([
      {
        expense: { amount: 100, payer_member_id: 'a' },
        splits: [
          { member_id: 'a', amount_due: 50 },
          { member_id: 'b', amount_due: 50 },
        ],
      },
    ]);
    expect(nets.a).toBe(50);
    expect(nets.b).toBe(-50);
    const after = applySettlements(nets, [
      { from_member_id: 'b', to_member_id: 'a', amount: 50 },
    ]);
    expect(after.a).toBe(0);
    expect(after.b).toBe(0);
  });
});

describe('pairwiseOwed', () => {
  it('retourne le net du premier membre', () => {
    const nets = { a: 20, b: -20 };
    expect(pairwiseOwed('a', 'b', nets)).toBe(20);
  });
});
