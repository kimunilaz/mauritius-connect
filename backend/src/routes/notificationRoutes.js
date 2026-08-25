import { Router } from 'express';
import { createAuthenticateUser } from '../middleware/authenticateUser.js';
import { createLoadApplicationProfile } from '../middleware/loadApplicationProfile.js';
import { requireActiveAccount } from '../middleware/requireActiveAccount.js';
import { requireRole } from '../middleware/requireRole.js';
import { authService as defaultAuthService } from '../services/authService.js';
import { notificationService as defaultService } from '../services/notificationService.js';
import {
  notificationListQuerySchema,
  notificationParamsSchema,
} from '../validators/notificationValidators.js';
import { validateRequest } from '../validators/validateRequest.js';
import { createNotificationController } from '../controllers/notificationController.js';

const authenticatedActive = (authService) => [
  createAuthenticateUser(authService),
  createLoadApplicationProfile(authService),
  requireActiveAccount,
  requireRole('TENANT', 'LANDLORD'),
];

export function createNotificationRouter(
  authService = defaultAuthService,
  service = defaultService,
) {
  const router = Router();
  const controller = createNotificationController(service);
  router.get(
    '/',
    ...authenticatedActive(authService),
    validateRequest(notificationListQuerySchema, 'query'),
    controller.list,
  );
  router.get(
    '/unread-count',
    ...authenticatedActive(authService),
    controller.unreadCount,
  );
  router.post(
    '/read-all',
    ...authenticatedActive(authService),
    controller.markAllRead,
  );
  router.post(
    '/:notificationId/read',
    ...authenticatedActive(authService),
    validateRequest(notificationParamsSchema, 'params'),
    controller.markRead,
  );
  return router;
}
