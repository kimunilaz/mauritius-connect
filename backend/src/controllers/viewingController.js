import { viewingService as defaultService } from '../services/viewingService.js';

function transitionResponse(response, result) {
  response.json({
    success: true,
    data: result.viewing,
    meta: {
      transitioned_now: result.transitioned,
      application_status: result.applicationStatus,
    },
  });
}

export function createViewingController(service = defaultService) {
  return Object.freeze({
    async propose(request, response) {
      response.status(201).json({
        success: true,
        data: await service.propose(
          request.auth.userId,
          request.params.applicationId,
          request.body,
        ),
      });
    },
    async list(request, response) {
      response.json({
        success: true,
        data: await service.list(
          request.auth.userId,
          request.profile.role,
          request.params.applicationId,
        ),
      });
    },
    async get(request, response) {
      response.json({
        success: true,
        data: await service.get(
          request.auth.userId,
          request.profile.role,
          request.params.viewingId,
        ),
      });
    },
    async confirm(request, response) {
      transitionResponse(
        response,
        await service.confirm(request.auth.userId, request.params.viewingId),
      );
    },
    async decline(request, response) {
      transitionResponse(
        response,
        await service.decline(request.auth.userId, request.params.viewingId),
      );
    },
    async cancel(request, response) {
      transitionResponse(
        response,
        await service.cancel(
          request.auth.userId,
          request.profile.role,
          request.params.viewingId,
        ),
      );
    },
    async complete(request, response) {
      transitionResponse(
        response,
        await service.complete(request.auth.userId, request.params.viewingId),
      );
    },
    async noShow(request, response) {
      transitionResponse(
        response,
        await service.noShow(request.auth.userId, request.params.viewingId),
      );
    },
  });
}
