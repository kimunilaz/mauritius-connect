import { getPrivilegedSupabaseClient } from '../config/supabase.js';
export const applicationAcceptanceRepository = {
  async accept(landlordUserId, applicationId) {
    const { data, error } = await getPrivilegedSupabaseClient().rpc(
      'accept_application_transaction',
      { p_landlord: landlordUserId, p_application: applicationId },
    );
    if (error) throw Error('acceptance failed');
    return data?.[0];
  },
};
