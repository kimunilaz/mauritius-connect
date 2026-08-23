import { conversationService as defaultService } from '../services/conversationService.js';

export function createConversationController(service = defaultService) {
  return Object.freeze({
    async create(request, response) {
      const result = await service.create(
        request.auth.userId,
        request.params.listingId,
      );
      response.status(result.created ? 201 : 200).json({
        success: true,
        data: result.conversation,
        meta: { created_now: result.created },
      });
    },

    async list(request, response) {
      const query = request.validatedQuery;
      const result = await service.list(
        request.auth.userId,
        request.profile.role,
        query,
      );
      response.json({
        success: true,
        data: result.conversations,
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
        data: await service.get(
          request.auth.userId,
          request.profile.role,
          request.params.conversationId,
        ),
      });
    },
  });
}
