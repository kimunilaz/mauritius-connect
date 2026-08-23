import { applicationSubmissionService as defaultApplicationSubmissionService } from '../services/applicationSubmissionService.js';

export function createApplicationSubmissionController(
  service = defaultApplicationSubmissionService,
) {
  return Object.freeze({
    async submit(request, response) {
      const result = await service.submit(
        request.auth.userId,
        request.params.applicationId,
      );
      response.json({
        success: true,
        data: result.application,
        meta: { submitted_now: result.submitted },
      });
    },
  });
}
