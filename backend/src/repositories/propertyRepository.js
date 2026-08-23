import { getPrivilegedSupabaseClient } from '../config/supabase.js';

const PROPERTY_COLUMNS = [
  'id',
  'property_type',
  'address_line_1',
  'address_line_2',
  'district',
  'locality',
  'neighbourhood',
  'latitude',
  'longitude',
  'bedrooms',
  'bathrooms',
  'furnished',
  'parking_spaces',
  'verification_status',
  'archived_at',
  'created_at',
  'updated_at',
].join(',');

export class PropertyRepositoryError extends Error {
  constructor(reason) {
    super('The property repository operation failed.');
    this.name = 'PropertyRepositoryError';
    this.reason = reason;
  }
}

function failure(reason) {
  return new PropertyRepositoryError(reason);
}

export const propertyRepository = {
  async create(landlordProfileId, property) {
    const { data, error } = await getPrivilegedSupabaseClient()
      .from('properties')
      .insert({ landlord_id: landlordProfileId, ...property })
      .select(PROPERTY_COLUMNS)
      .single();

    if (error || !data) throw failure('WRITE_FAILED');
    return data;
  },

  async listForLandlord(landlordProfileId, { archived, page, limit }) {
    const first = (page - 1) * limit;
    let query = getPrivilegedSupabaseClient()
      .from('properties')
      .select(PROPERTY_COLUMNS, { count: 'exact' })
      .eq('landlord_id', landlordProfileId);

    query = archived
      ? query.not('archived_at', 'is', null)
      : query.is('archived_at', null);

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(first, first + limit - 1);

    if (error) throw failure('READ_FAILED');
    return { properties: data, total: count ?? 0 };
  },

  async findByIdForLandlord(propertyId, landlordProfileId) {
    const { data, error } = await getPrivilegedSupabaseClient()
      .from('properties')
      .select(PROPERTY_COLUMNS)
      .eq('id', propertyId)
      .eq('landlord_id', landlordProfileId)
      .maybeSingle();

    if (error) throw failure('READ_FAILED');
    return data;
  },

  async updateForLandlord(propertyId, landlordProfileId, fields) {
    const { data, error } = await getPrivilegedSupabaseClient()
      .from('properties')
      .update(fields)
      .eq('id', propertyId)
      .eq('landlord_id', landlordProfileId)
      .is('archived_at', null)
      .select(PROPERTY_COLUMNS)
      .maybeSingle();

    if (error) throw failure('WRITE_FAILED');
    return data;
  },

  async archiveForLandlord(propertyId, landlordProfileId, archivedAt) {
    const { data, error } = await getPrivilegedSupabaseClient()
      .from('properties')
      .update({ archived_at: archivedAt })
      .eq('id', propertyId)
      .eq('landlord_id', landlordProfileId)
      .is('archived_at', null)
      .select(PROPERTY_COLUMNS)
      .maybeSingle();

    if (error) throw failure('WRITE_FAILED');
    return data;
  },
};
