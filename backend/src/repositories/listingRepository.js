import { getPrivilegedSupabaseClient } from '../config/supabase.js';

const LISTING_COLUMNS = [
  'id',
  'property_id',
  'title',
  'description',
  'monthly_rent',
  'deposit_amount',
  'available_from',
  'minimum_lease_months',
  'maximum_occupants',
  'pets_allowed',
  'status',
  'published_at',
  'closed_at',
  'created_at',
  'updated_at',
].join(',');

const PROPERTY_COLUMNS = [
  'id',
  'landlord_id',
  'property_type',
  'district',
  'locality',
  'bedrooms',
  'bathrooms',
  'furnished',
  'parking_spaces',
  'verification_status',
  'archived_at',
].join(',');

const WITH_PROPERTY = `${LISTING_COLUMNS},property:properties!inner(${PROPERTY_COLUMNS})`;
const LIVE_STATUSES = ['PENDING_REVIEW', 'ACTIVE', 'PAUSED'];

export class ListingRepositoryError extends Error {
  constructor(reason) {
    super('The listing repository operation failed.');
    this.name = 'ListingRepositoryError';
    this.reason = reason;
  }
}

function failure(reason) {
  return new ListingRepositoryError(reason);
}

function writeFailure(error) {
  if (
    error?.code === '23505' &&
    `${error.message ?? ''} ${error.details ?? ''}`.includes(
      'listings_one_live_per_property_idx',
    )
  ) {
    return failure('LIVE_LISTING_CONFLICT');
  }
  return failure('WRITE_FAILED');
}

export const listingRepository = {
  async create(input) {
    const { data, error } = await getPrivilegedSupabaseClient()
      .from('listings')
      .insert(input)
      .select(WITH_PROPERTY)
      .single();
    if (error || !data) throw writeFailure(error);
    return data;
  },

  async listForLandlord(landlordId, { page, limit, status }) {
    const first = (page - 1) * limit;
    let query = getPrivilegedSupabaseClient()
      .from('listings')
      .select(WITH_PROPERTY, { count: 'exact' })
      .eq('property.landlord_id', landlordId);
    if (status) query = query.eq('status', status);
    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(first, first + limit - 1);
    if (error) throw failure('READ_FAILED');
    return { listings: data, total: count ?? 0 };
  },

  async findByIdForLandlord(listingId, landlordId) {
    const { data, error } = await getPrivilegedSupabaseClient()
      .from('listings')
      .select(WITH_PROPERTY)
      .eq('id', listingId)
      .eq('property.landlord_id', landlordId)
      .maybeSingle();
    if (error) throw failure('READ_FAILED');
    return data;
  },

  async updateExpected(listingId, propertyId, expectedStatus, fields) {
    const { data, error } = await getPrivilegedSupabaseClient()
      .from('listings')
      .update(fields)
      .eq('id', listingId)
      .eq('property_id', propertyId)
      .eq('status', expectedStatus)
      .select(WITH_PROPERTY)
      .maybeSingle();
    if (error) throw writeFailure(error);
    return data;
  },

  async findOtherLiveForProperty(propertyId, excludedListingId) {
    let query = getPrivilegedSupabaseClient()
      .from('listings')
      .select('id,status')
      .eq('property_id', propertyId)
      .in('status', LIVE_STATUSES);
    if (excludedListingId) query = query.neq('id', excludedListingId);
    const { data, error } = await query.limit(1).maybeSingle();
    if (error) throw failure('READ_FAILED');
    return data;
  },

  async hasLiveForProperty(propertyId) {
    const { data, error } = await getPrivilegedSupabaseClient()
      .from('listings')
      .select('id')
      .eq('property_id', propertyId)
      .in('status', LIVE_STATUSES)
      .limit(1)
      .maybeSingle();
    if (error) throw failure('READ_FAILED');
    return Boolean(data);
  },
};
