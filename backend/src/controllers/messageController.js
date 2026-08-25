import { messageService as defaultService } from '../services/messageService.js';

export function createMessageController(service = defaultService) {
  return Object.freeze({
    async send(request, response) {
      const message = await service.send(
        request.auth.userId,
        request.params.conversationId,
        request.validatedBody.body,
      );
      response.status(201).json({ success: true, data: message });
    },

    async list(request, response) {
      const query = request.validatedQuery;
      const result = await service.list(
        request.auth.userId,
        request.params.conversationId,
        query,
      );
      response.json({
        success: true,
        data: result.messages,
        meta: {
          page: query.page,
          limit: query.limit,
          total: result.total,
          total_pages: Math.ceil(result.total / query.limit),
        },
      });
    },

    async markRead(request, response) {
      const data = await service.markRead(
        request.auth.userId,
        request.params.conversationId,
      );
      response.json({ success: true, data });
    },
  });
}
