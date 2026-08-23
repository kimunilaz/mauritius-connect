import { getPrivilegedSupabaseClient } from '../config/supabase.js';

const APPLICATION_COLUMNS = [
  'id',
  'listing_id',
  'tenant_id',
  'move_in_date',
  'requested_lease_duration_months',
  'number_of_occupants',
  'introductory_message',
  'status',
  'submitted_at',
  'withdrawn_at',
  'created_at',
  'updated_at',
].join(',');

export class ApplicationRepositoryError extends Error {
  constructor(reason) {
    super('The rental application repository operation failed.');
    this.name = 'ApplicationRepositoryError';
    this.reason = reason;
  }
}

function failure(error, fallback) {
  return new ApplicationRepositoryError(
    error?.code === '23505' ? 'DUPLICATE' : fallback,
  );
}

export const applicationRepository = {
  async listForTenant(tenantId, { page, limit, status }) {
    const first = (page - 1) * limit;
    let query = getPrivilegedSupabaseClient()
      .from('applications')
      .select(APPLICATION_COLUMNS, { count: 'exact' })
      .eq('tenant_id', tenantId);
    if (status) query = query.eq('status', status);
    const { data, error, count } = await query
      .order('updated_at', { ascending: false })
      .order('id', { ascending: false })
      .range(first, first + limit - 1);
    if (error) throw failure(error, 'READ_FAILED');
    return { applications: data ?? [], total: count ?? 0 };
  },

  async listForLandlordListing(listingId, { page, limit, status }) {
    const first = (page - 1) * limit;
    let query = getPrivilegedSupabaseClient()
      .from('applications')
      .select(APPLICATION_COLUMNS, { count: 'exact' })
      .eq('listing_id', listingId)
      .neq('status', 'DRAFT');
    if (status) query = query.eq('status', status);
    const { data, error, count } = await query
      .order('submitted_at', { ascending: false })
      .order('id', { ascending: false })
      .range(first, first + limit - 1);
    if (error) throw failure(error, 'READ_FAILED');
    return { applications: data ?? [], total: count ?? 0 };
  },

  async findByListingAndTenant(listingId, tenantId) {
    const { data, error } = await getPrivilegedSupabaseClient()
      .from('applications')
      .select(APPLICATION_COLUMNS)
      .eq('listing_id', listingId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (error) throw failure(error, 'READ_FAILED');
    return data;
  },

  async findByIdAndTenant(applicationId, tenantId) {
    const { data, error } = await getPrivilegedSupabaseClient()
      .from('applications')
      .select(APPLICATION_COLUMNS)
      .eq('id', applicationId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (error) throw failure(error, 'READ_FAILED');
    return data;
  },

  async findVisibleById(applicationId) {
    const { data, error } = await getPrivilegedSupabaseClient()
      .from('applications')
      .select(APPLICATION_COLUMNS)
      .eq('id', applicationId)
      .neq('status', 'DRAFT')
      .maybeSingle();
    if (error) throw failure(error, 'READ_FAILED');
    return data;
  },

  async createDraft(fields) {
    const { data, error } = await getPrivilegedSupabaseClient()
      .from('applications')
      .insert({
        ...fields,
        status: 'DRAFT',
        submitted_at: null,
        withdrawn_at: null,
      })
      .select(APPLICATION_COLUMNS)
      .single();
    if (error || !data) throw failure(error, 'WRITE_FAILED');
    return data;
  },

  async updateOwnedDraft(applicationId, tenantId, fields) {
    const { data, error } = await getPrivilegedSupabaseClient()
      .from('applications')
      .update(fields)
      .eq('id', applicationId)
      .eq('tenant_id', tenantId)
      .eq('status', 'DRAFT')
      .is('submitted_at', null)
      .select(APPLICATION_COLUMNS)
      .maybeSingle();
    if (error) throw failure(error, 'WRITE_FAILED');
    return data;
  },

  async listHistory(applicationId) {
    const { data, error } = await getPrivilegedSupabaseClient()
      .from('application_status_history')
      .select('from_status,to_status,created_at')
      .eq('application_id', applicationId)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true });
    if (error) throw failure(error, 'READ_FAILED');
    return data ?? [];
  },
};
