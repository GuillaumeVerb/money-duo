import type { Goal } from './types';

const STEPS = [25, 50, 75, 100] as const;

/** Prochain palier (pour libellé + montant à afficher avec formatMoney). */
export function getNextGoalMilestone (
  goal: Goal
): { percent: number; amountToNext: number } | null {
  const target = Number(goal.target_amount);
  const current = Number(goal.current_amount);
  if (!(target > 0) || current < 0) {
    return null;
  }
  if (current >= target) {
    return null;
  }
  for (const s of STEPS) {
    const threshold = (target * s) / 100;
    if (current < threshold - 1e-6) {
      return { percent: s, amountToNext: Math.max(0, threshold - current) };
    }
  }
  return null;
}

/** Repères 25 / 50 / 75 / 100 % pour pastilles ou liste. */
export function goalMilestoneSteps (goal: Goal): { percent: number; reached: boolean }[] {
  const target = Number(goal.target_amount);
  const current = Number(goal.current_amount);
  const pct = target > 0 ? (current / target) * 100 : 0;
  return STEPS.map((p) => ({
    percent: p,
    reached: pct >= p - 1e-6,
  }));
}
