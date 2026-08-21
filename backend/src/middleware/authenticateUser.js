import { authService as defaultAuthService } from '../services/authService.js';
import { AppError } from './AppError.js';
import { InvalidAccessTokenError } from '../services/authService.js';

function authRequiredError() {
  return new AppError({
    statusCode: 401,
    code: 'AUTH_REQUIRED',
    message: 'A Bearer access token is required.',
  });
}

export function createAuthenticateUser(authService = defaultAuthService) {
  return async (request, _response, next) => {
    const authorization = request.get('authorization');

    if (!authorization?.trim()) {
      next(authRequiredError());
      return;
    }

    const match = authorization.match(/^Bearer\s+([^\s]+)$/i);

    if (!match) {
      next(authRequiredError());
      return;
    }

    try {
      request.auth = await authService.authenticateAccessToken(match[1]);
      next();
    } catch (error) {
      if (error instanceof InvalidAccessTokenError) {
        next(
          new AppError({
            statusCode: 401,
            code: 'INVALID_TOKEN',
            message: 'The access token is invalid or expired.',
          }),
        );
        return;
      }

      next(error);
    }
  };
}

export const authenticateUser = createAuthenticateUser();
