import { Router } from 'express';
import { createListingController } from '../controllers/listingController.js';
import { createAuthenticateUser } from '../middleware/authenticateUser.js';
import { createLoadApplicationProfile } from '../middleware/loadApplicationProfile.js';
import { requireActiveAccount } from '../middleware/requireActiveAccount.js';
import { requireRole } from '../middleware/requireRole.js';
import { authService as defaultAuthService } from '../services/authService.js';
import { listingService as defaultListingService } from '../services/listingService.js';
import {
  createListingSchema,
  listingIdParamsSchema,
  listingListQuerySchema,
  updateListingSchema,
} from '../validators/listingValidators.js';
import { validateRequest } from '../validators/validateRequest.js';

function landlordRouter(authService) {
  const router = Router();
  router.use(
    createAuthenticateUser(authService),
    createLoadApplicationProfile(authService),
    requireActiveAccount,
    requireRole('LANDLORD'),
  );
  return router;
}

export function createListingRouter(
  authService = defaultAuthService,
  service = defaultListingService,
) {
  const router = landlordRouter(authService);
  const controller = createListingController(service);
  router.post('/', validateRequest(createListingSchema), controller.create);
  router.patch(
    '/:listingId',
    validateRequest(listingIdParamsSchema, 'params'),
    validateRequest(updateListingSchema),
    controller.update,
  );
  for (const action of ['publish', 'pause', 'activate', 'close']) {
    router.post(
      `/:listingId/${action}`,
      validateRequest(listingIdParamsSchema, 'params'),
      controller[action],
    );
  }
  return router;
}

export function createLandlordListingRouter(
  authService = defaultAuthService,
  service = defaultListingService,
) {
  const router = landlordRouter(authService);
  const controller = createListingController(service);
  router.get(
    '/',
    validateRequest(listingListQuerySchema, 'query'),
    controller.list,
  );
  router.get(
    '/:listingId',
    validateRequest(listingIdParamsSchema, 'params'),
    controller.get,
  );
  return router;
}
