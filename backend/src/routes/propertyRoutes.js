import { Router } from 'express';
import { createPropertyController } from '../controllers/propertyController.js';
import { createPropertyImageController } from '../controllers/propertyImageController.js';
import { createAuthenticateUser } from '../middleware/authenticateUser.js';
import { createLoadApplicationProfile } from '../middleware/loadApplicationProfile.js';
import { requireActiveAccount } from '../middleware/requireActiveAccount.js';
import { requireRole } from '../middleware/requireRole.js';
import { createLoadOwnedProperty } from '../middleware/loadOwnedProperty.js';
import { propertyImageUpload } from '../middleware/propertyImageUpload.js';
import { authService as defaultAuthService } from '../services/authService.js';
import { propertyService as defaultPropertyService } from '../services/propertyService.js';
import { propertyImageService as defaultPropertyImageService } from '../services/propertyImageService.js';
import {
  propertyImageParamsSchema,
  updatePropertyImageSchema,
} from '../validators/propertyImageValidators.js';
import {
  createPropertySchema,
  propertyIdParamsSchema,
  propertyListQuerySchema,
  updatePropertySchema,
} from '../validators/propertyValidators.js';
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

export function createPropertyRouter(
  authService = defaultAuthService,
  propertyService = defaultPropertyService,
  propertyImageService = defaultPropertyImageService,
) {
  const router = landlordRouter(authService);
  const controller = createPropertyController(
    propertyService,
    propertyImageService,
  );
  const imageController = createPropertyImageController(propertyImageService);

  router.post('/', validateRequest(createPropertySchema), controller.create);
  router.get(
    '/:propertyId',
    validateRequest(propertyIdParamsSchema, 'params'),
    controller.get,
  );
  router.patch(
    '/:propertyId',
    validateRequest(propertyIdParamsSchema, 'params'),
    validateRequest(updatePropertySchema),
    controller.update,
  );
  router.post(
    '/:propertyId/archive',
    validateRequest(propertyIdParamsSchema, 'params'),
    controller.archive,
  );
  router.post(
    '/:propertyId/images',
    validateRequest(propertyImageParamsSchema, 'params'),
    createLoadOwnedProperty(propertyImageService, { writable: true }),
    propertyImageUpload,
    imageController.upload,
  );
  router.patch(
    '/:propertyId/images/:imageId',
    validateRequest(propertyImageParamsSchema, 'params'),
    createLoadOwnedProperty(propertyImageService),
    validateRequest(updatePropertyImageSchema),
    imageController.update,
  );
  router.delete(
    '/:propertyId/images/:imageId',
    validateRequest(propertyImageParamsSchema, 'params'),
    createLoadOwnedProperty(propertyImageService),
    imageController.delete,
  );
  return router;
}

export function createLandlordPropertyRouter(
  authService = defaultAuthService,
  propertyService = defaultPropertyService,
) {
  const router = landlordRouter(authService);
  const controller = createPropertyController(propertyService);
  router.get(
    '/',
    validateRequest(propertyListQuerySchema, 'query'),
    controller.list,
  );
  return router;
}
