import {
  isDateInRangeInclusive,
  monthBoundsISO,
  monthKeyFromDate,
  parseMonthKeyToDate,
} from './dates';

describe('monthBoundsISO', () => {
  it('returns start on first day and end on last day of month', () => {
    const ref = new Date(2026, 2, 15, 12, 0, 0, 0); // March 2026
    const { start, end } = monthBoundsISO(ref);
    expect(start).toBe('2026-03-01');
    expect(end).toBe('2026-03-31');
  });
});

describe('isDateInRangeInclusive', () => {
  it('includes boundaries', () => {
    expect(isDateInRangeInclusive('2026-03-10', '2026-03-01', '2026-03-31')).toBe(
      true
    );
    expect(isDateInRangeInclusive('2026-03-01', '2026-03-01', '2026-03-31')).toBe(
      true
    );
    expect(isDateInRangeInclusive('2026-03-31', '2026-03-01', '2026-03-31')).toBe(
      true
    );
  });

  it('excludes out of range', () => {
    expect(isDateInRangeInclusive('2026-02-28', '2026-03-01', '2026-03-31')).toBe(
      false
    );
    expect(isDateInRangeInclusive('2026-04-01', '2026-03-01', '2026-03-31')).toBe(
      false
    );
  });
});

describe('monthKeyFromDate', () => {
  it('formats YYYY-MM', () => {
    expect(monthKeyFromDate(new Date(2026, 0, 5))).toBe('2026-01');
    expect(monthKeyFromDate(new Date(2026, 11, 31))).toBe('2026-12');
  });
});

describe('parseMonthKeyToDate', () => {
  it('parses valid month keys', () => {
    const d = parseMonthKeyToDate('2026-03');
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(2);
  });

  it('returns null for invalid keys', () => {
    expect(parseMonthKeyToDate('2026-13')).toBeNull();
    expect(parseMonthKeyToDate('bad')).toBeNull();
    expect(parseMonthKeyToDate('2026')).toBeNull();
  });
});
