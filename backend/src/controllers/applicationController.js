import { applicationService as defaultApplicationService } from '../services/applicationService.js';

function responseBody(result) {
  return {
    success: true,
    data: result.application,
    meta: {
      listing_available: result.listingAvailable,
      editable: result.editable,
    },
  };
}

export function createApplicationController(
  service = defaultApplicationService,
) {
  return Object.freeze({
    async list(request, response) {
      const query = request.validatedQuery;
      const result = await service.list(request.auth.userId, query);
      response.json({
        success: true,
        data: result.applications,
        meta: {
          page: query.page,
          limit: query.limit,
          total: result.total,
          total_pages: Math.ceil(result.total / query.limit),
        },
      });
    },

    async create(request, response) {
      const result = await service.create(
        request.auth.userId,
        request.params.listingId,
        request.body,
      );
      response.status(result.created ? 201 : 200).json(responseBody(result));
    },

    async get(request, response) {
      response.json(
        responseBody(
          await service.get(request.auth.userId, request.params.applicationId),
        ),
      );
    },

    async update(request, response) {
      response.json(
        responseBody(
          await service.update(
            request.auth.userId,
            request.params.applicationId,
            request.body,
          ),
        ),
      );
    },
  });
}
