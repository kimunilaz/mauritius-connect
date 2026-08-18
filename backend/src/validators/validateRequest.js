import { AppError } from '../middleware/AppError.js';

export function validateRequest(schema, source = 'body') {
  return (request, _response, next) => {
    const result = schema.safeParse(request[source]);

    if (!result.success) {
      const fields = Object.fromEntries(
        result.error.issues.map((issue) => [
          issue.path.join('.') || source,
          issue.message,
        ]),
      );

      next(
        new AppError({
          statusCode: 422,
          code: 'VALIDATION_ERROR',
          message: 'Some fields are invalid.',
          fields,
        }),
      );
      return;
    }

    request[source] = result.data;
    next();
  };
}
