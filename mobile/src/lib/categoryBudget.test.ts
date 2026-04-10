import { budgetFollowUpMessage, budgetLevel } from './categoryBudget';

describe('budgetLevel', () => {
  it('returns ok below 80%', () => {
    expect(budgetLevel(79, 100)).toBe('ok');
    expect(budgetLevel(79.9, 100)).toBe('ok');
  });

  it('returns warn between 80% and 100%', () => {
    expect(budgetLevel(80, 100)).toBe('warn');
    expect(budgetLevel(99, 100)).toBe('warn');
  });

  it('returns over at or above cap', () => {
    expect(budgetLevel(100, 100)).toBe('over');
    expect(budgetLevel(120, 100)).toBe('over');
  });
});

describe('budgetFollowUpMessage', () => {
  it('returns null when still ok', () => {
    expect(
      budgetFollowUpMessage({
        categoryName: 'Courses',
        spent: 40,
        monthlyCap: 100,
        currency: 'EUR',
        previousLevel: 'ok',
        newLevel: 'ok',
      })
    ).toBeNull();
  });

  it('announces warn when crossing into warn from ok', () => {
    const m = budgetFollowUpMessage({
      categoryName: 'Courses',
      spent: 85,
      monthlyCap: 100,
      currency: 'EUR',
      previousLevel: 'ok',
      newLevel: 'warn',
    });
    expect(m).toContain('80 %');
    expect(m).toContain('Courses');
  });

  it('announces over when crossing to over', () => {
    const m = budgetFollowUpMessage({
      categoryName: 'Courses',
      spent: 100,
      monthlyCap: 100,
      currency: 'EUR',
      previousLevel: 'warn',
      newLevel: 'over',
    });
    expect(m).toContain('dépassé');
  });
});
