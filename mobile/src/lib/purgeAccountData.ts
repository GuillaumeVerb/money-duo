import { supabase } from './supabase';

/** Efface les données foyer côté serveur (RPC). Voir migration Supabase associée. */
export async function purgeMyAccountHouseholdData (): Promise<void> {
  const { error } = await supabase.rpc('purge_my_account_household_data');
  if (error) {
    throw error;
  }
}
