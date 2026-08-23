import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createPublicListingTestContext } from '../helpers/createPublicListingTestContext.js';
import {
  LISTING_IDS,
  makeListing,
} from '../helpers/createListingTestContext.js';
import { makePropertyImage } from '../helpers/createPropertyImageTestContext.js';
import { makeProperty } from '../helpers/createPropertyTestContext.js';

const PROPERTY_IDS = Object.freeze({
  moka: '50000000-0000-4000-8000-000000000001',
  flacq: '50000000-0000-4000-8000-000000000002',
  archived: '50000000-0000-4000-8000-000000000003',
});

function id(number) {
  return `80000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
}

function publicDataset() {
  return {
    propertyRecords: [
      makeProperty({
        id: PROPERTY_IDS.moka,
        district: 'Moka',
        locality: 'Saint Pierre',
        neighbourhood: 'Helvetia',
        property_type: 'APARTMENT',
        bedrooms: 2,
        bathrooms: 1.5,
        furnished: true,
        verification_status: 'VERIFIED',
        landlord_id: 'private-landlord-a',
        address_line_1: '11 Private Road',
        address_line_2: 'Private unit',
        latitude: -20.22,
        longitude: 57.53,
        verification_notes: 'private evidence',
        landlord_email: 'private@example.test',
        landlord_phone: '+23050000000',
      }),
      makeProperty({
        id: PROPERTY_IDS.flacq,
        district: 'Flacq',
        locality: 'Centre de Flacq',
        neighbourhood: null,
        property_type: 'HOUSE',
        bedrooms: 4,
        bathrooms: 2,
        furnished: false,
        parking_spaces: 2,
        landlord_id: 'private-landlord-b',
      }),
      makeProperty({
        id: PROPERTY_IDS.archived,
        archived_at: '2026-08-20T00:00:00.000Z',
      }),
    ],
    listingRecords: [
      makeListing({
        id: id(1),
        property_id: PROPERTY_IDS.moka,
        status: 'ACTIVE',
        monthly_rent: '18000.00',
        available_from: '2026-10-01',
        pets_allowed: true,
        published_at: '2026-08-20T10:00:00.000Z',
      }),
      makeListing({
        id: id(2),
        property_id: PROPERTY_IDS.flacq,
        status: 'ACTIVE',
        title: 'Family house in Flacq',
        monthly_rent: '28000.00',
        available_from: '2026-09-15',
        pets_allowed: false,
        published_at: '2026-08-21T10:00:00.000Z',
      }),
      makeListing({
        id: id(3),
        property_id: PROPERTY_IDS.archived,
        status: 'ACTIVE',
      }),
      ...['DRAFT', 'PENDING_REVIEW', 'PAUSED', 'RENTED', 'CLOSED'].map(
        (status, index) =>
          makeListing({ id: id(index + 10), status, title: status }),
      ),
    ],
    imageRecords: [
      makePropertyImage({
        property_id: PROPERTY_IDS.moka,
        storage_path: 'private/moka-cover.jpg',
      }),
      makePropertyImage({
        id: '60000000-0000-4000-8000-000000000002',
        property_id: PROPERTY_IDS.moka,
        storage_path: 'private/moka-second.jpg',
        display_order: 1,
        is_cover: false,
      }),
      makePropertyImage({
        id: '60000000-0000-4000-8000-000000000003',
        property_id: PROPERTY_IDS.flacq,
        storage_path: 'private/flacq-cover.jpg',
      }),
    ],
  };
}

describe('public listing eligibility and privacy', () => {
  it('is anonymous and returns only ACTIVE listings on non-archived properties', async () => {
    const context = createPublicListingTestContext(publicDataset());
    const response = await request(context.app).get('/api/v1/listings');
    expect(response.status).toBe(200);
    expect(response.body.data.map((listing) => listing.id)).toEqual([
      id(2),
      id(1),
    ]);
    expect(response.body.meta).toEqual({
      page: 1,
      limit: 20,
      total: 2,
      total_pages: 1,
    });
  });

  it.each(['tenant-token', 'landlord-token'])(
    'returns the same public result when a %s Authorization header is present',
    async (token) => {
      const context = createPublicListingTestContext(publicDataset());
      const response = await request(context.app)
        .get('/api/v1/listings')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(200);
      expect(response.body.meta.total).toBe(2);
    },
  );

  it('uses an explicit card serializer and signs only each eligible cover', async () => {
    const context = createPublicListingTestContext(publicDataset());
    const response = await request(context.app).get('/api/v1/listings');
    const serialized = JSON.stringify(response.body.data);
    expect(response.body.data[1]).toMatchObject({
      id: id(1),
      monthly_rent: 18000,
      cover_image_url: expect.stringContaining('signed='),
      property: {
        district: 'Moka',
        locality: 'Saint Pierre',
        neighbourhood: 'Helvetia',
        property_information_verified: true,
      },
    });
    for (const privateValue of [
      'address_line_1',
      'address_line_2',
      'latitude',
      'longitude',
      'landlord_id',
      'landlord_email',
      'landlord_phone',
      'property_id',
      'storage_path',
      'verification_notes',
      '11 Private Road',
      'private@example.test',
    ]) {
      expect(serialized).not.toContain(privateValue);
    }
    expect(context.signedPaths).toEqual([
      'private/flacq-cover.jpg',
      'private/moka-cover.jpg',
    ]);
  });

  it('uses a null cover fallback when one signed URL cannot be prepared', async () => {
    const data = publicDataset();
    const context = createPublicListingTestContext({
      ...data,
      failingStoragePaths: ['private/moka-cover.jpg'],
    });
    const response = await request(context.app).get('/api/v1/listings');
    expect(response.status).toBe(200);
    expect(
      response.body.data.find((listing) => listing.id === id(1))
        .cover_image_url,
    ).toBeNull();
  });
});

describe('public listing filters', () => {
  it.each([
    ['district', 'moka', [id(1)]],
    ['locality', 'centre de flacq', [id(2)]],
    ['neighbourhood', 'helvetia', [id(1)]],
    ['property_type', 'HOUSE', [id(2)]],
    ['min_rent', '20000', [id(2)]],
    ['max_rent', '20000', [id(1)]],
    ['bedrooms', '3', [id(2)]],
    ['bathrooms', '1.6', [id(2)]],
    ['furnished', 'true', [id(1)]],
    ['furnished', 'false', [id(2)]],
    ['pets_allowed', 'true', [id(1)]],
    ['pets_allowed', 'false', [id(2)]],
    ['available_from', '2026-09-20', [id(2)]],
  ])('filters by %s=%s', async (field, value, expected) => {
    const context = createPublicListingTestContext(publicDataset());
    const response = await request(context.app).get(
      `/api/v1/listings?${field}=${encodeURIComponent(value)}`,
    );
    expect(response.status).toBe(200);
    expect(response.body.data.map((listing) => listing.id)).toEqual(expected);
  });

  it('supports combined rent and structured filters', async () => {
    const context = createPublicListingTestContext(publicDataset());
    const response = await request(context.app).get(
      '/api/v1/listings?district=Moka&min_rent=17000&max_rent=19000&bedrooms=2&bathrooms=1.5&furnished=true&pets_allowed=true&available_from=2026-10-01',
    );
    expect(response.status).toBe(200);
    expect(response.body.data.map((listing) => listing.id)).toEqual([id(1)]);
  });

  it.each([
    '?property_type=CASTLE',
    '?min_rent=-1',
    '?min_rent=20000&max_rent=10000',
    '?bedrooms=1.5',
    '?bathrooms=1.55',
    '?furnished=yes',
    '?pets_allowed=1',
    '?available_from=2026-02-30',
    '?unknown=value',
  ])('rejects invalid filter %s', async (query) => {
    const context = createPublicListingTestContext(publicDataset());
    const response = await request(context.app).get(`/api/v1/listings${query}`);
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('public listing sorting and pagination', () => {
  it.each([
    ['newest', [id(2), id(1)]],
    ['rent_low', [id(1), id(2)]],
    ['rent_high', [id(2), id(1)]],
    ['available_soon', [id(2), id(1)]],
  ])('supports the %s sort', async (sort, expected) => {
    const context = createPublicListingTestContext(publicDataset());
    const response = await request(context.app).get(
      `/api/v1/listings?sort=${sort}`,
    );
    expect(response.status).toBe(200);
    expect(response.body.data.map((listing) => listing.id)).toEqual(expected);
  });

  it('uses listing ID as a deterministic final tie-breaker', async () => {
    const data = publicDataset();
    data.listingRecords[1] = makeListing({
      ...data.listingRecords[1],
      monthly_rent: '18000.00',
      published_at: data.listingRecords[0].published_at,
    });
    const context = createPublicListingTestContext(data);
    const response = await request(context.app).get(
      '/api/v1/listings?sort=rent_low',
    );
    expect(response.body.data.map((listing) => listing.id)).toEqual([
      id(1),
      id(2),
    ]);
  });

  it('rejects an invalid sort instead of accepting a column name', async () => {
    const context = createPublicListingTestContext(publicDataset());
    const response = await request(context.app).get(
      '/api/v1/listings?sort=landlord_id',
    );
    expect(response.status).toBe(422);
  });

  it('supports page 2, custom limits, and correct totals', async () => {
    const data = publicDataset();
    data.listingRecords = Array.from({ length: 5 }, (_, index) =>
      makeListing({
        id: id(index + 1),
        status: 'ACTIVE',
        published_at: `2026-08-${String(index + 10).padStart(2, '0')}T00:00:00.000Z`,
      }),
    );
    const context = createPublicListingTestContext(data);
    const response = await request(context.app).get(
      '/api/v1/listings?page=2&limit=2',
    );
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(2);
    expect(response.body.meta).toEqual({
      page: 2,
      limit: 2,
      total: 5,
      total_pages: 3,
    });
  });

  it('accepts the maximum limit and rejects invalid pagination', async () => {
    const context = createPublicListingTestContext(publicDataset());
    expect(
      (await request(context.app).get('/api/v1/listings?limit=100')).status,
    ).toBe(200);
    for (const query of ['?page=0', '?page=-1', '?limit=0', '?limit=101']) {
      expect(
        (await request(context.app).get(`/api/v1/listings${query}`)).status,
      ).toBe(422);
    }
  });
});

describe('public listing detail', () => {
  it('returns public-safe ACTIVE detail with ordered signed images', async () => {
    const context = createPublicListingTestContext(publicDataset());
    const response = await request(context.app).get(
      `/api/v1/listings/${id(1)}`,
    );
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      id: id(1),
      description: expect.any(String),
      deposit_amount: 18000,
      property: {
        district: 'Moka',
        neighbourhood: 'Helvetia',
      },
    });
    expect(response.body.data.images.map((image) => image.id)).toEqual([
      '60000000-0000-4000-8000-000000000001',
      '60000000-0000-4000-8000-000000000002',
    ]);
    expect(response.body.data.images[0]).toMatchObject({
      url: expect.stringContaining('signed='),
      display_order: 0,
      is_cover: true,
    });
    const serialized = JSON.stringify(response.body.data);
    for (const privateField of [
      'address_line_1',
      'address_line_2',
      'latitude',
      'longitude',
      'landlord_id',
      'property_id',
      'storage_path',
      'verification_notes',
    ]) {
      expect(serialized).not.toContain(privateField);
    }
  });

  it('omits only an unavailable image rather than failing detail', async () => {
    const data = publicDataset();
    const context = createPublicListingTestContext({
      ...data,
      failingStoragePaths: ['private/moka-second.jpg'],
    });
    const response = await request(context.app).get(
      `/api/v1/listings/${id(1)}`,
    );
    expect(response.status).toBe(200);
    expect(response.body.data.images).toHaveLength(1);
  });

  it.each(['DRAFT', 'PENDING_REVIEW', 'PAUSED', 'RENTED', 'CLOSED'])(
    'returns privacy-preserving 404 for a %s listing without signing images',
    async (status) => {
      const context = createPublicListingTestContext({
        listingRecords: [makeListing({ status })],
      });
      const response = await request(context.app).get(
        `/api/v1/listings/${LISTING_IDS.a}`,
      );
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('LISTING_NOT_FOUND');
      expect(context.signedPaths).toHaveLength(0);
    },
  );

  it('returns 404 for archived-property and unknown listings', async () => {
    const archived = createPublicListingTestContext({
      propertyRecords: [
        makeProperty({ archived_at: '2026-08-21T00:00:00.000Z' }),
      ],
      listingRecords: [makeListing({ status: 'ACTIVE' })],
    });
    const hidden = await request(archived.app).get(
      `/api/v1/listings/${LISTING_IDS.a}`,
    );
    expect(hidden.status).toBe(404);
    expect(archived.signedPaths).toHaveLength(0);

    const unknown = await request(archived.app).get(
      '/api/v1/listings/80000000-0000-4000-8000-999999999999',
    );
    expect(unknown.status).toBe(404);
  });

  it('rejects an invalid listing UUID safely', async () => {
    const context = createPublicListingTestContext(publicDataset());
    const response = await request(context.app).get(
      '/api/v1/listings/not-a-uuid',
    );
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});
