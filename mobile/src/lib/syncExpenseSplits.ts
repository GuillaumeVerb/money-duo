import { supabase } from './supabase';

/**
 * Re-synchronise les lignes `expense_splits` (RPC serveur).
 * Les triggers DB le font déjà en général ; cet appel sécurise les anciennes bases / edge cases.
 */
export async function syncExpenseSplitsAfterSave (expenseId: string): Promise<void> {
  const { error } = await supabase.rpc('recalculate_expense_splits', {
    _expense_id: expenseId,
  });
  if (error) {
    console.warn('[Money Duo] recalculate_expense_splits:', error.message);
  }
}
