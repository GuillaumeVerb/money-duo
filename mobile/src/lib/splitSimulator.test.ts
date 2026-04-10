import { hypotheticalCustomShares } from './splitSimulator';

describe('hypotheticalCustomShares', () => {
  it('splits 50/50 by default mid-range', () => {
    const r = hypotheticalCustomShares(200, 50);
    expect(r.first).toBe(100);
    expect(r.second).toBe(100);
  });

  it('clamps percent to 0–100', () => {
    expect(hypotheticalCustomShares(100, -10).first).toBe(0);
    expect(hypotheticalCustomShares(100, 150).first).toBe(100);
  });

  it('handles zero total', () => {
    const r = hypotheticalCustomShares(0, 60);
    expect(r.first).toBe(0);
    expect(r.second).toBe(0);
  });
});
