import { buildMonthRecapShareText } from './monthRecapShare';

describe('buildMonthRecapShareText', () => {
  it('includes header, total, count and top categories', () => {
    const text = buildMonthRecapShareText ({
      monthLabel: 'mars 2026',
      currency: 'EUR',
      spent: 100,
      count: 3,
      topCats: [{ name: 'Courses', total: 60 }],
      byType: { shared: 80, personal: 20, child: 0, home: 0 },
    });
    expect(text).toContain('Money Duo — mars 2026');
    expect(text).toContain('Total');
    expect(text).toContain('3 mouvements');
    expect(text).toContain('Courses');
  });

  it('adds type breakdown when non-zero', () => {
    const text = buildMonthRecapShareText ({
      monthLabel: 'janvier 2026',
      currency: 'EUR',
      spent: 50,
      count: 1,
      topCats: [],
      byType: { shared: 50, personal: 0, child: 0, home: 0 },
    });
    expect(text).toContain('Commun');
    expect(text).not.toContain('Perso');
  });
});
