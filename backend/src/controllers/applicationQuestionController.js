import { applicationQuestionService as defaultApplicationQuestionService } from '../services/applicationQuestionService.js';

export function createApplicationQuestionController(
  service = defaultApplicationQuestionService,
) {
  return Object.freeze({
    async listOwned(request, response) {
      const result = await service.listOwned(
        request.auth.userId,
        request.params.listingId,
      );
      response.json({
        success: true,
        data: result.questions,
        meta: {
          locked: result.locked,
          editable: result.editable,
          listing_status: result.listingStatus,
        },
      });
    },

    async listPublic(request, response) {
      response.json({
        success: true,
        data: await service.listPublic(request.params.listingId),
      });
    },

    async create(request, response) {
      response.status(201).json({
        success: true,
        data: await service.create(
          request.auth.userId,
          request.params.listingId,
          request.body,
        ),
      });
    },

    async update(request, response) {
      response.json({
        success: true,
        data: await service.update(
          request.auth.userId,
          request.params.listingId,
          request.params.questionId,
          request.body,
        ),
      });
    },

    async remove(request, response) {
      await service.remove(
        request.auth.userId,
        request.params.listingId,
        request.params.questionId,
      );
      response.status(204).send();
    },
  });
}
