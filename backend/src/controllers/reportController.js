import { reportService as defaultService } from '../services/reportService.js';

export function createReportController(service = defaultService) {
  return Object.freeze({
    async create(request, response) {
      const result = await service.create(request.auth.userId, request.body);
      response.status(result.created ? 201 : 200).json({
        success: true,
        data: result,
        meta: { created_now: result.created },
      });
    },
    async list(request, response) {
      const result = await service.list(
        request.auth.userId,
        request.validatedQuery,
      );
      const { page, limit } = request.validatedQuery;
      response.json({
        success: true,
        data: result.reports,
        meta: {
          page,
          limit,
          total: result.total,
          total_pages: Math.ceil(result.total / limit),
        },
      });
    },
    async detail(request, response) {
      response.json({
        success: true,
        data: await service.get(request.auth.userId, request.params.reportId),
      });
    },
    async review(request, response) {
      response.json({
        success: true,
        data: await service.moderate(
          request.auth.userId,
          request.params.reportId,
          'UNDER_REVIEW',
          request.body.reason,
        ),
      });
    },
    async resolve(request, response) {
      response.json({
        success: true,
        data: await service.moderate(
          request.auth.userId,
          request.params.reportId,
          'RESOLVED',
          request.body.reason,
        ),
      });
    },
    async dismiss(request, response) {
      response.json({
        success: true,
        data: await service.moderate(
          request.auth.userId,
          request.params.reportId,
          'DISMISSED',
          request.body.reason,
        ),
      });
    },
  });
}
