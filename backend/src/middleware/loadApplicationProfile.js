import { authService as defaultAuthService } from '../services/authService.js';
import { AppError } from './AppError.js';

export function createLoadApplicationProfile(authService = defaultAuthService) {
  return async (request, _response, next) => {
    try {
      const profile = await authService.loadProfile(request.auth.userId);

      if (!profile) {
        next(
          new AppError({
            statusCode: 403,
            code: 'ONBOARDING_REQUIRED',
            message: 'Complete application profile onboarding to continue.',
          }),
        );
        return;
      }

      request.profile = profile;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export const loadApplicationProfile = createLoadApplicationProfile();
