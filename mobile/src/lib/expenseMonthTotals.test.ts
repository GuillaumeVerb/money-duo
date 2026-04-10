import {
  monthKeysDescending,
  topCategoriesInMonth,
  totalsByMonthKey,
  totalSpentInMonth,
} from './expenseMonthTotals';

describe('totalsByMonthKey', () => {
  it('aggregates by YYYY-MM from spent_at', () => {
    const map = totalsByMonthKey([
      { amount: 10, spent_at: '2026-03-05' },
      { amount: 20, spent_at: '2026-03-15' },
      { amount: 5, spent_at: '2026-02-01' },
    ]);
    expect(map['2026-03']).toBe(30);
    expect(map['2026-02']).toBe(5);
  });

  it('ignores invalid month keys', () => {
    const map = totalsByMonthKey([
      { amount: 1, spent_at: 'bad' },
      { amount: 2, spent_at: '20260301' },
    ]);
    expect(Object.keys(map).length).toBe(0);
  });
});

describe('totalSpentInMonth', () => {
  it('sums only rows in civil month', () => {
    const ref = new Date(2026, 2, 1, 12, 0, 0, 0);
    const rows = [
      { amount: 10, spent_at: '2026-03-01' },
      { amount: 5, spent_at: '2026-03-31' },
      { amount: 99, spent_at: '2026-02-28' },
      { amount: 1, spent_at: '2026-04-01' },
    ];
    expect(totalSpentInMonth(rows, ref)).toBe(15);
  });
});

describe('topCategoriesInMonth', () => {
  it('groups by catName and sorts by total', () => {
    const ref = new Date(2026, 0, 1, 12, 0, 0, 0);
    const catName = (id: string | null) =>
      id === 'a' ? 'A' : id === 'b' ? 'B' : 'Sans';
    const rows = [
      { amount: 30, spent_at: '2026-01-10', category_id: 'b' },
      { amount: 50, spent_at: '2026-01-11', category_id: 'a' },
      { amount: 10, spent_at: '2026-01-12', category_id: 'a' },
    ];
    const top = topCategoriesInMonth(rows, ref, catName);
    expect(top[0]).toEqual({ name: 'A', total: 60 });
    expect(top[1]).toEqual({ name: 'B', total: 30 });
  });
});

describe('monthKeysDescending', () => {
  it('returns count keys in YYYY-MM form', () => {
    const keys = monthKeysDescending(3);
    expect(keys).toHaveLength(3);
    for (const k of keys) {
      expect(k).toMatch(/^\d{4}-\d{2}$/);
    }
  });
});
