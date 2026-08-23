import { Buffer } from 'node:buffer';
import sharp from 'sharp';
import { AppError } from '../middleware/AppError.js';

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 40_000_000;

const formats = Object.freeze({
  jpeg: { extension: 'jpg', mimeType: 'image/jpeg' },
  png: { extension: 'png', mimeType: 'image/png' },
  webp: { extension: 'webp', mimeType: 'image/webp' },
});

function invalidImage(message = 'Upload a valid JPEG, PNG, or WebP image.') {
  return new AppError({
    statusCode: 422,
    code: 'UNSUPPORTED_IMAGE',
    message,
  });
}

export async function processPropertyImage(input) {
  if (!Buffer.isBuffer(input) || input.length === 0) throw invalidImage();
  if (input.length > MAX_IMAGE_BYTES) {
    throw new AppError({
      statusCode: 413,
      code: 'IMAGE_TOO_LARGE',
      message: 'Property images must be 10 MB or smaller.',
    });
  }

  try {
    const source = sharp(input, {
      failOn: 'error',
      limitInputPixels: MAX_IMAGE_PIXELS,
    });
    const metadata = await source.metadata();
    const format = formats[metadata.format];
    if (!format || !metadata.width || !metadata.height) throw invalidImage();

    let pipeline = source.rotate();
    if (metadata.format === 'jpeg') {
      pipeline = pipeline.jpeg({ quality: 85, mozjpeg: true });
    } else if (metadata.format === 'png') {
      pipeline = pipeline.png({ compressionLevel: 9 });
    } else {
      pipeline = pipeline.webp({ quality: 85 });
    }

    const buffer = await pipeline.toBuffer();
    if (buffer.length > MAX_IMAGE_BYTES) {
      throw new AppError({
        statusCode: 413,
        code: 'IMAGE_TOO_LARGE',
        message: 'The safely processed image exceeds the 10 MB limit.',
      });
    }

    return { buffer, ...format };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw invalidImage(
      'The image is unsupported, corrupt, or too large to process safely.',
    );
  }
}
