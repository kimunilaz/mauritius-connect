import { publicListingService as defaultPublicListingService } from '../services/publicListingService.js';

export function createPublicListingController(
  service = defaultPublicListingService,
) {
  return Object.freeze({
    async search(request, response) {
      const query = request.validatedQuery;
      const result = await service.search(query);
      response.json({
        success: true,
        data: result.listings,
        meta: {
          page: query.page,
          limit: query.limit,
          total: result.total,
          total_pages: Math.ceil(result.total / query.limit),
        },
      });
    },

    async get(request, response) {
      response.json({
        success: true,
        data: await service.get(request.params.listingId),
      });
    },
  });
}
