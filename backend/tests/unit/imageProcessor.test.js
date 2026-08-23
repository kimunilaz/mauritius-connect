import { Buffer } from 'node:buffer';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { processPropertyImage } from '../../src/services/imageProcessor.js';

async function makeImage(format, metadata = false) {
  let pipeline = sharp({
    create: {
      width: 8,
      height: 6,
      channels: 3,
      background: '#2f6f52',
    },
  }).toFormat(format);
  if (metadata) pipeline = pipeline.withMetadata({ orientation: 6 });
  return pipeline.toBuffer();
}

describe('property image content processing', () => {
  it.each([
    ['jpeg', 'image/jpeg', 'jpg'],
    ['png', 'image/png', 'png'],
    ['webp', 'image/webp', 'webp'],
  ])(
    'accepts and safely re-encodes %s content',
    async (format, mime, extension) => {
      const result = await processPropertyImage(await makeImage(format));
      expect(result).toMatchObject({ mimeType: mime, extension });
      const metadata = await sharp(result.buffer).metadata();
      expect(metadata.format).toBe(format);
    },
  );

  it('strips EXIF metadata while applying orientation', async () => {
    const result = await processPropertyImage(await makeImage('jpeg', true));
    const metadata = await sharp(result.buffer).metadata();
    expect(metadata.exif).toBeUndefined();
    expect(metadata.orientation).toBeUndefined();
    expect(metadata.width).toBe(6);
    expect(metadata.height).toBe(8);
  });

  it.each([
    ['text', Buffer.from('not an image')],
    ['svg', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')],
    ['html', Buffer.from('<html><body>no</body></html>')],
    ['pdf', Buffer.from('%PDF-1.7')],
    ['empty', Buffer.alloc(0)],
  ])(
    'rejects actual %s content regardless of claimed type',
    async (_label, input) => {
      await expect(processPropertyImage(input)).rejects.toMatchObject({
        statusCode: 422,
        code: 'UNSUPPORTED_IMAGE',
      });
    },
  );

  it('rejects input above the byte limit before decoding', async () => {
    await expect(
      processPropertyImage(Buffer.alloc(10 * 1024 * 1024 + 1)),
    ).rejects.toMatchObject({ statusCode: 413, code: 'IMAGE_TOO_LARGE' });
  });
});
