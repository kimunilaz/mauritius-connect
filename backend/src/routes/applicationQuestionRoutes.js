import { Router } from 'express';
import { createApplicationQuestionController } from '../controllers/applicationQuestionController.js';
import { createAuthenticateUser } from '../middleware/authenticateUser.js';
import { createLoadApplicationProfile } from '../middleware/loadApplicationProfile.js';
import { requireActiveAccount } from '../middleware/requireActiveAccount.js';
import { requireRole } from '../middleware/requireRole.js';
import { applicationQuestionService as defaultApplicationQuestionService } from '../services/applicationQuestionService.js';
import { authService as defaultAuthService } from '../services/authService.js';
import {
  applicationQuestionListingParamsSchema,
  applicationQuestionParamsSchema,
  createApplicationQuestionSchema,
  updateApplicationQuestionSchema,
} from '../validators/applicationQuestionValidators.js';
import { validateRequest } from '../validators/validateRequest.js';

function landlordMiddleware(authService) {
  return [
    createAuthenticateUser(authService),
    createLoadApplicationProfile(authService),
    requireActiveAccount,
    requireRole('LANDLORD'),
  ];
}

export function createLandlordApplicationQuestionRouter(
  authService = defaultAuthService,
  service = defaultApplicationQuestionService,
) {
  const router = Router();
  const controller = createApplicationQuestionController(service);
  router.get(
    '/:listingId/application-questions',
    ...landlordMiddleware(authService),
    validateRequest(applicationQuestionListingParamsSchema, 'params'),
    controller.listOwned,
  );
  return router;
}

export function createPublicApplicationQuestionRouter(
  service = defaultApplicationQuestionService,
) {
  const router = Router();
  const controller = createApplicationQuestionController(service);
  router.get(
    '/:listingId/application-questions',
    validateRequest(applicationQuestionListingParamsSchema, 'params'),
    controller.listPublic,
  );
  return router;
}

export function createApplicationQuestionActionRouter(
  authService = defaultAuthService,
  service = defaultApplicationQuestionService,
) {
  const router = Router();
  const controller = createApplicationQuestionController(service);
  router.post(
    '/:listingId/application-questions',
    ...landlordMiddleware(authService),
    validateRequest(applicationQuestionListingParamsSchema, 'params'),
    validateRequest(createApplicationQuestionSchema),
    controller.create,
  );
  router.patch(
    '/:listingId/application-questions/:questionId',
    ...landlordMiddleware(authService),
    validateRequest(applicationQuestionParamsSchema, 'params'),
    validateRequest(updateApplicationQuestionSchema),
    controller.update,
  );
  router.delete(
    '/:listingId/application-questions/:questionId',
    ...landlordMiddleware(authService),
    validateRequest(applicationQuestionParamsSchema, 'params'),
    controller.remove,
  );
  return router;
}
