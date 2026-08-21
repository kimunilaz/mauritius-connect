import { AppError } from './AppError.js';

export function requireActiveAccount(request, _response, next) {
  if (request.profile.account_status === 'ACTIVE') {
    next();
    return;
  }

  if (request.profile.account_status === 'SUSPENDED') {
    next(
      new AppError({
        statusCode: 403,
        code: 'ACCOUNT_SUSPENDED',
        message: 'This account is suspended.',
      }),
    );
    return;
  }

  next(
    new AppError({
      statusCode: 403,
      code: 'ACCOUNT_DELETED',
      message: 'This account is not available.',
    }),
  );
}
