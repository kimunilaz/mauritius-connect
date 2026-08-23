import { getPrivilegedSupabaseClient } from '../config/supabase.js';

export class ApplicantIdentityRepositoryError extends Error {
  constructor() {
    super('The applicant identity repository operation failed.');
    this.name = 'ApplicantIdentityRepositoryError';
  }
}

function failure() {
  return new ApplicantIdentityRepositoryError();
}

export const applicantIdentityRepository = {
  async findForTenantIds(tenantIds) {
    const uniqueTenantIds = [...new Set(tenantIds)];
    if (!uniqueTenantIds.length) return new Map();

    const tenantResult = await getPrivilegedSupabaseClient()
      .from('tenant_profiles')
      .select('id,user_id')
      .in('id', uniqueTenantIds);
    if (tenantResult.error) throw failure();

    const userIds = tenantResult.data.map(({ user_id }) => user_id);
    if (!userIds.length) return new Map();
    const profileResult = await getPrivilegedSupabaseClient()
      .from('profiles')
      .select('id,first_name,last_name,profile_photo_url')
      .in('id', userIds);
    if (profileResult.error) throw failure();

    const profiles = new Map(
      profileResult.data.map(({ id, ...identity }) => [id, identity]),
    );
    return new Map(
      tenantResult.data
        .map(({ id, user_id }) => [id, profiles.get(user_id)])
        .filter(([, identity]) => identity),
    );
  },
};
