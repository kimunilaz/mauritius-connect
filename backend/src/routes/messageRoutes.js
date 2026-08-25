import { Router } from 'express';
import { createMessageController } from '../controllers/messageController.js';
import { createAuthenticateUser } from '../middleware/authenticateUser.js';
import { createLoadApplicationProfile } from '../middleware/loadApplicationProfile.js';
import { requireActiveAccount } from '../middleware/requireActiveAccount.js';
import { requireRole } from '../middleware/requireRole.js';
import { authService as defaultAuthService } from '../services/authService.js';
import { messageService as defaultService } from '../services/messageService.js';
import { conversationParamsSchema } from '../validators/conversationValidators.js';
import {
  emptyReadBodySchema,
  messageBodySchema,
  messageListQuerySchema,
} from '../validators/messageValidators.js';
import { validateRequest } from '../validators/validateRequest.js';

const participant = (authService) => [
  createAuthenticateUser(authService),
  createLoadApplicationProfile(authService),
  requireActiveAccount,
  requireRole('TENANT', 'LANDLORD'),
];

export function createMessageRouter(
  authService = defaultAuthService,
  service = defaultService,
) {
  const router = Router();
  const controller = createMessageController(service);
  router.post(
    '/:conversationId/messages',
    ...participant(authService),
    validateRequest(conversationParamsSchema, 'params'),
    validateRequest(messageBodySchema),
    (request, _response, next) => {
      request.validatedBody = request.body;
      next();
    },
    controller.send,
  );
  router.get(
    '/:conversationId/messages',
    ...participant(authService),
    validateRequest(conversationParamsSchema, 'params'),
    validateRequest(messageListQuerySchema, 'query'),
    controller.list,
  );
  router.post(
    '/:conversationId/read',
    ...participant(authService),
    validateRequest(conversationParamsSchema, 'params'),
    validateRequest(emptyReadBodySchema),
    controller.markRead,
  );
  return router;
}
