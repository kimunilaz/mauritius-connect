import { getPrivilegedSupabaseClient } from '../config/supabase.js';

const COLUMNS =
  'id,application_id,start_time,end_time,status,notes,created_at,updated_at';

export const viewingRepository = {
  async listForApplication(applicationId) {
    const { data, error } = await getPrivilegedSupabaseClient()
      .from('viewings')
      .select(COLUMNS)
      .eq('application_id', applicationId)
      .order('start_time', { ascending: false })
      .order('id', { ascending: false });
    if (error) throw new Error('Viewing read failed.');
    return data ?? [];
  },

  async findById(viewingId) {
    const { data, error } = await getPrivilegedSupabaseClient()
      .from('viewings')
      .select(COLUMNS)
      .eq('id', viewingId)
      .maybeSingle();
    if (error) throw new Error('Viewing read failed.');
    return data;
  },

  async propose(fields) {
    const { data, error } = await getPrivilegedSupabaseClient().rpc(
      'propose_viewing_transaction',
      fields,
    );
    if (error) throw new Error('Viewing proposal transaction failed.');
    return Array.isArray(data) ? data[0] : data;
  },

  async transition(fields) {
    const { data, error } = await getPrivilegedSupabaseClient().rpc(
      'transition_viewing_transaction',
      fields,
    );
    if (error) throw new Error('Viewing transition transaction failed.');
    return Array.isArray(data) ? data[0] : data;
  },
};
