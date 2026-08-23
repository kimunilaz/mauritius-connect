import { applicationAnswerService as defaultApplicationAnswerService } from '../services/applicationAnswerService.js';

export function createApplicationAnswerController(
  service = defaultApplicationAnswerService,
) {
  return Object.freeze({
    async list(request, response) {
      response.json({
        success: true,
        data: await service.list(
          request.auth.userId,
          request.params.applicationId,
        ),
      });
    },

    async put(request, response) {
      response.json({
        success: true,
        data: await service.put(
          request.auth.userId,
          request.params.applicationId,
          request.body,
        ),
      });
    },
  });
}
