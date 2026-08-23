import { Router } from 'express';
import { createConversationController } from '../controllers/conversationController.js';
import { createAuthenticateUser } from '../middleware/authenticateUser.js';
import { createLoadApplicationProfile } from '../middleware/loadApplicationProfile.js';
import { requireActiveAccount } from '../middleware/requireActiveAccount.js';
import { requireRole } from '../middleware/requireRole.js';
import { authService as defaultAuthService } from '../services/authService.js';
import { conversationService as defaultService } from '../services/conversationService.js';
import { publicListingIdParamsSchema } from '../validators/publicListingValidators.js';
import {
  conversationListQuerySchema,
  conversationParamsSchema,
  emptyConversationBodySchema,
} from '../validators/conversationValidators.js';
import { validateRequest } from '../validators/validateRequest.js';

function participant(authService) {
  return [
    createAuthenticateUser(authService),
    createLoadApplicationProfile(authService),
    requireActiveAccount,
    requireRole('TENANT', 'LANDLORD'),
  ];
}

export function createListingConversationRouter(
  authService = defaultAuthService,
  service = defaultService,
) {
  const router = Router();
  const controller = createConversationController(service);
  router.post(
    '/:listingId/conversation',
    ...participant(authService),
    requireRole('TENANT'),
    validateRequest(publicListingIdParamsSchema, 'params'),
    validateRequest(emptyConversationBodySchema),
    controller.create,
  );
  return router;
}

export function createConversationRouter(
  authService = defaultAuthService,
  service = defaultService,
) {
  const router = Router();
  const controller = createConversationController(service);
  router.get(
    '/',
    ...participant(authService),
    validateRequest(conversationListQuerySchema, 'query'),
    controller.list,
  );
  router.get(
    '/:conversationId',
    ...participant(authService),
    validateRequest(conversationParamsSchema, 'params'),
    controller.get,
  );
  return router;
}
