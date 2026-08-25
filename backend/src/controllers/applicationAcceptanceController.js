import { applicationAcceptanceService as defaultService } from '../services/applicationAcceptanceService.js';

export function createApplicationAcceptanceController(
  service = defaultService,
) {
  return {
    accept: async (req, res) =>
      res.json({
        success: true,
        data: await service.accept(req.auth.userId, req.params.applicationId),
      }),
  };
}

export const applicationAcceptanceController =
  createApplicationAcceptanceController();
