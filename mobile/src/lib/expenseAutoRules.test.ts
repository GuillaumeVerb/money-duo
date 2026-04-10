import {
  matchExpenseAutoRule,
  type ExpenseAutoRule,
} from './expenseAutoRules';

describe('matchExpenseAutoRule', () => {
  const rules: ExpenseAutoRule[] = [
    { id: '1', keyword: 'carrefour', category_id: 'cat-a' },
    { id: '2', keyword: 'pharma', category_id: 'cat-b' },
  ];

  it('returns null for empty note', () => {
    expect(matchExpenseAutoRule('', rules)).toBeNull();
    expect(matchExpenseAutoRule('   ', rules)).toBeNull();
  });

  it('matches first rule in list (substring, case insensitive)', () => {
    expect(matchExpenseAutoRule('Courses Carrefour dimanche', rules)).toBe(
      'cat-a'
    );
    expect(matchExpenseAutoRule('CARREFOUR', rules)).toBe('cat-a');
  });

  it('matches second rule when first does not apply', () => {
    expect(matchExpenseAutoRule('Pharmacie urgence', rules)).toBe('cat-b');
  });

  it('returns null when no keyword matches', () => {
    expect(matchExpenseAutoRule('Restaurant', rules)).toBeNull();
  });
});
