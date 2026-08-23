import { Router } from 'express';
import { createViewingController } from '../controllers/viewingController.js';
import { createAuthenticateUser } from '../middleware/authenticateUser.js';
import { createLoadApplicationProfile } from '../middleware/loadApplicationProfile.js';
import { requireActiveAccount } from '../middleware/requireActiveAccount.js';
import { requireRole } from '../middleware/requireRole.js';
import { authService as defaultAuthService } from '../services/authService.js';
import { viewingService as defaultService } from '../services/viewingService.js';
import { applicationParamsSchema } from '../validators/applicationValidators.js';
import { validateRequest } from '../validators/validateRequest.js';
import { viewingParamsSchema } from '../validators/viewingValidators.js';

function participant(authService) {
  return [
    createAuthenticateUser(authService),
    createLoadApplicationProfile(authService),
    requireActiveAccount,
    requireRole('TENANT', 'LANDLORD'),
  ];
}

function role(authService, expectedRole) {
  return [
    createAuthenticateUser(authService),
    createLoadApplicationProfile(authService),
    requireActiveAccount,
    requireRole(expectedRole),
  ];
}

export function createApplicationViewingRouter(
  authService = defaultAuthService,
  service = defaultService,
) {
  const router = Router();
  const controller = createViewingController(service);
  router.get(
    '/:applicationId/viewings',
    ...participant(authService),
    validateRequest(applicationParamsSchema, 'params'),
    controller.list,
  );
  return router;
}

export function createViewingRouter(
  authService = defaultAuthService,
  service = defaultService,
) {
  const router = Router();
  const controller = createViewingController(service);
  router.get(
    '/:viewingId',
    ...participant(authService),
    validateRequest(viewingParamsSchema, 'params'),
    controller.get,
  );
  for (const [action, expectedRole, handler] of [
    ['confirm', 'TENANT', controller.confirm],
    ['decline', 'TENANT', controller.decline],
    ['complete', 'LANDLORD', controller.complete],
    ['no-show', 'LANDLORD', controller.noShow],
  ]) {
    router.post(
      `/:viewingId/${action}`,
      ...role(authService, expectedRole),
      validateRequest(viewingParamsSchema, 'params'),
      handler,
    );
  }
  router.post(
    '/:viewingId/cancel',
    ...participant(authService),
    validateRequest(viewingParamsSchema, 'params'),
    controller.cancel,
  );
  return router;
}
