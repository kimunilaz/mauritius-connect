import multer from 'multer';
import { AppError } from './AppError.js';
import { MAX_IMAGE_BYTES } from '../services/imageProcessor.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_IMAGE_BYTES,
    files: 1,
    fields: 0,
    parts: 2,
  },
});

export function propertyImageUpload(request, response, next) {
  upload.single('image')(request, response, (error) => {
    if (!error) {
      next();
      return;
    }

    if (
      error instanceof multer.MulterError &&
      error.code === 'LIMIT_FILE_SIZE'
    ) {
      next(
        new AppError({
          statusCode: 413,
          code: 'IMAGE_TOO_LARGE',
          message: 'Property images must be 10 MB or smaller.',
        }),
      );
      return;
    }

    next(
      new AppError({
        statusCode: 422,
        code: 'INVALID_IMAGE_UPLOAD',
        message: 'Upload exactly one file using the image field.',
      }),
    );
  });
}
