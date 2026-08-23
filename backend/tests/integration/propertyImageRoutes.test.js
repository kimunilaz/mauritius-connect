import { Buffer } from 'node:buffer';
import request from 'supertest';
import sharp from 'sharp';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { makeProfile, TEST_USERS } from '../helpers/createAuthTestContext.js';
import {
  createPropertyImageTestContext,
  makePropertyImage,
} from '../helpers/createPropertyImageTestContext.js';
import {
  LANDLORD_PROFILE_IDS,
  makeProperty,
} from '../helpers/createPropertyTestContext.js';

const PROPERTY_ID = '50000000-0000-4000-8000-000000000001';
const OTHER_IMAGE_ID = '60000000-0000-4000-8000-000000000099';
const auth = (builder, token = 'landlord-token') =>
  builder.set('Authorization', `Bearer ${token}`);
let jpeg;

beforeAll(async () => {
  jpeg = await sharp({
    create: {
      width: 4,
      height: 3,
      channels: 3,
      background: '#abcdef',
    },
  })
    .jpeg()
    .toBuffer();
});

function upload(app, propertyId = PROPERTY_ID, token = 'landlord-token') {
  return auth(
    request(app).post(`/api/v1/properties/${propertyId}/images`),
    token,
  ).attach('image', jpeg, {
    filename: '../../untrusted.exe',
    contentType: 'application/octet-stream',
  });
}

describe('property image upload security', () => {
  it('accepts actual image contents, generates its path, and assigns cover/order', async () => {
    const context = createPropertyImageTestContext();
    const first = await upload(context.app);
    const second = await upload(context.app);

    expect(first.status).toBe(201);
    expect(first.body.data).toMatchObject({ display_order: 0, is_cover: true });
    expect(second.body.data).toMatchObject({
      display_order: 1,
      is_cover: false,
    });
    expect(first.body.data.url).toMatch(/^https:\/\/storage\.test\/private\//);
    expect(first.body.data).not.toHaveProperty('storage_path');
    expect(context.uploadedPaths[0]).toMatch(
      new RegExp(`^${TEST_USERS.landlord}/${PROPERTY_ID}/[a-f0-9-]+\\.jpg$`),
    );
    expect(context.uploadedPaths[0]).not.toContain('untrusted');
  });

  it('requires one image field and rejects non-image contents', async () => {
    const context = createPropertyImageTestContext();
    const missing = await auth(
      request(context.app).post(`/api/v1/properties/${PROPERTY_ID}/images`),
    );
    expect(missing.status).toBe(422);
    expect(missing.body.error.code).toBe('IMAGE_REQUIRED');

    const invalid = await auth(
      request(context.app).post(`/api/v1/properties/${PROPERTY_ID}/images`),
    ).attach('image', Buffer.from('<html>not an image</html>'), {
      filename: 'photo.jpg',
      contentType: 'image/jpeg',
    });
    expect(invalid.status).toBe(422);
    expect(invalid.body.error.code).toBe('UNSUPPORTED_IMAGE');
  });

  it('rejects oversized and multiple multipart files', async () => {
    const context = createPropertyImageTestContext();
    const oversized = await auth(
      request(context.app).post(`/api/v1/properties/${PROPERTY_ID}/images`),
    ).attach('image', Buffer.alloc(10 * 1024 * 1024 + 1), 'large.jpg');
    expect(oversized.status).toBe(413);
    expect(oversized.body.error.code).toBe('IMAGE_TOO_LARGE');

    const multiple = await auth(
      request(context.app).post(`/api/v1/properties/${PROPERTY_ID}/images`),
    )
      .attach('image', jpeg, 'one.jpg')
      .attach('image', jpeg, 'two.jpg');
    expect(multiple.status).toBe(422);
    expect(multiple.body.error.code).toBe('INVALID_IMAGE_UPLOAD');
  });

  it('enforces the 20-image maximum', async () => {
    const imageRecords = Array.from({ length: 20 }, (_, index) =>
      makePropertyImage({
        id: `60000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
        display_order: index,
        is_cover: index === 0,
      }),
    );
    const response = await upload(
      createPropertyImageTestContext({ imageRecords }).app,
    );
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('PROPERTY_IMAGE_LIMIT_REACHED');
  });

  it('checks ownership and archived state before image processing', async () => {
    const processor = vi.fn();
    const foreign = createPropertyImageTestContext({
      propertyRecords: [makeProperty({ landlord_id: LANDLORD_PROFILE_IDS.b })],
      processor,
    });
    const denied = await upload(foreign.app);
    expect(denied.status).toBe(404);

    const archived = createPropertyImageTestContext({
      propertyRecords: [
        makeProperty({ archived_at: '2026-08-21T00:00:00.000Z' }),
      ],
      processor,
    });
    const conflict = await upload(archived.app);
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe('PROPERTY_ARCHIVED');
    expect(processor).not.toHaveBeenCalled();
  });

  it('blocks anonymous, TENANT, SUSPENDED, and DELETED callers', async () => {
    const context = createPropertyImageTestContext();
    expect(
      (
        await request(context.app).post(
          `/api/v1/properties/${PROPERTY_ID}/images`,
        )
      ).status,
    ).toBe(401);
    expect(
      (await upload(context.app, PROPERTY_ID, 'tenant-token')).status,
    ).toBe(403);

    for (const status of ['SUSPENDED', 'DELETED']) {
      const blocked = createPropertyImageTestContext({
        applicationProfiles: [
          makeProfile(),
          makeProfile({
            id: TEST_USERS.landlord,
            role: 'LANDLORD',
            account_status: status,
          }),
        ],
      });
      const response = await upload(blocked.app);
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe(
        status === 'SUSPENDED' ? 'ACCOUNT_SUSPENDED' : 'ACCOUNT_DELETED',
      );
    }
  });

  it('removes a stored object if metadata creation fails', async () => {
    const context = createPropertyImageTestContext({
      failMetadataCreate: true,
    });
    const response = await upload(context.app);
    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe('IMAGE_METADATA_FAILED');
    expect(context.removedPaths).toEqual(context.uploadedPaths);
    expect(context.objects.size).toBe(0);
  });

  it('reports storage upload and signed URL failures safely', async () => {
    const uploadFailure = createPropertyImageTestContext({
      failStorageUpload: true,
    });
    const failed = await upload(uploadFailure.app);
    expect(failed.status).toBe(502);
    expect(failed.body.error.code).toBe('UPLOAD_FAILED');

    const urlFailure = createPropertyImageTestContext({ failSignedUrl: true });
    const noUrl = await upload(urlFailure.app);
    expect(noUrl.status).toBe(502);
    expect(noUrl.body.error.code).toBe('IMAGE_URL_FAILED');
    expect(urlFailure.imageRecords.size).toBe(1);
    expect(urlFailure.objects.size).toBe(1);
  });
});

describe('property image management', () => {
  const secondImage = () =>
    makePropertyImage({
      id: '60000000-0000-4000-8000-000000000002',
      storage_path: `${TEST_USERS.landlord}/${PROPERTY_ID}/second.png`,
      display_order: 1,
      is_cover: false,
    });

  it('includes ordered private images in owned property detail', async () => {
    const context = createPropertyImageTestContext({
      imageRecords: [secondImage(), makePropertyImage()],
    });
    const response = await auth(
      request(context.app).get(`/api/v1/properties/${PROPERTY_ID}`),
    );
    expect(response.status).toBe(200);
    expect(response.body.data.images).toHaveLength(2);
    expect(response.body.data.images[0]).toMatchObject({
      display_order: 0,
      is_cover: true,
    });
    expect(response.body.data.images[0]).not.toHaveProperty('storage_path');
  });

  it('switches cover and updates display order', async () => {
    const context = createPropertyImageTestContext({
      imageRecords: [makePropertyImage(), secondImage()],
    });
    const cover = await auth(
      request(context.app).patch(
        `/api/v1/properties/${PROPERTY_ID}/images/${secondImage().id}`,
      ),
    ).send({ is_cover: true });
    expect(cover.status).toBe(200);
    expect(context.imageRecords.get(secondImage().id).is_cover).toBe(true);
    expect(
      context.imageRecords.get('60000000-0000-4000-8000-000000000001').is_cover,
    ).toBe(false);

    const order = await auth(
      request(context.app).patch(
        `/api/v1/properties/${PROPERTY_ID}/images/${secondImage().id}`,
      ),
    ).send({ display_order: 5 });
    expect(order.body.data.display_order).toBe(5);
  });

  it.each([
    [{ is_cover: false }, 'false cover'],
    [{ display_order: -1 }, 'negative order'],
    [{ storage_path: 'attacker/path' }, 'protected path'],
    [{ property_id: TEST_USERS.other }, 'protected property'],
    [{ id: TEST_USERS.other }, 'protected id'],
    [{}, 'empty update'],
  ])('rejects %s image updates', async (body) => {
    const context = createPropertyImageTestContext({
      imageRecords: [makePropertyImage()],
    });
    const response = await auth(
      request(context.app).patch(
        `/api/v1/properties/${PROPERTY_ID}/images/60000000-0000-4000-8000-000000000001`,
      ),
    ).send(body);
    expect(response.status).toBe(422);
  });

  it('privacy-preserves an image outside the property scope', async () => {
    const context = createPropertyImageTestContext({
      imageRecords: [
        makePropertyImage({
          id: OTHER_IMAGE_ID,
          property_id: TEST_USERS.other,
        }),
      ],
    });
    const response = await auth(
      request(context.app).delete(
        `/api/v1/properties/${PROPERTY_ID}/images/${OTHER_IMAGE_ID}`,
      ),
    );
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('PROPERTY_IMAGE_NOT_FOUND');
  });

  it('deletes an image and deterministically promotes the next image', async () => {
    const context = createPropertyImageTestContext({
      imageRecords: [makePropertyImage(), secondImage()],
    });
    const response = await auth(
      request(context.app).delete(
        `/api/v1/properties/${PROPERTY_ID}/images/60000000-0000-4000-8000-000000000001`,
      ),
    );
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].is_cover).toBe(true);
    expect(
      context.imageRecords.has('60000000-0000-4000-8000-000000000001'),
    ).toBe(false);
  });

  it('allows deletion of the last image', async () => {
    const context = createPropertyImageTestContext({
      imageRecords: [makePropertyImage()],
    });
    const response = await auth(
      request(context.app).delete(
        `/api/v1/properties/${PROPERTY_ID}/images/60000000-0000-4000-8000-000000000001`,
      ),
    );
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
    expect(context.imageRecords.size).toBe(0);
    expect(context.objects.size).toBe(0);
  });

  it('does not remove metadata when Storage deletion fails', async () => {
    const context = createPropertyImageTestContext({
      imageRecords: [makePropertyImage()],
      failStorageDelete: true,
    });
    const response = await auth(
      request(context.app).delete(
        `/api/v1/properties/${PROPERTY_ID}/images/60000000-0000-4000-8000-000000000001`,
      ),
    );
    expect(response.status).toBe(502);
    expect(response.body.error.code).toBe('IMAGE_DELETE_FAILED');
    expect(context.imageRecords.size).toBe(1);
  });

  it('restores the object when metadata deletion fails', async () => {
    const context = createPropertyImageTestContext({
      imageRecords: [makePropertyImage()],
      failMetadataDelete: true,
    });
    const response = await auth(
      request(context.app).delete(
        `/api/v1/properties/${PROPERTY_ID}/images/60000000-0000-4000-8000-000000000001`,
      ),
    );
    expect(response.status).toBe(500);
    expect(context.imageRecords.size).toBe(1);
    expect(context.objects.size).toBe(1);
  });
});
