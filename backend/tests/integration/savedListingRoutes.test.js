import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { makeProfile, TEST_USERS } from '../helpers/createAuthTestContext.js';
import {
  LISTING_IDS,
  makeListing,
} from '../helpers/createListingTestContext.js';
import { makeProperty } from '../helpers/createPropertyTestContext.js';
import {
  createSavedListingTestContext,
  makeSavedListing,
  TENANT_PROFILE_IDS,
} from '../helpers/createSavedListingTestContext.js';

const auth = (builder, token = 'tenant-token') =>
  builder.set('Authorization', `Bearer ${token}`);
const PROPERTY_ID = '50000000-0000-4000-8000-000000000001';

describe('saved listing creation and idempotency', () => {
  it('saves an ACTIVE listing for the backend-derived tenant profile', async () => {
    const context = createSavedListingTestContext();
    const response = await auth(
      request(context.app).post(`/api/v1/listings/${LISTING_IDS.a}/save`),
    );
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      listing_id: LISTING_IDS.a,
      saved: true,
    });
    expect(context.savedRecords).toEqual([
      expect.objectContaining({
        tenant_id: TENANT_PROFILE_IDS.a,
        listing_id: LISTING_IDS.a,
      }),
    ]);
  });

  it('is idempotent when the relationship already exists', async () => {
    const context = createSavedListingTestContext({
      savedRecords: [makeSavedListing()],
    });
    const first = await auth(
      request(context.app).post(`/api/v1/listings/${LISTING_IDS.a}/save`),
    );
    const second = await auth(
      request(context.app).post(`/api/v1/listings/${LISTING_IDS.a}/save`),
    );
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(context.savedRecords).toHaveLength(1);
  });

  it('maps a concurrent composite-key conflict to idempotent success', async () => {
    const context = createSavedListingTestContext({
      failConcurrentCreate: true,
    });
    const response = await auth(
      request(context.app).post(`/api/v1/listings/${LISTING_IDS.a}/save`),
    );
    expect(response.status).toBe(200);
    expect(response.body.data.saved).toBe(true);
    expect(context.savedRecords).toHaveLength(1);
  });

  it.each(['tenant_id', 'user_id', 'listing_id', 'created_at'])(
    'strictly rejects protected body field %s',
    async (field) => {
      const context = createSavedListingTestContext();
      const response = await auth(
        request(context.app)
          .post(`/api/v1/listings/${LISTING_IDS.a}/save`)
          .send({ [field]: 'attacker-controlled' }),
      );
      expect(response.status).toBe(422);
      expect(context.savedRecords).toHaveLength(0);
    },
  );

  it.each(['DRAFT', 'PENDING_REVIEW', 'PAUSED', 'RENTED', 'CLOSED'])(
    'returns privacy-preserving 404 when newly saving a %s listing',
    async (status) => {
      const context = createSavedListingTestContext({
        listingRecords: [makeListing({ status })],
      });
      const response = await auth(
        request(context.app).post(`/api/v1/listings/${LISTING_IDS.a}/save`),
      );
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('LISTING_NOT_FOUND');
      expect(context.savedRecords).toHaveLength(0);
      expect(context.signedPaths).toHaveLength(0);
    },
  );

  it('returns 404 for an archived-property or unknown listing', async () => {
    const archived = createSavedListingTestContext({
      propertyRecords: [
        makeProperty({ archived_at: '2026-08-21T00:00:00.000Z' }),
      ],
    });
    const archivedResponse = await auth(
      request(archived.app).post(`/api/v1/listings/${LISTING_IDS.a}/save`),
    );
    expect(archivedResponse.status).toBe(404);

    const unknown = await auth(
      request(archived.app).post(
        '/api/v1/listings/80000000-0000-4000-8000-999999999999/save',
      ),
    );
    expect(unknown.status).toBe(404);
  });

  it('rejects an invalid listing UUID before persistence', async () => {
    const context = createSavedListingTestContext();
    const response = await auth(
      request(context.app).post('/api/v1/listings/not-a-uuid/save'),
    );
    expect(response.status).toBe(422);
    expect(context.savedRecords).toHaveLength(0);
  });
});

describe('saved listing ownership, status, and removal', () => {
  it('isolates status and list visibility between Tenant A and Tenant B', async () => {
    const context = createSavedListingTestContext({
      savedRecords: [makeSavedListing()],
    });
    const statusA = await auth(
      request(context.app).get(
        `/api/v1/tenant/saved-listings/${LISTING_IDS.a}/status`,
      ),
    );
    const statusB = await auth(
      request(context.app).get(
        `/api/v1/tenant/saved-listings/${LISTING_IDS.a}/status`,
      ),
      'other-token',
    );
    const listB = await auth(
      request(context.app).get('/api/v1/tenant/saved-listings'),
      'other-token',
    );
    expect(statusA.body.data.saved).toBe(true);
    expect(statusB.body.data.saved).toBe(false);
    expect(listB.body.data).toEqual([]);
  });

  it("cannot remove another tenant's relationship", async () => {
    const context = createSavedListingTestContext({
      savedRecords: [makeSavedListing({ tenant_id: TENANT_PROFILE_IDS.b })],
    });
    const response = await auth(
      request(context.app).delete(`/api/v1/listings/${LISTING_IDS.a}/save`),
    );
    expect(response.status).toBe(204);
    expect(context.savedRecords).toEqual([
      expect.objectContaining({ tenant_id: TENANT_PROFILE_IDS.b }),
    ]);
  });

  it('removes only the save and repeated removal remains successful', async () => {
    const listing = makeListing({ status: 'ACTIVE' });
    const context = createSavedListingTestContext({
      listingRecords: [listing],
      savedRecords: [makeSavedListing()],
    });
    const first = await auth(
      request(context.app).delete(`/api/v1/listings/${LISTING_IDS.a}/save`),
    );
    const second = await auth(
      request(context.app).delete(`/api/v1/listings/${LISTING_IDS.a}/save`),
    );
    expect(first.status).toBe(204);
    expect(second.status).toBe(204);
    expect(context.savedRecords).toHaveLength(0);
    expect(
      context.listingRecords.some((candidate) => candidate.id === listing.id),
    ).toBe(true);
    expect(context.propertyRecords.has(PROPERTY_ID)).toBe(true);
  });

  it.each(['PAUSED', 'RENTED', 'CLOSED'])(
    'can remove a saved listing after it becomes %s',
    async (status) => {
      const context = createSavedListingTestContext({
        listingRecords: [makeListing({ status })],
        savedRecords: [makeSavedListing()],
      });
      const response = await auth(
        request(context.app).delete(`/api/v1/listings/${LISTING_IDS.a}/save`),
      );
      expect(response.status).toBe(204);
      expect(context.savedRecords).toHaveLength(0);
    },
  );

  it('reports saved true after the listing becomes unavailable without fields', async () => {
    const context = createSavedListingTestContext({
      listingRecords: [makeListing({ status: 'CLOSED' })],
      savedRecords: [makeSavedListing()],
    });
    const response = await auth(
      request(context.app).get(
        `/api/v1/tenant/saved-listings/${LISTING_IDS.a}/status`,
      ),
    );
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      listing_id: LISTING_IDS.a,
      saved: true,
    });
    expect(JSON.stringify(response.body)).not.toContain('CLOSED');
  });

  it('reports saved false without requiring listing existence', async () => {
    const context = createSavedListingTestContext();
    const listingId = '80000000-0000-4000-8000-999999999999';
    const response = await auth(
      request(context.app).get(
        `/api/v1/tenant/saved-listings/${listingId}/status`,
      ),
    );
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ listing_id: listingId, saved: false });
  });
});

describe('saved listing list privacy and pagination', () => {
  it('returns AVAILABLE saves through the existing public card serializer', async () => {
    const context = createSavedListingTestContext({
      propertyRecords: [
        makeProperty({
          address_line_1: 'Private address',
          address_line_2: 'Private unit',
          latitude: -20.22,
          longitude: 57.53,
          landlord_id: 'private-owner',
          verification_notes: 'private evidence',
        }),
      ],
      savedRecords: [makeSavedListing()],
    });
    const response = await auth(
      request(context.app).get('/api/v1/tenant/saved-listings'),
    );
    expect(response.status).toBe(200);
    expect(response.body.data[0]).toMatchObject({
      listing_id: LISTING_IDS.a,
      saved_at: '2026-08-21T10:00:00.000Z',
      availability: 'AVAILABLE',
      listing: {
        id: LISTING_IDS.a,
        cover_image_url: expect.stringContaining('signed='),
      },
    });
    const serialized = JSON.stringify(response.body.data);
    for (const forbidden of [
      'address_line_1',
      'address_line_2',
      'latitude',
      'longitude',
      'landlord_id',
      'property_id',
      'storage_path',
      'verification_notes',
      'Private address',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it.each(['DRAFT', 'PENDING_REVIEW', 'PAUSED', 'RENTED', 'CLOSED'])(
    'returns only minimal UNAVAILABLE state for a formerly saved %s listing',
    async (status) => {
      const context = createSavedListingTestContext({
        listingRecords: [
          makeListing({
            status,
            title: 'Private former title',
            description: 'Private former description',
          }),
        ],
        savedRecords: [makeSavedListing()],
      });
      const response = await auth(
        request(context.app).get('/api/v1/tenant/saved-listings'),
      );
      expect(response.status).toBe(200);
      expect(response.body.data).toEqual([
        {
          listing_id: LISTING_IDS.a,
          saved_at: '2026-08-21T10:00:00.000Z',
          availability: 'UNAVAILABLE',
          listing: null,
        },
      ]);
      expect(context.savedRecords).toHaveLength(1);
      expect(context.signedPaths).toHaveLength(0);
      expect(JSON.stringify(response.body)).not.toContain(
        'Private former title',
      );
    },
  );

  it('preserves but hides a save after an ACTIVE listing becomes PAUSED', async () => {
    const context = createSavedListingTestContext();
    const saved = await auth(
      request(context.app).post(`/api/v1/listings/${LISTING_IDS.a}/save`),
    );
    expect(saved.status).toBe(200);
    context.listingRecords[0].status = 'PAUSED';
    const response = await auth(
      request(context.app).get('/api/v1/tenant/saved-listings'),
    );
    expect(response.body.data[0]).toEqual({
      listing_id: LISTING_IDS.a,
      saved_at: '2026-08-21T12:00:00.000Z',
      availability: 'UNAVAILABLE',
      listing: null,
    });
    expect(context.savedRecords).toHaveLength(1);
    expect(context.signedPaths).toHaveLength(0);
  });

  it('returns exact totals, deterministic order, and page 2', async () => {
    const listingRecords = Array.from({ length: 5 }, (_, index) =>
      makeListing({
        id: `80000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
        status: 'ACTIVE',
      }),
    );
    const savedRecords = listingRecords.map((listing, index) =>
      makeSavedListing({
        listing_id: listing.id,
        created_at:
          index < 2
            ? '2026-08-21T10:00:00.000Z'
            : `2026-08-${String(index + 10).padStart(2, '0')}T10:00:00.000Z`,
      }),
    );
    const context = createSavedListingTestContext({
      listingRecords,
      savedRecords,
    });
    const response = await auth(
      request(context.app).get('/api/v1/tenant/saved-listings?page=2&limit=2'),
    );
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(2);
    expect(response.body.meta).toEqual({
      page: 2,
      limit: 2,
      total: 5,
      total_pages: 3,
    });
    expect(response.body.data.map((save) => save.listing_id)).toEqual([
      listingRecords[4].id,
      listingRecords[3].id,
    ]);
    const tied = await auth(
      request(context.app).get('/api/v1/tenant/saved-listings?page=1&limit=2'),
    );
    expect(tied.body.data.map((save) => save.listing_id)).toEqual([
      listingRecords[0].id,
      listingRecords[1].id,
    ]);
  });

  it('accepts max limit and rejects invalid pagination', async () => {
    const context = createSavedListingTestContext();
    expect(
      (
        await auth(
          request(context.app).get('/api/v1/tenant/saved-listings?limit=100'),
        )
      ).status,
    ).toBe(200);
    for (const query of ['?page=0', '?limit=0', '?limit=101', '?extra=true']) {
      const response = await auth(
        request(context.app).get(`/api/v1/tenant/saved-listings${query}`),
      );
      expect(response.status).toBe(422);
    }
  });
});

describe('saved listing authentication, role, and account status', () => {
  it('does not intercept unrelated landlord listing routes', async () => {
    const context = createSavedListingTestContext();
    const response = await request(context.app)
      .post('/api/v1/listings/not-a-save')
      .set('Authorization', 'Bearer landlord-token');
    expect(response.status).toBe(404);
  });

  it.each([
    ['POST', `/api/v1/listings/${LISTING_IDS.a}/save`],
    ['DELETE', `/api/v1/listings/${LISTING_IDS.a}/save`],
    ['GET', `/api/v1/tenant/saved-listings/${LISTING_IDS.a}/status`],
    ['GET', '/api/v1/tenant/saved-listings'],
  ])('blocks LANDLORD %s %s', async (method, path) => {
    const context = createSavedListingTestContext();
    const testClient = request(context.app);
    const response = await testClient[method.toLowerCase()](path).set(
      'Authorization',
      'Bearer landlord-token',
    );
    expect(response.status).toBe(403);
    expect(context.savedRecords).toHaveLength(0);
  });

  it('blocks ADMIN accounts from tenant save APIs', async () => {
    const context = createSavedListingTestContext({
      applicationProfiles: [
        makeProfile(),
        makeProfile({ id: TEST_USERS.other, role: 'ADMIN' }),
        makeProfile({ id: TEST_USERS.landlord, role: 'LANDLORD' }),
      ],
    });
    const response = await auth(
      request(context.app).get('/api/v1/tenant/saved-listings'),
      'other-token',
    );
    expect(response.status).toBe(403);
  });

  it.each(['SUSPENDED', 'DELETED'])(
    'blocks a %s TENANT before saved repository access',
    async (accountStatus) => {
      const context = createSavedListingTestContext({
        applicationProfiles: [
          makeProfile({ account_status: accountStatus }),
          makeProfile({ id: TEST_USERS.other }),
          makeProfile({ id: TEST_USERS.landlord, role: 'LANDLORD' }),
        ],
      });
      const response = await auth(
        request(context.app).get('/api/v1/tenant/saved-listings'),
      );
      expect(response.status).toBe(403);
      expect(context.savedRecords).toHaveLength(0);
    },
  );

  it('requires authentication for saves while public search stays anonymous', async () => {
    const context = createSavedListingTestContext();
    const save = await request(context.app).post(
      `/api/v1/listings/${LISTING_IDS.a}/save`,
    );
    const publicSearch = await request(context.app).get('/api/v1/listings');
    expect(save.status).toBe(401);
    expect(publicSearch.status).toBe(200);
  });
});
