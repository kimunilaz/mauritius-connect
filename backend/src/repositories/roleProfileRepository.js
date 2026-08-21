import { getPrivilegedSupabaseClient } from '../config/supabase.js';

const TENANT_COLUMNS = [
  'id',
  'occupation_type',
  'employer_or_school',
  'income_range',
  'preferred_move_date',
  'preferred_lease_duration_months',
  'number_of_occupants',
  'has_pets',
  'bio',
].join(',');
const LANDLORD_COLUMNS = 'id,verification_status';
const LOCATION_COLUMNS = 'id,district,locality,neighbourhood';

export class RoleProfileRepositoryError extends Error {
  constructor(reason) {
    super('The role profile repository operation failed.');
    this.name = 'RoleProfileRepositoryError';
    this.reason = reason;
  }
}

function repositoryError(error, fallback) {
  return new RoleProfileRepositoryError(
    error?.code === '23505' ? 'DUPLICATE' : fallback,
  );
}

export const tenantProfileRepository = {
  async findByUserId(userId) {
    const { data, error } = await getPrivilegedSupabaseClient()
      .from('tenant_profiles')
      .select(TENANT_COLUMNS)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw repositoryError(error, 'READ_FAILED');
    return data;
  },

  async create(userId) {
    const { data, error } = await getPrivilegedSupabaseClient()
      .from('tenant_profiles')
      .insert({ user_id: userId })
      .select(TENANT_COLUMNS)
      .single();
    if (error || !data) throw repositoryError(error, 'WRITE_FAILED');
    return data;
  },

  async update(userId, fields) {
    const { data, error } = await getPrivilegedSupabaseClient()
      .from('tenant_profiles')
      .update(fields)
      .eq('user_id', userId)
      .select(TENANT_COLUMNS)
      .single();
    if (error || !data) throw repositoryError(error, 'WRITE_FAILED');
    return data;
  },
};

export const landlordProfileRepository = {
  async findByUserId(userId) {
    const { data, error } = await getPrivilegedSupabaseClient()
      .from('landlord_profiles')
      .select(LANDLORD_COLUMNS)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw repositoryError(error, 'READ_FAILED');
    return data;
  },

  async create(userId) {
    const { data, error } = await getPrivilegedSupabaseClient()
      .from('landlord_profiles')
      .insert({ user_id: userId })
      .select(LANDLORD_COLUMNS)
      .single();
    if (error || !data) throw repositoryError(error, 'WRITE_FAILED');
    return data;
  },
};

export const preferredLocationRepository = {
  async list(tenantProfileId) {
    const { data, error } = await getPrivilegedSupabaseClient()
      .from('tenant_preferred_locations')
      .select(LOCATION_COLUMNS)
      .eq('tenant_profile_id', tenantProfileId)
      .order('created_at', { ascending: true });
    if (error) throw repositoryError(error, 'READ_FAILED');
    return data;
  },

  async create(tenantProfileId, location) {
    const { data, error } = await getPrivilegedSupabaseClient()
      .from('tenant_preferred_locations')
      .insert({ tenant_profile_id: tenantProfileId, ...location })
      .select(LOCATION_COLUMNS)
      .single();
    if (error || !data) throw repositoryError(error, 'WRITE_FAILED');
    return data;
  },

  async deleteOwned(tenantProfileId, locationId) {
    const { data, error } = await getPrivilegedSupabaseClient()
      .from('tenant_preferred_locations')
      .delete()
      .eq('id', locationId)
      .eq('tenant_profile_id', tenantProfileId)
      .select('id')
      .maybeSingle();
    if (error) throw repositoryError(error, 'WRITE_FAILED');
    return Boolean(data);
  },
};
