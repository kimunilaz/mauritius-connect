import { AppError } from '../middleware/AppError.js';
import { getPrivilegedSupabaseClient } from '../config/supabase.js';

const PROPERTY_COLUMNS = [
  'id',
  'managed_owner_id',
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
      .insert({ property_manager_id: landlordProfileId, ...property })
      .select(PROPERTY_COLUMNS)
      .single();

    if (error?.message?.includes('OWNER_NOT_FOUND'))
      throw new AppError({
        statusCode: 404,
        code: 'OWNER_NOT_FOUND',
        message: 'Active owner record not found.',
      });
    if (error || !data) throw failure('WRITE_FAILED');
    return data;
  },

  async listForLandlord(
    landlordProfileId,
    { archived, page, limit, owner_id },
  ) {
    const first = (page - 1) * limit;
    let query = getPrivilegedSupabaseClient()
      .from('properties')
      .select(PROPERTY_COLUMNS, { count: 'exact' })
      .eq('property_manager_id', landlordProfileId);

    if (owner_id) query = query.eq('managed_owner_id', owner_id);
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
      .eq('property_manager_id', landlordProfileId)
      .maybeSingle();

    if (error) throw failure('READ_FAILED');
    return data;
  },

  async updateForLandlord(propertyId, landlordProfileId, fields) {
    const { data, error } = await getPrivilegedSupabaseClient()
      .from('properties')
      .update(fields)
      .eq('id', propertyId)
      .eq('property_manager_id', landlordProfileId)
      .is('archived_at', null)
      .select(PROPERTY_COLUMNS)
      .maybeSingle();

    if (error?.message?.includes('PROPERTY_HAS_TENANCY'))
      throw new AppError({
        statusCode: 409,
        code: 'PROPERTY_HAS_TENANCY',
        message:
          'End or cancel current and upcoming tenancies before archiving this property.',
      });
    if (error) throw failure('WRITE_FAILED');
    return data;
  },

  async archiveForLandlord(propertyId, landlordProfileId, archivedAt) {
    const { data, error } = await getPrivilegedSupabaseClient()
      .from('properties')
      .update({ archived_at: archivedAt })
      .eq('id', propertyId)
      .eq('property_manager_id', landlordProfileId)
      .is('archived_at', null)
      .select(PROPERTY_COLUMNS)
      .maybeSingle();

    if (error?.message?.includes('PROPERTY_HAS_TENANCY'))
      throw new AppError({
        statusCode: 409,
        code: 'PROPERTY_HAS_TENANCY',
        message:
          'End or cancel current and upcoming tenancies before archiving this property.',
      });
    if (error) throw failure('WRITE_FAILED');
    return data;
  },
};
