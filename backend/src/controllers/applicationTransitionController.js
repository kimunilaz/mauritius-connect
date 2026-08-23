import { applicationTransitionService as defaultService } from '../services/applicationTransitionService.js';

function response(response, result) {
  response.json({
    success: true,
    data: { status: result.status },
    meta: { transitioned_now: result.transitioned },
  });
}

export function createApplicationTransitionController(
  service = defaultService,
) {
  return Object.freeze({
    async review(request, res) {
      response(
        res,
        await service.review(request.auth.userId, request.params.applicationId),
      );
    },
    async shortlist(request, res) {
      response(
        res,
        await service.shortlist(
          request.auth.userId,
          request.params.applicationId,
        ),
      );
    },
    async reject(request, res) {
      response(
        res,
        await service.reject(request.auth.userId, request.params.applicationId),
      );
    },
    async withdraw(request, res) {
      response(
        res,
        await service.withdraw(
          request.auth.userId,
          request.params.applicationId,
        ),
      );
    },
  });
}
