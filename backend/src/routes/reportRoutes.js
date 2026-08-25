import { Router } from 'express';
import { createReportController } from '../controllers/reportController.js';
import { createAuthenticateUser } from '../middleware/authenticateUser.js';
import { createLoadApplicationProfile } from '../middleware/loadApplicationProfile.js';
import { requireActiveAccount } from '../middleware/requireActiveAccount.js';
import { requireRole } from '../middleware/requireRole.js';
import { authService as defaultAuthService } from '../services/authService.js';
import { reportService as defaultService } from '../services/reportService.js';
import {
  moderationActionSchema,
  reportCreateSchema,
  reportListQuerySchema,
  reportParamsSchema,
} from '../validators/reportValidators.js';
import { validateRequest } from '../validators/validateRequest.js';

function authenticated(authService, ...roles) {
  return [
    createAuthenticateUser(authService),
    createLoadApplicationProfile(authService),
    requireActiveAccount,
    requireRole(...roles),
  ];
}

export function createReportRouter(
  authService = defaultAuthService,
  service = defaultService,
) {
  const router = Router();
  const controller = createReportController(service);
  router.post(
    '/',
    ...authenticated(authService, 'TENANT', 'LANDLORD'),
    validateRequest(reportCreateSchema),
    controller.create,
  );
  return router;
}

export function createAdminReportRouter(
  authService = defaultAuthService,
  service = defaultService,
) {
  const router = Router();
  const controller = createReportController(service);
  const admin = authenticated(authService, 'ADMIN');
  router.get(
    '/',
    ...admin,
    validateRequest(reportListQuerySchema, 'query'),
    controller.list,
  );
  router.get(
    '/:reportId',
    ...admin,
    validateRequest(reportParamsSchema, 'params'),
    controller.detail,
  );
  for (const [path, action] of [
    ['review', controller.review],
    ['resolve', controller.resolve],
    ['dismiss', controller.dismiss],
  ]) {
    router.post(
      `/:reportId/${path}`,
      ...admin,
      validateRequest(reportParamsSchema, 'params'),
      validateRequest(moderationActionSchema),
      action,
    );
  }
  return router;
}
