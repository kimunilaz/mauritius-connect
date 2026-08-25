import { env } from '../config/env.js';
import { AppError } from './AppError.js';

function normalizeError(error) {
  if (error instanceof AppError) {
    return error;
  }

  if (error.type === 'entity.parse.failed') {
    return new AppError({
      statusCode: 400,
      code: 'INVALID_JSON',
      message: 'Request body contains invalid JSON.',
    });
  }

  if (error.code === 'LIMIT_FILE_SIZE') {
    return new AppError({
      statusCode: 413,
      code: 'UPLOAD_TOO_LARGE',
      message: 'Uploaded file exceeds the permitted size.',
    });
  }
  if (error.name === 'MulterError') {
    return new AppError({
      statusCode: 422,
      code: 'INVALID_UPLOAD',
      message: 'The upload could not be accepted.',
    });
  }

  return new AppError({
    statusCode: 500,
    code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred.',
  });
}

export function errorHandler(error, _request, response, _next) {
  const safeError = normalizeError(error);

  if (safeError.statusCode >= 500 && env.nodeEnv !== 'test') {
    console.error(`Unhandled API error: ${error.name ?? 'Error'}.`);
  }

  const errorBody = {
    code: safeError.code,
    message: safeError.message,
  };

  if (safeError.fields) {
    errorBody.fields = safeError.fields;
  }

  response.status(safeError.statusCode).json({
    success: false,
    error: errorBody,
  });
}
