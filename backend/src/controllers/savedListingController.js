import { savedListingService as defaultSavedListingService } from '../services/savedListingService.js';

export function createSavedListingController(
  service = defaultSavedListingService,
) {
  return Object.freeze({
    async list(request, response) {
      const query = request.validatedQuery;
      const result = await service.list(request.auth.userId, query);
      response.json({
        success: true,
        data: result.saves,
        meta: {
          page: query.page,
          limit: query.limit,
          total: result.total,
          total_pages: Math.ceil(result.total / query.limit),
        },
      });
    },

    async status(request, response) {
      response.json({
        success: true,
        data: await service.status(
          request.auth.userId,
          request.params.listingId,
        ),
      });
    },

    async save(request, response) {
      response.json({
        success: true,
        data: await service.save(request.auth.userId, request.params.listingId),
      });
    },

    async remove(request, response) {
      await service.remove(request.auth.userId, request.params.listingId);
      response.status(204).send();
    },
  });
}
