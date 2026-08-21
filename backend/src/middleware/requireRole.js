import { AppError } from './AppError.js';

export function requireRole(...allowedRoles) {
  const roles = new Set(allowedRoles);

  return (request, _response, next) => {
    if (roles.has(request.profile.role)) {
      next();
      return;
    }

    next(
      new AppError({
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'You do not have permission to perform this action.',
      }),
    );
  };
}
