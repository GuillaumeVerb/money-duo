import { supabase } from './supabase';

/** Enregistre une ligne d’historique (table `goal_contributions` après migration). */
export async function insertGoalContributionRow (
  householdId: string,
  goalId: string,
  amount: number,
  memberId?: string | null
): Promise<boolean> {
  const { error } = await supabase.from('goal_contributions').insert({
    household_id: householdId,
    goal_id: goalId,
    amount,
    ...(memberId ? { member_id: memberId } : {}),
  });
  if (error) {
    console.warn('[Money Duo] goal_contributions:', error.message);
    return false;
  }
  return true;
}
