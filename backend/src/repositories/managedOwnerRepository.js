import { getPrivilegedSupabaseClient } from '../config/supabase.js';
import { AppError } from '../middleware/AppError.js';
const columns =
  'id,name,company,email,phone,address,notes,archived_at,version,created_at,updated_at';
const fail = (error) => {
  if (error)
    throw new AppError({
      statusCode: error.message?.includes('ARCHIVED') ? 409 : 500,
      code: 'OWNER_SAVE_FAILED',
      message: 'Unable to save this owner record. Refresh and try again.',
    });
};
export const managedOwnerRepository = {
  async list(manager, { page, limit, search, archived }) {
    const { data, error } = await getPrivilegedSupabaseClient().rpc(
      'managed_owner_directory',
      {
        p_manager: manager,
        p_page: page,
        p_limit: limit,
        p_search: search ?? null,
        p_archived: archived,
      },
    );
    fail(error);
    return data;
  },
  async get(manager, id) {
    const { data, error } = await getPrivilegedSupabaseClient()
      .from('managed_property_owners')
      .select(columns)
      .eq('property_manager_id', manager)
      .eq('id', id)
      .maybeSingle();
    fail(error);
    return data;
  },
  async create(manager, fields) {
    const { data, error } = await getPrivilegedSupabaseClient()
      .from('managed_property_owners')
      .insert({ ...fields, property_manager_id: manager })
      .select(columns)
      .single();
    fail(error);
    return data;
  },
  async update(manager, id, version, fields) {
    const { data, error } = await getPrivilegedSupabaseClient()
      .from('managed_property_owners')
      .update(fields)
      .eq('property_manager_id', manager)
      .eq('id', id)
      .eq('version', version)
      .is('archived_at', null)
      .select(columns)
      .maybeSingle();
    fail(error);
    return data;
  },
};
