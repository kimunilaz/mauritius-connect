import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { makeProfile, TEST_USERS } from '../helpers/createAuthTestContext.js';
import {
  createListingTestContext,
  LISTING_IDS,
  makeListing,
  otherLandlordProperty,
} from '../helpers/createListingTestContext.js';
import { makePropertyImage } from '../helpers/createPropertyImageTestContext.js';
import { makeProperty } from '../helpers/createPropertyTestContext.js';

const PROPERTY_ID = '50000000-0000-4000-8000-000000000001';
const auth = (builder, token = 'landlord-token') =>
  builder.set('Authorization', `Bearer ${token}`);
const validListing = {
  property_id: PROPERTY_ID,
  title: ' Modern apartment in Moka ',
  description: ' Bright and comfortable long-term home. ',
  monthly_rent: 18000,
  deposit_amount: 18000,
  available_from: '2026-10-01',
  minimum_lease_months: 6,
  maximum_occupants: 3,
  pets_allowed: false,
};

describe('listing creation and validation', () => {
  it('creates an owned listing as a server-controlled DRAFT', async () => {
    const context = createListingTestContext();
    const response = await auth(
      request(context.app).post('/api/v1/listings'),
    ).send(validListing);
    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      property_id: PROPERTY_ID,
      title: 'Modern apartment in Moka',
      description: 'Bright and comfortable long-term home.',
      monthly_rent: 18000,
      status: 'DRAFT',
      published_at: null,
      closed_at: null,
    });
  });

  it.each([
    ['id', LISTING_IDS.b],
    ['status', 'ACTIVE'],
    ['published_at', '2026-08-21T00:00:00Z'],
    ['closed_at', '2026-08-21T00:00:00Z'],
    ['created_at', '2026-08-21T00:00:00Z'],
    ['updated_at', '2026-08-21T00:00:00Z'],
  ])('rejects protected create field %s', async (field, value) => {
    const context = createListingTestContext();
    const response = await auth(
      request(context.app).post('/api/v1/listings'),
    ).send({ ...validListing, [field]: value });
    expect(response.status).toBe(422);
    expect(context.listingRecords).toHaveLength(0);
  });

  it.each([
    ['empty title', { title: ' ' }],
    ['oversized title', { title: 'x'.repeat(201) }],
    ['empty description', { description: '' }],
    ['oversized description', { description: 'x'.repeat(5001) }],
    ['zero rent', { monthly_rent: 0 }],
    ['negative rent', { monthly_rent: -1 }],
    ['negative deposit', { deposit_amount: -1 }],
    ['invalid date', { available_from: '2026-02-30' }],
    ['zero lease duration', { minimum_lease_months: 0 }],
    ['zero occupants', { maximum_occupants: 0 }],
    ['invalid boolean', { pets_allowed: 'false' }],
    ['invalid property UUID', { property_id: 'not-a-uuid' }],
  ])('rejects %s', async (_label, override) => {
    const context = createListingTestContext();
    const response = await auth(
      request(context.app).post('/api/v1/listings'),
    ).send({ ...validListing, ...override });
    expect(response.status).toBe(422);
    expect(context.listingRecords).toHaveLength(0);
  });

  it('rejects archived and foreign properties', async () => {
    const archived = createListingTestContext({
      propertyRecords: [
        makeProperty({ archived_at: '2026-08-21T00:00:00.000Z' }),
      ],
    });
    const archivedResponse = await auth(
      request(archived.app).post('/api/v1/listings'),
    ).send(validListing);
    expect(archivedResponse.status).toBe(409);
    expect(archivedResponse.body.error.code).toBe('PROPERTY_ARCHIVED');

    const foreign = createListingTestContext({
      propertyRecords: [otherLandlordProperty({ id: PROPERTY_ID })],
    });
    const foreignResponse = await auth(
      request(foreign.app).post('/api/v1/listings'),
    ).send(validListing);
    expect(foreignResponse.status).toBe(404);
    expect(foreignResponse.body.error.code).toBe('PROPERTY_NOT_FOUND');
  });
});

describe('landlord listing reads and edits', () => {
  it('lists only owned listings with pagination, filtering, and one cover', async () => {
    const listings = Array.from({ length: 25 }, (_, index) =>
      makeListing({
        id: `80000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
        status: index % 2 ? 'DRAFT' : 'CLOSED',
        created_at: `2026-08-${String((index % 20) + 1).padStart(2, '0')}T00:00:00.000Z`,
      }),
    );
    listings.push(
      makeListing({
        id: '80000000-0000-4000-8000-000000000099',
        property_id: '50000000-0000-4000-8000-000000000002',
      }),
    );
    const context = createListingTestContext({
      propertyRecords: [makeProperty(), otherLandlordProperty()],
      listingRecords: listings,
    });
    const response = await auth(
      request(context.app).get(
        '/api/v1/landlord/listings?page=1&limit=10&status=DRAFT',
      ),
    );
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(10);
    expect(
      response.body.data.every((listing) => listing.status === 'DRAFT'),
    ).toBe(true);
    expect(response.body.data[0].cover_image).toMatchObject({ is_cover: true });
    expect(response.body.meta).toMatchObject({
      page: 1,
      limit: 10,
      total: 12,
      total_pages: 2,
    });
  });

  it.each([
    ['page zero', '?page=0'],
    ['limit over max', '?limit=101'],
    ['invalid status', '?status=PUBLIC'],
  ])('rejects invalid list query: %s', async (_label, query) => {
    const context = createListingTestContext();
    const response = await auth(
      request(context.app).get(`/api/v1/landlord/listings${query}`),
    );
    expect(response.status).toBe(422);
  });

  it('returns private owned detail with all property images', async () => {
    const context = createListingTestContext({
      listingRecords: [makeListing()],
      imageRecords: [
        makePropertyImage(),
        makePropertyImage({
          id: '60000000-0000-4000-8000-000000000002',
          display_order: 1,
          is_cover: false,
        }),
      ],
    });
    const response = await auth(
      request(context.app).get(`/api/v1/landlord/listings/${LISTING_IDS.a}`),
    );
    expect(response.status).toBe(200);
    expect(response.body.data.images).toHaveLength(2);
    expect(response.body.data.property).toMatchObject({
      id: PROPERTY_ID,
      locality: 'Moka',
    });
    expect(response.body.data.property).not.toHaveProperty('landlord_id');
  });

  it.each(['DRAFT', 'PAUSED'])(
    'edits allowlisted fields while %s',
    async (status) => {
      const context = createListingTestContext({
        listingRecords: [makeListing({ status })],
      });
      const response = await auth(
        request(context.app).patch(`/api/v1/listings/${LISTING_IDS.a}`),
      ).send({ title: ' Updated listing ', monthly_rent: 19000 });
      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        title: 'Updated listing',
        monthly_rent: 19000,
        status,
      });
    },
  );

  it.each(['PENDING_REVIEW', 'ACTIVE', 'RENTED', 'CLOSED'])(
    'blocks normal editing while %s',
    async (status) => {
      const context = createListingTestContext({
        listingRecords: [makeListing({ status })],
      });
      const response = await auth(
        request(context.app).patch(`/api/v1/listings/${LISTING_IDS.a}`),
      ).send({ title: 'Not allowed' });
      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('LISTING_NOT_EDITABLE');
    },
  );

  it.each([
    ['property_id', TEST_USERS.other],
    ['status', 'ACTIVE'],
    ['published_at', '2026-08-21T00:00:00Z'],
    ['closed_at', '2026-08-21T00:00:00Z'],
    ['id', LISTING_IDS.b],
  ])('rejects protected update field %s', async (field, value) => {
    const context = createListingTestContext({
      listingRecords: [makeListing()],
    });
    const response = await auth(
      request(context.app).patch(`/api/v1/listings/${LISTING_IDS.a}`),
    ).send({ [field]: value });
    expect(response.status).toBe(422);
    expect(context.listingRecords[0].status).toBe('DRAFT');
    expect(context.listingRecords[0].property_id).toBe(PROPERTY_ID);
  });
});

describe('listing publication readiness and state machine', () => {
  it('rejects publish without an image and reports safe readiness reasons', async () => {
    const context = createListingTestContext({
      listingRecords: [makeListing()],
      imageRecords: [],
    });
    const response = await auth(
      request(context.app).post(`/api/v1/listings/${LISTING_IDS.a}/publish`),
    );
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('LISTING_NOT_READY');
    expect(response.body.error.fields.readiness).toEqual(
      expect.arrayContaining([
        'PROPERTY_IMAGE_REQUIRED',
        'COVER_IMAGE_REQUIRED',
      ]),
    );
  });

  it('rejects publish when images have no cover', async () => {
    const context = createListingTestContext({
      listingRecords: [makeListing()],
      imageRecords: [makePropertyImage({ is_cover: false })],
    });
    const response = await auth(
      request(context.app).post(`/api/v1/listings/${LISTING_IDS.a}/publish`),
    );
    expect(response.status).toBe(409);
    expect(response.body.error.fields.readiness).toContain(
      'COVER_IMAGE_REQUIRED',
    );
  });

  it('revalidates stored listing fields before publication', async () => {
    const context = createListingTestContext({
      listingRecords: [
        makeListing({
          title: ' ',
          monthly_rent: '0.00',
          available_from: 'not-a-date',
        }),
      ],
    });
    const response = await auth(
      request(context.app).post(`/api/v1/listings/${LISTING_IDS.a}/publish`),
    );
    expect(response.status).toBe(409);
    expect(response.body.error.fields.readiness).toEqual(
      expect.arrayContaining([
        'TITLE_INVALID',
        'MONTHLY_RENT_REQUIRED',
        'AVAILABLE_FROM_INVALID',
      ]),
    );
  });

  it('publishes a ready DRAFT only to PENDING_REVIEW', async () => {
    const context = createListingTestContext({
      listingRecords: [makeListing()],
    });
    const response = await auth(
      request(context.app).post(`/api/v1/listings/${LISTING_IDS.a}/publish`),
    );
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      status: 'PENDING_REVIEW',
      published_at: '2026-08-21T12:00:00.000Z',
    });
    expect(response.body.data.status).not.toBe('ACTIVE');
  });

  it('rejects publishing a draft after its property is archived', async () => {
    const context = createListingTestContext({
      propertyRecords: [
        makeProperty({ archived_at: '2026-08-21T00:00:00.000Z' }),
      ],
      listingRecords: [makeListing()],
    });
    const response = await auth(
      request(context.app).post(`/api/v1/listings/${LISTING_IDS.a}/publish`),
    );
    expect(response.status).toBe(409);
    expect(response.body.error.fields.readiness).toContain('PROPERTY_ARCHIVED');
  });

  it('rejects another live listing and maps database race conflicts safely', async () => {
    const conflicting = createListingTestContext({
      listingRecords: [
        makeListing(),
        makeListing({ id: LISTING_IDS.b, status: 'ACTIVE' }),
      ],
    });
    const prechecked = await auth(
      request(conflicting.app).post(
        `/api/v1/listings/${LISTING_IDS.a}/publish`,
      ),
    );
    expect(prechecked.status).toBe(409);
    expect(prechecked.body.error.code).toBe('LIVE_LISTING_ALREADY_EXISTS');

    const raced = createListingTestContext({
      listingRecords: [makeListing()],
      forceLiveConflictOnUpdate: true,
    });
    const databaseConflict = await auth(
      request(raced.app).post(`/api/v1/listings/${LISTING_IDS.a}/publish`),
    );
    expect(databaseConflict.status).toBe(409);
    expect(databaseConflict.body.error.code).toBe(
      'LIVE_LISTING_ALREADY_EXISTS',
    );
    expect(raced.listingRecords[0].status).toBe('DRAFT');
  });

  it('pauses only ACTIVE and activates only PAUSED after readiness', async () => {
    const active = createListingTestContext({
      listingRecords: [makeListing({ status: 'ACTIVE' })],
    });
    const paused = await auth(
      request(active.app).post(`/api/v1/listings/${LISTING_IDS.a}/pause`),
    );
    expect(paused.status).toBe(200);
    expect(paused.body.data.status).toBe('PAUSED');
    const activated = await auth(
      request(active.app).post(`/api/v1/listings/${LISTING_IDS.a}/activate`),
    );
    expect(activated.status).toBe(200);
    expect(activated.body.data.status).toBe('ACTIVE');
  });

  it('rechecks property images before PAUSED activation', async () => {
    const context = createListingTestContext({
      listingRecords: [makeListing({ status: 'PAUSED' })],
      imageRecords: [],
    });
    const response = await auth(
      request(context.app).post(`/api/v1/listings/${LISTING_IDS.a}/activate`),
    );
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('LISTING_NOT_READY');
  });

  it.each([
    ['DRAFT', 'pause'],
    ['DRAFT', 'activate'],
    ['PENDING_REVIEW', 'activate'],
    ['PENDING_REVIEW', 'pause'],
    ['ACTIVE', 'publish'],
    ['PAUSED', 'publish'],
    ['CLOSED', 'publish'],
    ['CLOSED', 'activate'],
    ['RENTED', 'close'],
    ['RENTED', 'pause'],
  ])('rejects %s → %s', async (status, action) => {
    const context = createListingTestContext({
      listingRecords: [makeListing({ status })],
    });
    const response = await auth(
      request(context.app).post(`/api/v1/listings/${LISTING_IDS.a}/${action}`),
    );
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('INVALID_LISTING_TRANSITION');
  });

  it.each(['DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'PAUSED'])(
    'closes %s without archiving the property',
    async (status) => {
      const context = createListingTestContext({
        listingRecords: [makeListing({ status })],
      });
      const response = await auth(
        request(context.app).post(`/api/v1/listings/${LISTING_IDS.a}/close`),
      );
      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        status: 'CLOSED',
        closed_at: '2026-08-21T12:00:00.000Z',
      });
      expect(context.records.get(PROPERTY_ID).archived_at).toBeNull();
    },
  );

  it('makes close idempotent without rewriting closed_at', async () => {
    const context = createListingTestContext({
      listingRecords: [
        makeListing({
          status: 'CLOSED',
          closed_at: '2026-08-20T00:00:00.000Z',
        }),
      ],
    });
    const response = await auth(
      request(context.app).post(`/api/v1/listings/${LISTING_IDS.a}/close`),
    );
    expect(response.status).toBe(200);
    expect(response.body.data.closed_at).toBe('2026-08-20T00:00:00.000Z');
  });
});

describe('listing authorization boundaries', () => {
  const actionPaths = [
    ['GET', `/api/v1/landlord/listings/${LISTING_IDS.a}`],
    ['PATCH', `/api/v1/listings/${LISTING_IDS.a}`],
    ['POST', `/api/v1/listings/${LISTING_IDS.a}/publish`],
    ['POST', `/api/v1/listings/${LISTING_IDS.a}/pause`],
    ['POST', `/api/v1/listings/${LISTING_IDS.a}/activate`],
    ['POST', `/api/v1/listings/${LISTING_IDS.a}/close`],
  ];

  it.each(actionPaths)('hides cross-landlord %s %s', async (method, path) => {
    const foreignProperty = otherLandlordProperty();
    const context = createListingTestContext({
      propertyRecords: [makeProperty(), foreignProperty],
      listingRecords: [
        makeListing({ property_id: foreignProperty.id, status: 'ACTIVE' }),
      ],
    });
    const builder = auth(request(context.app)[method.toLowerCase()](path));
    const response =
      method === 'PATCH'
        ? await builder.send({ title: 'Attack' })
        : await builder;
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('LISTING_NOT_FOUND');
  });

  it('prevents creation for another landlord property', async () => {
    const foreignProperty = otherLandlordProperty();
    const context = createListingTestContext({
      propertyRecords: [foreignProperty],
    });
    const response = await auth(
      request(context.app).post('/api/v1/listings'),
    ).send({ ...validListing, property_id: foreignProperty.id });
    expect(response.status).toBe(404);
  });

  it.each([
    ['POST', '/api/v1/listings'],
    ['GET', '/api/v1/landlord/listings'],
    ['GET', `/api/v1/landlord/listings/${LISTING_IDS.a}`],
    ['PATCH', `/api/v1/listings/${LISTING_IDS.a}`],
    ['POST', `/api/v1/listings/${LISTING_IDS.a}/publish`],
    ['POST', `/api/v1/listings/${LISTING_IDS.a}/pause`],
    ['POST', `/api/v1/listings/${LISTING_IDS.a}/activate`],
    ['POST', `/api/v1/listings/${LISTING_IDS.a}/close`],
  ])('blocks TENANT %s %s', async (method, path) => {
    const context = createListingTestContext({
      listingRecords: [makeListing()],
    });
    const builder = auth(
      request(context.app)[method.toLowerCase()](path),
      'tenant-token',
    );
    const response =
      method === 'POST' && path === '/api/v1/listings'
        ? await builder.send(validListing)
        : method === 'PATCH'
          ? await builder.send({ title: 'Attack' })
          : await builder;
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it.each(['SUSPENDED', 'DELETED'])('blocks a %s landlord', async (status) => {
    const context = createListingTestContext({
      listingRecords: [makeListing()],
      applicationProfiles: [
        makeProfile(),
        makeProfile({
          id: TEST_USERS.landlord,
          role: 'LANDLORD',
          account_status: status,
        }),
      ],
    });
    const response = await auth(
      request(context.app).get('/api/v1/landlord/listings'),
    );
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe(
      status === 'SUSPENDED' ? 'ACCOUNT_SUSPENDED' : 'ACCOUNT_DELETED',
    );
  });

  it('rejects invalid listing UUIDs before repository access', async () => {
    const response = await auth(
      request(createListingTestContext().app).get(
        '/api/v1/landlord/listings/not-a-uuid',
      ),
    );
    expect(response.status).toBe(422);
  });
});
