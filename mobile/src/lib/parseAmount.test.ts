import { parseAmount } from './parseAmount';

describe('parseAmount', () => {
  it('parses integer and decimal with dot', () => {
    expect(parseAmount('12')).toBe(12);
    expect(parseAmount('12.5')).toBe(12.5);
  });

  it('accepts comma as decimal separator', () => {
    expect(parseAmount('3,14')).toBe(3.14);
  });

  it('trims whitespace', () => {
    expect(parseAmount('  42  ')).toBe(42);
  });

  it('treats empty string as 0 (Number semantics)', () => {
    expect(parseAmount('')).toBe(0);
  });

  it('returns null for non-numeric input', () => {
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('12abc')).toBeNull();
  });
});
