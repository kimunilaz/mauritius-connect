import { getPrivilegedSupabaseClient } from '../config/supabase.js';

export class ApplicationSubmissionRepositoryError extends Error {
  constructor(reason) {
    super('The application submission transaction failed.');
    this.name = 'ApplicationSubmissionRepositoryError';
    this.reason = reason;
  }
}

export const applicationSubmissionRepository = {
  async submit({ applicationId, tenantId, actorUserId }) {
    const { data, error } = await getPrivilegedSupabaseClient().rpc(
      'submit_application_transaction',
      {
        p_application_id: applicationId,
        p_tenant_id: tenantId,
        p_actor_user_id: actorUserId,
      },
    );
    if (error) throw new ApplicationSubmissionRepositoryError('WRITE_FAILED');
    const result = Array.isArray(data) ? data[0] : data;
    if (!result) throw new ApplicationSubmissionRepositoryError('NO_RESULT');
    return result;
  },
};
