import { getPrivilegedSupabaseClient } from '../config/supabase.js';

export class ApplicationTransitionRepositoryError extends Error {
  constructor(reason) {
    super('The application transition transaction failed.');
    this.name = 'ApplicationTransitionRepositoryError';
    this.reason = reason;
  }
}

export const applicationTransitionRepository = {
  async transition({
    applicationId,
    actorUserId,
    actorRole,
    expectedStatus,
    targetStatus,
  }) {
    const { data, error } = await getPrivilegedSupabaseClient().rpc(
      'transition_application_status_transaction',
      {
        p_application_id: applicationId,
        p_actor_user_id: actorUserId,
        p_actor_role: actorRole,
        p_expected_status: expectedStatus,
        p_target_status: targetStatus,
      },
    );
    if (error) throw new ApplicationTransitionRepositoryError('WRITE_FAILED');
    const result = Array.isArray(data) ? data[0] : data;
    if (!result) throw new ApplicationTransitionRepositoryError('NO_RESULT');
    return result;
  },
};
