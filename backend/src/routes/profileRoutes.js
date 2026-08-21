import { Router } from 'express';
import { createProfileController } from '../controllers/profileController.js';
import { createAuthenticateUser } from '../middleware/authenticateUser.js';
import { createLoadApplicationProfile } from '../middleware/loadApplicationProfile.js';
import { requireActiveAccount } from '../middleware/requireActiveAccount.js';
import { requireRole } from '../middleware/requireRole.js';
import { authService as defaultAuthService } from '../services/authService.js';
import { profileService as defaultProfileService } from '../services/profileService.js';
import {
  baseProfilePatchSchema,
  locationIdParamsSchema,
  preferredLocationSchema,
  tenantProfilePatchSchema,
} from '../validators/profileValidators.js';
import { validateRequest } from '../validators/validateRequest.js';

function securedRouter(role, authService) {
  const router = Router();
  router.use(
    createAuthenticateUser(authService),
    createLoadApplicationProfile(authService),
    requireActiveAccount,
    requireRole(role),
  );
  return router;
}

export function createTenantRouter(
  authService = defaultAuthService,
  profileService = defaultProfileService,
) {
  const router = securedRouter('TENANT', authService);
  const controller = createProfileController(profileService);

  router.get('/profile', controller.getTenantProfile);
  router.patch(
    '/profile',
    validateRequest(tenantProfilePatchSchema),
    controller.updateTenantProfile,
  );
  router.get('/preferred-locations', controller.listPreferredLocations);
  router.post(
    '/preferred-locations',
    validateRequest(preferredLocationSchema),
    controller.addPreferredLocation,
  );
  router.delete(
    '/preferred-locations/:id',
    validateRequest(locationIdParamsSchema, 'params'),
    controller.deletePreferredLocation,
  );
  return router;
}

export function createLandlordRouter(
  authService = defaultAuthService,
  profileService = defaultProfileService,
) {
  const router = securedRouter('LANDLORD', authService);
  const controller = createProfileController(profileService);

  router.get('/profile', controller.getLandlordProfile);
  router.patch(
    '/profile',
    validateRequest(baseProfilePatchSchema),
    controller.updateLandlordProfile,
  );
  return router;
}

export function createBaseProfileRouter(
  authService = defaultAuthService,
  profileService = defaultProfileService,
) {
  const router = Router();
  const controller = createProfileController(profileService);
  router.patch(
    '/',
    createAuthenticateUser(authService),
    createLoadApplicationProfile(authService),
    requireActiveAccount,
    requireRole('TENANT', 'LANDLORD'),
    validateRequest(baseProfilePatchSchema),
    controller.updateBaseProfile,
  );
  return router;
}
