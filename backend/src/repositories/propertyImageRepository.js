import { getPrivilegedSupabaseClient } from '../config/supabase.js';

const IMAGE_COLUMNS =
  'id,property_id,storage_path,display_order,is_cover,created_at';

export class PropertyImageRepositoryError extends Error {
  constructor(reason) {
    super('The property image repository operation failed.');
    this.name = 'PropertyImageRepositoryError';
    this.reason = reason;
  }
}

function failure(reason) {
  return new PropertyImageRepositoryError(reason);
}

export const propertyImageRepository = {
  async listForProperty(propertyId) {
    const { data, error } = await getPrivilegedSupabaseClient()
      .from('property_images')
      .select(IMAGE_COLUMNS)
      .eq('property_id', propertyId)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true })
      .order('id', { ascending: true });
    if (error) throw failure('READ_FAILED');
    return data;
  },

  async findForProperty(propertyId, imageId) {
    const { data, error } = await getPrivilegedSupabaseClient()
      .from('property_images')
      .select(IMAGE_COLUMNS)
      .eq('property_id', propertyId)
      .eq('id', imageId)
      .maybeSingle();
    if (error) throw failure('READ_FAILED');
    return data;
  },

  async create(metadata) {
    const { data, error } = await getPrivilegedSupabaseClient()
      .from('property_images')
      .insert(metadata)
      .select(IMAGE_COLUMNS)
      .single();
    if (error || !data) throw failure('WRITE_FAILED');
    return data;
  },

  async updateOrder(propertyId, imageId, displayOrder) {
    const { data, error } = await getPrivilegedSupabaseClient()
      .from('property_images')
      .update({ display_order: displayOrder })
      .eq('property_id', propertyId)
      .eq('id', imageId)
      .select(IMAGE_COLUMNS)
      .maybeSingle();
    if (error) throw failure('WRITE_FAILED');
    return data;
  },

  async setCoverState(propertyId, imageId, isCover) {
    const { data, error } = await getPrivilegedSupabaseClient()
      .from('property_images')
      .update({ is_cover: isCover })
      .eq('property_id', propertyId)
      .eq('id', imageId)
      .select(IMAGE_COLUMNS)
      .maybeSingle();
    if (error) throw failure('WRITE_FAILED');
    return data;
  },

  async unsetCover(propertyId) {
    const { error } = await getPrivilegedSupabaseClient()
      .from('property_images')
      .update({ is_cover: false })
      .eq('property_id', propertyId)
      .eq('is_cover', true);
    if (error) throw failure('WRITE_FAILED');
  },

  async deleteForProperty(propertyId, imageId) {
    const { data, error } = await getPrivilegedSupabaseClient()
      .from('property_images')
      .delete()
      .eq('property_id', propertyId)
      .eq('id', imageId)
      .select('id')
      .maybeSingle();
    if (error) throw failure('WRITE_FAILED');
    return Boolean(data);
  },
};
