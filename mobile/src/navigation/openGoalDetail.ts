import type { Goal } from '../lib/types';

type StackLikeParent = {
  navigate: (
    name: 'GoalDetail',
    params?: { goalId?: string; goalSnapshot?: Goal }
  ) => void;
};

type TabNavigation = {
  getParent?: () => StackLikeParent | undefined;
  navigate?: (
    name: 'GoalDetail',
    params?: { goalId?: string; goalSnapshot?: Goal }
  ) => void;
};

export function openGoalDetail (
  tabScreenNavigation: TabNavigation,
  goalId?: string,
  goalSnapshot?: Goal
) {
  const params = goalId || goalSnapshot ? { goalId, goalSnapshot } : undefined;
  const parent = tabScreenNavigation.getParent?.() as StackLikeParent | undefined;
  if (parent) {
    parent.navigate('GoalDetail', params);
    return;
  }
  // Fallback for contexts where GoalDetail is directly reachable.
  tabScreenNavigation.navigate?.('GoalDetail', params);
}
