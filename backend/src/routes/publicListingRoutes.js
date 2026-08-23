import { Router } from 'express';
import { createPublicListingController } from '../controllers/publicListingController.js';
import { publicListingService as defaultPublicListingService } from '../services/publicListingService.js';
import {
  publicListingIdParamsSchema,
  publicListingSearchQuerySchema,
} from '../validators/publicListingValidators.js';
import { validateRequest } from '../validators/validateRequest.js';

export function createPublicListingRouter(
  service = defaultPublicListingService,
) {
  const router = Router();
  const controller = createPublicListingController(service);

  router.get(
    '/',
    validateRequest(publicListingSearchQuerySchema, 'query'),
    controller.search,
  );
  router.get(
    '/:listingId',
    validateRequest(publicListingIdParamsSchema, 'params'),
    controller.get,
  );

  return router;
}
