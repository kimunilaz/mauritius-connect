import { Router } from 'express';
import { createAuthController } from '../controllers/authController.js';
import { createAuthenticateUser } from '../middleware/authenticateUser.js';
import { createLoadApplicationProfile } from '../middleware/loadApplicationProfile.js';
import { requireActiveAccount } from '../middleware/requireActiveAccount.js';
import { authService as defaultAuthService } from '../services/authService.js';
import { registerProfileSchema } from '../validators/authValidators.js';
import { validateRequest } from '../validators/validateRequest.js';

export function createAuthRouter(authService = defaultAuthService) {
  const authRouter = Router();
  const controller = createAuthController(authService);
  const authenticateUser = createAuthenticateUser(authService);
  const loadApplicationProfile = createLoadApplicationProfile(authService);

  authRouter.post(
    '/register-profile',
    authenticateUser,
    validateRequest(registerProfileSchema),
    controller.registerProfile,
  );

  authRouter.get(
    '/me',
    authenticateUser,
    loadApplicationProfile,
    requireActiveAccount,
    controller.getCurrentUser,
  );

  return authRouter;
}

export default createAuthRouter();
