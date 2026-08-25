import { verificationService as defaultService } from '../services/verificationService.js';
export function createVerificationController(service = defaultService) {
  return {
    async create(req, res) {
      res.status(201).json({
        success: true,
        data: await service.create(req.auth.userId, req.body),
      });
    },
    async list(req, res) {
      const r = await service.list(req.auth.userId, req.validatedQuery);
      res.json({
        success: true,
        data: r.items,
        meta: {
          page: req.validatedQuery.page,
          limit: req.validatedQuery.limit,
          total: r.total,
        },
      });
    },
    async detail(req, res) {
      res.json({
        success: true,
        data: await service.get(
          req.auth.userId,
          req.params.verificationId,
          req.isAdmin,
        ),
      });
    },
    async evidence(req, res) {
      res.status(201).json({
        success: true,
        data: await service.evidence(
          req.auth.userId,
          req.params.verificationId,
          req.file,
        ),
      });
    },
    async evidenceUrl(req, res) {
      res.json({
        success: true,
        data: await service.evidenceUrl(
          req.auth.userId,
          req.params.verificationId,
          req.isAdmin,
        ),
      });
    },
    async review(req, res) {
      res.json({
        success: true,
        data: await service.moderate(
          req.auth.userId,
          req.params.verificationId,
          'UNDER_REVIEW',
          req.body?.reason,
        ),
      });
    },
    async approve(req, res) {
      res.json({
        success: true,
        data: await service.moderate(
          req.auth.userId,
          req.params.verificationId,
          'VERIFIED',
        ),
      });
    },
    async reject(req, res) {
      res.json({
        success: true,
        data: await service.moderate(
          req.auth.userId,
          req.params.verificationId,
          'REJECTED',
          req.body?.reason,
        ),
      });
    },
  };
}
