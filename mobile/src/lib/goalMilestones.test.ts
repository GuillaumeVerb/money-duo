import { getNextGoalMilestone, goalMilestoneSteps } from './goalMilestones';
import type { Goal } from './types';

function g (partial: Partial<Goal> & Pick<Goal, 'target_amount' | 'current_amount'>): Goal {
  return {
    id: '1',
    household_id: 'h',
    name: 'Test',
    target_date: null,
    ...partial,
  } as Goal;
}

describe('getNextGoalMilestone', () => {
  it('returns 25% when at 0', () => {
    const r = getNextGoalMilestone(g({ target_amount: 1000, current_amount: 0 }));
    expect(r).toEqual({ percent: 25, amountToNext: 250 });
  });

  it('returns null when target reached', () => {
    expect(
      getNextGoalMilestone(g({ target_amount: 100, current_amount: 100 }))
    ).toBeNull();
  });

  it('skips passed thresholds', () => {
    const r = getNextGoalMilestone(g({ target_amount: 1000, current_amount: 260 }));
    expect(r?.percent).toBe(50);
  });
});

describe('goalMilestoneSteps', () => {
  it('marks reached steps', () => {
    const steps = goalMilestoneSteps(g({ target_amount: 100, current_amount: 30 }));
    expect(steps.find((s) => s.percent === 25)?.reached).toBe(true);
    expect(steps.find((s) => s.percent === 50)?.reached).toBe(false);
  });
});
