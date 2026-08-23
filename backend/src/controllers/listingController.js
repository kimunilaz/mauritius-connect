import { listingService as defaultListingService } from '../services/listingService.js';

export function createListingController(service = defaultListingService) {
  return Object.freeze({
    async create(request, response) {
      const listing = await service.create(request.auth.userId, request.body);
      response.status(201).json({ success: true, data: listing });
    },

    async list(request, response) {
      const query = request.validatedQuery;
      const result = await service.list(request.auth.userId, query);
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
        data: await service.get(request.auth.userId, request.params.listingId),
      });
    },

    async update(request, response) {
      response.json({
        success: true,
        data: await service.update(
          request.auth.userId,
          request.params.listingId,
          request.body,
        ),
      });
    },

    async publish(request, response) {
      response.json({
        success: true,
        data: await service.publish(
          request.auth.userId,
          request.params.listingId,
        ),
      });
    },

    async pause(request, response) {
      response.json({
        success: true,
        data: await service.pause(
          request.auth.userId,
          request.params.listingId,
        ),
      });
    },

    async activate(request, response) {
      response.json({
        success: true,
        data: await service.activate(
          request.auth.userId,
          request.params.listingId,
        ),
      });
    },

    async close(request, response) {
      response.json({
        success: true,
        data: await service.close(
          request.auth.userId,
          request.params.listingId,
        ),
      });
    },
  });
}
