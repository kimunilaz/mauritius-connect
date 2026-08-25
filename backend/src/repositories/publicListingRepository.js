import { getPrivilegedSupabaseClient } from '../config/supabase.js';
import { PUBLIC_LISTING_STATUS } from '../services/publicListingEligibility.js';

export const PUBLIC_LISTING_COLUMNS = Object.freeze([
  'id',
  'title',
  'description',
  'monthly_rent',
  'deposit_amount',
  'available_from',
  'minimum_lease_months',
  'maximum_occupants',
  'pets_allowed',
  'published_at',
  'status',
]);

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

const PUBLIC_PROJECTION = `${PUBLIC_LISTING_COLUMNS.join(',')},property:properties!inner(${PUBLIC_PROPERTY_COLUMNS})`;

export class PublicListingRepositoryError extends Error {
  constructor() {
    super('The public listing repository operation failed.');
    this.name = 'PublicListingRepositoryError';
  }
}

function exactIlike(value) {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll('%', '\\%')
    .replaceAll('_', '\\_');
}

function applyFilters(query, filters) {
  let filtered = query;
  for (const field of ['district', 'locality', 'neighbourhood']) {
    if (filters[field]) {
      filtered = filtered.ilike(
        `property.${field}`,
        exactIlike(filters[field]),
      );
    }
  }
  if (filters.property_type) {
    filtered = filtered.eq('property.property_type', filters.property_type);
  }
  if (filters.min_rent !== undefined) {
    filtered = filtered.gte('monthly_rent', filters.min_rent);
  }
  if (filters.max_rent !== undefined) {
    filtered = filtered.lte('monthly_rent', filters.max_rent);
  }
  if (filters.bedrooms !== undefined) {
    filtered = filtered.gte('property.bedrooms', filters.bedrooms);
  }
  if (filters.bathrooms !== undefined) {
    filtered = filtered.gte('property.bathrooms', filters.bathrooms);
  }
  if (filters.furnished !== undefined) {
    filtered = filtered.eq('property.furnished', filters.furnished);
  }
  if (filters.pets_allowed !== undefined) {
    filtered = filtered.eq('pets_allowed', filters.pets_allowed);
  }
  if (filters.available_from) {
    filtered = filtered.lte('available_from', filters.available_from);
  }
  return filtered;
}

function applySort(query, sort) {
  const options = {
    newest: ['published_at', false],
    rent_low: ['monthly_rent', true],
    rent_high: ['monthly_rent', false],
    available_soon: ['available_from', true],
  };
  const [column, ascending] = options[sort];
  return query
    .order(column, { ascending, nullsFirst: false })
    .order('id', { ascending: true });
}

function publicBaseQuery({ count } = {}) {
  return getPrivilegedSupabaseClient()
    .from('listings')
    .select(PUBLIC_PROJECTION, count ? { count: 'exact' } : undefined)
    .eq('status', PUBLIC_LISTING_STATUS)
    .is('property.archived_at', null);
}

export const publicListingRepository = {
  async search(filters) {
    const first = (filters.page - 1) * filters.limit;
    const query = applySort(
      applyFilters(publicBaseQuery({ count: true }), filters),
      filters.sort,
    );
    const { data, error, count } = await query.range(
      first,
      first + filters.limit - 1,
    );
    if (error) throw new PublicListingRepositoryError();
    return {
      listings: await addTrustIndicators(data ?? []),
      total: count ?? 0,
    };
  },

  async findPublicById(listingId) {
    const { data, error } = await publicBaseQuery()
      .eq('id', listingId)
      .maybeSingle();
    if (error) throw new PublicListingRepositoryError();
    const enriched = await addTrustIndicators(data ? [data] : []);
    return enriched[0] ?? null;
  },
};

async function addTrustIndicators(listings) {
  if (!listings.length) return listings;
  const propertyIds = listings.map((item) => item.property.id);
  const { data: properties } = await getPrivilegedSupabaseClient()
    .from('properties')
    .select('id,landlord_id')
    .in('id', propertyIds);
  const landlordIds = (properties ?? []).map((item) => item.landlord_id);
  const { data: landlords } = await getPrivilegedSupabaseClient()
    .from('landlord_profiles')
    .select('id,user_id')
    .in('id', landlordIds);
  const userIds = (landlords ?? []).map((item) => item.user_id);
  const { data: records } = await getPrivilegedSupabaseClient()
    .from('verification_records')
    .select('subject_type,subject_id,verification_type,status')
    .eq('status', 'VERIFIED')
    .in('verification_type', ['LANDLORD_IDENTITY', 'PROPERTY_AUTHORITY'])
    .or(
      `and(subject_type.eq.PROPERTY,subject_id.in.(${propertyIds.join(',')})),and(subject_type.eq.USER,subject_id.in.(${userIds.join(',')}))`,
    );
  const verified = new Set(
    (records ?? []).map((item) => `${item.subject_type}:${item.subject_id}`),
  );
  return listings.map((listing) => {
    const property = properties?.find(
      (item) => item.id === listing.property.id,
    );
    const landlord = landlords?.find(
      (item) => item.id === property?.landlord_id,
    );
    return {
      ...listing,
      landlord_verified: verified.has(`USER:${landlord?.user_id}`),
      property_authority_verified: verified.has(
        `PROPERTY:${listing.property.id}`,
      ),
    };
  });
}
