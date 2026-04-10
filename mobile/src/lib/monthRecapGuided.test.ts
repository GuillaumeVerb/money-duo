import { buildGuidedRecapLines } from './monthRecapGuided';

const eur = 'EUR';

describe('buildGuidedRecapLines', () => {
  it('returns fallback when no data', () => {
    const lines = buildGuidedRecapLines({
      currency: eur,
      spentThisMonth: 0,
      spentPrevMonth: null,
      topThis: [],
      topPrev: [],
    });
    expect(lines.length).toBeGreaterThanOrEqual(1);
    expect(lines[0]).toContain('Pas assez de données');
  });

  it('uses total line when no previous month but spent > 0', () => {
    const lines = buildGuidedRecapLines({
      currency: eur,
      spentThisMonth: 120,
      spentPrevMonth: null,
      topThis: [],
      topPrev: [],
    });
    expect(lines.some((l) => l.includes('Total du mois'))).toBe(true);
  });

  it('detects month similar to previous when delta < 4%', () => {
    const lines = buildGuidedRecapLines({
      currency: eur,
      spentThisMonth: 102,
      spentPrevMonth: 100,
      topThis: [],
      topPrev: [],
    });
    expect(lines.some((l) => l.includes('ressemble au précédent'))).toBe(true);
  });

  it('detects higher spend vs previous', () => {
    const lines = buildGuidedRecapLines({
      currency: eur,
      spentThisMonth: 200,
      spentPrevMonth: 100,
      topThis: [],
      topPrev: [],
    });
    expect(lines.some((l) => l.includes('plus haut'))).toBe(true);
  });

  it('detects lower spend vs previous', () => {
    const lines = buildGuidedRecapLines({
      currency: eur,
      spentThisMonth: 80,
      spentPrevMonth: 100,
      topThis: [],
      topPrev: [],
    });
    expect(lines.some((l) => l.includes('plus bas'))).toBe(true);
  });

  it('mentions top category when present', () => {
    const lines = buildGuidedRecapLines({
      currency: eur,
      spentThisMonth: 50,
      spentPrevMonth: null,
      topThis: [{ name: 'Courses', total: 40 }],
      topPrev: [],
    });
    expect(lines.some((l) => l.includes('Courses'))).toBe(true);
    expect(lines.some((l) => l.includes('Poste le plus présent'))).toBe(true);
  });

  it('notes shift when top category differs from previous month', () => {
    const lines = buildGuidedRecapLines({
      currency: eur,
      spentThisMonth: 100,
      spentPrevMonth: 80,
      topThis: [{ name: 'Loisirs', total: 60 }],
      topPrev: [{ name: 'Courses', total: 50 }],
    });
    expect(lines.some((l) => l.includes('Courses'))).toBe(true);
    expect(lines.some((l) => l.includes('priorités bougent'))).toBe(true);
  });

  it('adds shared-heavy line when sharedShare >= 0.55', () => {
    const lines = buildGuidedRecapLines({
      currency: eur,
      spentThisMonth: 100,
      spentPrevMonth: null,
      topThis: [],
      topPrev: [],
      sharedShare: 0.6,
    });
    expect(
      lines.some((l) => l.includes('grande partie part dans le commun'))
    ).toBe(true);
  });

  it('adds goal line for progress between 40 and 95%', () => {
    const lines = buildGuidedRecapLines({
      currency: eur,
      spentThisMonth: 10,
      spentPrevMonth: null,
      topThis: [],
      topPrev: [],
      goalProgress: 0.5,
    });
    expect(lines.some((l) => l.includes('50 %'))).toBe(true);
  });

  it('adds budget comfort when under 85% of cap', () => {
    const lines = buildGuidedRecapLines({
      currency: eur,
      spentThisMonth: 400,
      spentPrevMonth: null,
      topThis: [],
      topPrev: [],
      monthlyBudgetCap: 1000,
    });
    expect(lines.some((l) => l.includes('marge de confort'))).toBe(true);
  });

  it('adds budget over line when above cap', () => {
    const lines = buildGuidedRecapLines({
      currency: eur,
      spentThisMonth: 1200,
      spentPrevMonth: null,
      topThis: [],
      topPrev: [],
      monthlyBudgetCap: 1000,
    });
    expect(lines.some((l) => l.includes('dépassé'))).toBe(true);
  });
});
