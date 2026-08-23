import { getPrivilegedSupabaseClient } from '../config/supabase.js';

const PUBLIC_LISTING_COLUMNS = [
  'id',
  'title',
  'monthly_rent',
  'available_from',
  'minimum_lease_months',
  'maximum_occupants',
  'pets_allowed',
  'published_at',
  'status',
].join(',');

const PUBLIC_PROPERTY_COLUMNS = [
  'id',
  'property_type',
  'district',
  'locality',
  'neighbourhood',
  'bedrooms',
  'bathrooms',
  'furnished',
  'parking_spaces',
  'verification_status',
  'archived_at',
].join(',');

const SAVED_PROJECTION = [
  'listing_id',
  'created_at',
  `listing:listings!inner(${PUBLIC_LISTING_COLUMNS},property:properties!inner(${PUBLIC_PROPERTY_COLUMNS}))`,
].join(',');

export class SavedListingRepositoryError extends Error {
  constructor(reason) {
    super('The saved listing repository operation failed.');
    this.name = 'SavedListingRepositoryError';
    this.reason = reason;
  }
}

function repositoryError(error, fallback) {
  return new SavedListingRepositoryError(
    error?.code === '23505' ? 'DUPLICATE' : fallback,
  );
}

export const savedListingRepository = {
  async createForTenant(tenantId, listingId) {
    const { data, error } = await getPrivilegedSupabaseClient()
      .from('saved_listings')
      .insert({ tenant_id: tenantId, listing_id: listingId })
      .select('listing_id,created_at')
      .single();
    if (error || !data) throw repositoryError(error, 'WRITE_FAILED');
    return data;
  },

  async deleteForTenant(tenantId, listingId) {
    const { error } = await getPrivilegedSupabaseClient()
      .from('saved_listings')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('listing_id', listingId);
    if (error) throw repositoryError(error, 'WRITE_FAILED');
  },

  async isSavedByTenant(tenantId, listingId) {
    const { data, error } = await getPrivilegedSupabaseClient()
      .from('saved_listings')
      .select('listing_id')
      .eq('tenant_id', tenantId)
      .eq('listing_id', listingId)
      .maybeSingle();
    if (error) throw repositoryError(error, 'READ_FAILED');
    return Boolean(data);
  },

  async listForTenant(tenantId, { page, limit }) {
    const first = (page - 1) * limit;
    const { data, error, count } = await getPrivilegedSupabaseClient()
      .from('saved_listings')
      .select(SAVED_PROJECTION, { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .order('listing_id', { ascending: true })
      .range(first, first + limit - 1);
    if (error) throw repositoryError(error, 'READ_FAILED');
    return { saves: data ?? [], total: count ?? 0 };
  },
};
