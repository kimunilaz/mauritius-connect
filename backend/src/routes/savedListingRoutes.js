import { Router } from 'express';
import { createSavedListingController } from '../controllers/savedListingController.js';
import { createAuthenticateUser } from '../middleware/authenticateUser.js';
import { createLoadApplicationProfile } from '../middleware/loadApplicationProfile.js';
import { requireActiveAccount } from '../middleware/requireActiveAccount.js';
import { requireRole } from '../middleware/requireRole.js';
import { authService as defaultAuthService } from '../services/authService.js';
import { savedListingService as defaultSavedListingService } from '../services/savedListingService.js';
import {
  emptySavedListingBodySchema,
  savedListingIdParamsSchema,
  savedListingListQuerySchema,
} from '../validators/savedListingValidators.js';
import { validateRequest } from '../validators/validateRequest.js';

function tenantMiddleware(authService) {
  return [
    createAuthenticateUser(authService),
    createLoadApplicationProfile(authService),
    requireActiveAccount,
    requireRole('TENANT'),
  ];
}

export function createTenantSavedListingRouter(
  authService = defaultAuthService,
  service = defaultSavedListingService,
) {
  const router = Router();
  const controller = createSavedListingController(service);
  router.get(
    '/',
    ...tenantMiddleware(authService),
    validateRequest(savedListingListQuerySchema, 'query'),
    controller.list,
  );
  router.get(
    '/:listingId/status',
    ...tenantMiddleware(authService),
    validateRequest(savedListingIdParamsSchema, 'params'),
    controller.status,
  );
  return router;
}

export function createSavedListingActionRouter(
  authService = defaultAuthService,
  service = defaultSavedListingService,
) {
  const router = Router();
  const controller = createSavedListingController(service);
  router.post(
    '/:listingId/save',
    ...tenantMiddleware(authService),
    validateRequest(savedListingIdParamsSchema, 'params'),
    validateRequest(emptySavedListingBodySchema),
    controller.save,
  );
  router.delete(
    '/:listingId/save',
    ...tenantMiddleware(authService),
    validateRequest(savedListingIdParamsSchema, 'params'),
    controller.remove,
  );
  return router;
}
