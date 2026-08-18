import { AppError } from './AppError.js';

export function notFoundHandler(_request, _response, next) {
  next(
    new AppError({
      statusCode: 404,
      code: 'RESOURCE_NOT_FOUND',
      message: 'Route not found.',
    }),
  );
}
