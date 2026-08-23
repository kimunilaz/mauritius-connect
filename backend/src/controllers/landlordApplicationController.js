import { landlordApplicationService as defaultService } from '../services/landlordApplicationService.js';

export function createLandlordApplicationController(service = defaultService) {
  return Object.freeze({
    async list(request, response) {
      const query = request.validatedQuery;
      const result = await service.list(
        request.auth.userId,
        request.params.listingId,
        query,
      );
      response.json({
        success: true,
        data: result.applications,
        meta: {
          page: query.page,
          limit: query.limit,
          total: result.total,
          total_pages: Math.ceil(result.total / query.limit),
          listing: result.listing,
        },
      });
    },

    async get(request, response) {
      response.json({
        success: true,
        data: await service.get(
          request.auth.userId,
          request.params.applicationId,
        ),
      });
    },
  });
}
