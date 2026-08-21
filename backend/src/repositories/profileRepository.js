import { getPrivilegedSupabaseClient } from '../config/supabase.js';

const SAFE_PROFILE_COLUMNS = [
  'id',
  'role',
  'first_name',
  'last_name',
  'phone',
  'profile_photo_url',
  'phone_verified',
  'account_status',
].join(',');

export class ProfileRepositoryError extends Error {
  constructor(reason) {
    super('The profile repository operation failed.');
    this.name = 'ProfileRepositoryError';
    this.reason = reason;
  }
}

export const profileRepository = {
  async findByUserId(userId) {
    const client = getPrivilegedSupabaseClient();
    const { data, error } = await client
      .from('profiles')
      .select(SAFE_PROFILE_COLUMNS)
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      throw new ProfileRepositoryError('READ_FAILED');
    }

    return data;
  },

  async create(profile) {
    const client = getPrivilegedSupabaseClient();
    const { data, error } = await client
      .from('profiles')
      .insert(profile)
      .select(SAFE_PROFILE_COLUMNS)
      .single();

    if (error?.code === '23505') {
      throw new ProfileRepositoryError('DUPLICATE');
    }

    if (error || !data) {
      throw new ProfileRepositoryError('WRITE_FAILED');
    }

    return data;
  },

  async updateBaseFields(userId, fields) {
    const client = getPrivilegedSupabaseClient();
    const { data, error } = await client
      .from('profiles')
      .update(fields)
      .eq('id', userId)
      .select(SAFE_PROFILE_COLUMNS)
      .single();

    if (error || !data) {
      throw new ProfileRepositoryError('WRITE_FAILED');
    }

    return data;
  },
};
