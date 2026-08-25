import { Router } from 'express';
import { createApplicationTransitionController } from '../controllers/applicationTransitionController.js';
import { createViewingController } from '../controllers/viewingController.js';
import { createLandlordApplicationController } from '../controllers/landlordApplicationController.js';
import { createAuthenticateUser } from '../middleware/authenticateUser.js';
import { createLoadApplicationProfile } from '../middleware/loadApplicationProfile.js';
import { requireActiveAccount } from '../middleware/requireActiveAccount.js';
import { requireRole } from '../middleware/requireRole.js';
import { applicationTransitionService as defaultTransitionService } from '../services/applicationTransitionService.js';
import { viewingService as defaultViewingService } from '../services/viewingService.js';
import { landlordApplicationService as defaultService } from '../services/landlordApplicationService.js';
import { authService as defaultAuthService } from '../services/authService.js';
import {
  applicationListingParamsSchema,
  applicationParamsSchema,
  landlordApplicationListQuerySchema,
} from '../validators/applicationValidators.js';
import { validateRequest } from '../validators/validateRequest.js';
import { proposeViewingSchema } from '../validators/viewingValidators.js';
import { createApplicationAcceptanceController } from '../controllers/applicationAcceptanceController.js';
import { applicationAcceptanceService as defaultAcceptanceService } from '../services/applicationAcceptanceService.js';

function landlordMiddleware(authService) {
  return [
    createAuthenticateUser(authService),
    createLoadApplicationProfile(authService),
    requireActiveAccount,
    requireRole('LANDLORD'),
  ];
}

export function createLandlordListingApplicationRouter(
  authService = defaultAuthService,
  service = defaultService,
) {
  const router = Router();
  const controller = createLandlordApplicationController(service);
  router.get(
    '/:listingId/applications',
    ...landlordMiddleware(authService),
    validateRequest(applicationListingParamsSchema, 'params'),
    validateRequest(landlordApplicationListQuerySchema, 'query'),
    controller.list,
  );
  return router;
}

export function createLandlordApplicationRouter(
  authService = defaultAuthService,
  service = defaultService,
  transitionService = defaultTransitionService,
  viewingService = defaultViewingService,
  acceptanceService = defaultAcceptanceService,
) {
  const router = Router();
  const controller = createLandlordApplicationController(service);
  const transitionController =
    createApplicationTransitionController(transitionService);
  const viewingController = createViewingController(viewingService);
  const acceptanceController =
    createApplicationAcceptanceController(acceptanceService);
  router.post(
    '/:applicationId/accept',
    ...landlordMiddleware(authService),
    validateRequest(applicationParamsSchema, 'params'),
    acceptanceController.accept,
  );
  router.post(
    '/:applicationId/viewings',
    ...landlordMiddleware(authService),
    validateRequest(applicationParamsSchema, 'params'),
    validateRequest(proposeViewingSchema),
    viewingController.propose,
  );
  for (const [action, handler] of [
    ['review', transitionController.review],
    ['shortlist', transitionController.shortlist],
    ['reject', transitionController.reject],
  ]) {
    router.post(
      `/:applicationId/${action}`,
      ...landlordMiddleware(authService),
      validateRequest(applicationParamsSchema, 'params'),
      handler,
    );
  }
  router.get(
    '/:applicationId',
    ...landlordMiddleware(authService),
    validateRequest(applicationParamsSchema, 'params'),
    controller.get,
  );
  return router;
}
