import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { makeProfile, TEST_USERS } from '../helpers/createAuthTestContext.js';
import {
  createPropertyTestContext,
  LANDLORD_PROFILE_IDS,
  makeProperty,
} from '../helpers/createPropertyTestContext.js';

const PROPERTY_ID = '50000000-0000-4000-8000-000000000001';
const auth = (builder, token = 'landlord-token') =>
  builder.set('Authorization', `Bearer ${token}`);
const validProperty = {
  property_type: 'APARTMENT',
  address_line_1: ' 10 Test Road ',
  address_line_2: null,
  district: ' Moka ',
  locality: 'Moka',
  neighbourhood: null,
  latitude: -20.23,
  longitude: 57.5,
  bedrooms: 2,
  bathrooms: 1.5,
  furnished: true,
  parking_spaces: 1,
};

describe('POST /api/v1/properties', () => {
  it('creates a safe property for the authenticated landlord', async () => {
    const context = createPropertyTestContext();
    const response = await auth(
      request(context.app).post('/api/v1/properties'),
    ).send(validProperty);

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      property_type: 'APARTMENT',
      address_line_1: '10 Test Road',
      district: 'Moka',
      bathrooms: 1.5,
      verification_status: 'UNVERIFIED',
      archived_at: null,
    });
    expect(response.body.data).not.toHaveProperty('landlord_id');
    expect([...context.records.values()][0].landlord_id).toBe(
      LANDLORD_PROFILE_IDS.a,
    );
  });

  it('applies boolean and parking defaults', async () => {
    const context = createPropertyTestContext();
    const response = await auth(
      request(context.app).post('/api/v1/properties'),
    ).send({
      property_type: 'HOUSE',
      district: 'Flacq',
      locality: 'Centre de Flacq',
      bedrooms: 0,
      bathrooms: 0,
    });
    expect(response.body.data).toMatchObject({
      furnished: false,
      parking_spaces: 0,
    });
  });

  it.each([
    ['invalid type', { property_type: 'CASTLE' }],
    ['negative bedrooms', { bedrooms: -1 }],
    ['negative bathrooms', { bathrooms: -0.5 }],
    ['negative parking', { parking_spaces: -1 }],
    ['high latitude', { latitude: 91 }],
    ['low latitude', { latitude: -91 }],
    ['high longitude', { longitude: 181 }],
    ['low longitude', { longitude: -181 }],
    ['empty district', { district: ' ' }],
    ['empty locality', { locality: '' }],
    ['oversized address', { address_line_1: 'x'.repeat(251) }],
  ])('rejects %s', async (_label, override) => {
    const context = createPropertyTestContext();
    const response = await auth(
      request(context.app).post('/api/v1/properties'),
    ).send({
      ...validProperty,
      ...override,
    });
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(context.records.size).toBe(0);
  });

  it.each([
    ['id', TEST_USERS.other],
    ['landlord_id', LANDLORD_PROFILE_IDS.b],
    ['user_id', TEST_USERS.other],
    ['owner_id', TEST_USERS.other],
    ['verification_status', 'VERIFIED'],
    ['archived_at', '2026-08-21T00:00:00Z'],
    ['created_at', '2026-08-21T00:00:00Z'],
    ['updated_at', '2026-08-21T00:00:00Z'],
  ])('rejects protected field %s', async (field, value) => {
    const context = createPropertyTestContext();
    const response = await auth(
      request(context.app).post('/api/v1/properties'),
    ).send({
      ...validProperty,
      [field]: value,
    });
    expect(response.status).toBe(422);
    expect(context.records.size).toBe(0);
  });
});

describe('landlord property management', () => {
  it('lists only owned active properties with pagination metadata', async () => {
    const properties = Array.from({ length: 25 }, (_, index) =>
      makeProperty({
        id: `50000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
        created_at: `2026-08-${String((index % 20) + 1).padStart(2, '0')}T00:00:00.000Z`,
      }),
    );
    properties.push(
      makeProperty({
        id: '50000000-0000-4000-8000-000000000099',
        landlord_id: LANDLORD_PROFILE_IDS.b,
      }),
      makeProperty({
        id: '50000000-0000-4000-8000-000000000098',
        archived_at: '2026-08-21T00:00:00.000Z',
      }),
    );
    const context = createPropertyTestContext({ propertyRecords: properties });
    const response = await auth(
      request(context.app).get('/api/v1/landlord/properties?page=2&limit=10'),
    );
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(10);
    expect(response.body.meta).toEqual({
      page: 2,
      limit: 10,
      total: 25,
      total_pages: 3,
    });
  });

  it('uses default pagination and filters archived properties', async () => {
    const context = createPropertyTestContext({
      propertyRecords: [
        makeProperty(),
        makeProperty({
          id: '50000000-0000-4000-8000-000000000002',
          archived_at: '2026-08-21T00:00:00.000Z',
        }),
      ],
    });
    const active = await auth(
      request(context.app).get('/api/v1/landlord/properties'),
    );
    expect(active.body.meta).toMatchObject({ page: 1, limit: 20, total: 1 });
    const archived = await auth(
      request(context.app).get('/api/v1/landlord/properties?archived=true'),
    );
    expect(archived.body.data).toHaveLength(1);
    expect(archived.body.data[0].archived_at).not.toBeNull();
  });

  it('accepts the maximum page limit', async () => {
    const context = createPropertyTestContext({
      propertyRecords: [makeProperty()],
    });
    const response = await auth(
      request(context.app).get('/api/v1/landlord/properties?limit=100'),
    );
    expect(response.status).toBe(200);
    expect(response.body.meta).toMatchObject({ page: 1, limit: 100, total: 1 });
  });

  it.each([
    ['page zero', '?page=0'],
    ['negative page', '?page=-1'],
    ['limit zero', '?limit=0'],
    ['limit over maximum', '?limit=101'],
    ['invalid archived', '?archived=all'],
  ])('rejects invalid pagination: %s', async (_label, query) => {
    const context = createPropertyTestContext();
    const response = await auth(
      request(context.app).get(`/api/v1/landlord/properties${query}`),
    );
    expect(response.status).toBe(422);
  });

  it('gets and partially updates an owned property', async () => {
    const context = createPropertyTestContext({
      propertyRecords: [makeProperty()],
    });
    const found = await auth(
      request(context.app).get(`/api/v1/properties/${PROPERTY_ID}`),
    );
    expect(found.status).toBe(200);
    const updated = await auth(
      request(context.app).patch(`/api/v1/properties/${PROPERTY_ID}`),
    ).send({ bathrooms: 2.5, locality: ' Nouvelle Decouverte ' });
    expect(updated.status).toBe(200);
    expect(updated.body.data).toMatchObject({
      bathrooms: 2.5,
      locality: 'Nouvelle Decouverte',
      bedrooms: 2,
    });
  });

  it.each(['landlord_id', 'verification_status', 'archived_at', 'id'])(
    'rejects protected update field %s',
    async (field) => {
      const context = createPropertyTestContext({
        propertyRecords: [makeProperty()],
      });
      const response = await auth(
        request(context.app).patch(`/api/v1/properties/${PROPERTY_ID}`),
      ).send({
        [field]:
          field === 'verification_status' ? 'VERIFIED' : TEST_USERS.other,
      });
      expect(response.status).toBe(422);
      expect(context.records.get(PROPERTY_ID).verification_status).toBe(
        'UNVERIFIED',
      );
      expect(context.records.get(PROPERTY_ID).landlord_id).toBe(
        LANDLORD_PROFILE_IDS.a,
      );
    },
  );

  it('archives idempotently and prevents archived edits', async () => {
    const context = createPropertyTestContext({
      propertyRecords: [makeProperty()],
    });
    const first = await auth(
      request(context.app).post(`/api/v1/properties/${PROPERTY_ID}/archive`),
    );
    const second = await auth(
      request(context.app).post(`/api/v1/properties/${PROPERTY_ID}/archive`),
    );
    expect(first.status).toBe(200);
    expect(second.body.data.archived_at).toBe(first.body.data.archived_at);
    expect(context.archiveWrites).toBe(1);
    const edit = await auth(
      request(context.app).patch(`/api/v1/properties/${PROPERTY_ID}`),
    ).send({ bedrooms: 3 });
    expect(edit.status).toBe(409);
    expect(edit.body.error.code).toBe('PROPERTY_ARCHIVED');
  });

  it.each(['PENDING_REVIEW', 'ACTIVE', 'PAUSED'])(
    'blocks property archive with a %s listing',
    async (status) => {
      const context = createPropertyTestContext({
        propertyRecords: [makeProperty()],
        listingRecords: [{ property_id: PROPERTY_ID, status }],
      });
      const response = await auth(
        request(context.app).post(`/api/v1/properties/${PROPERTY_ID}/archive`),
      );
      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('PROPERTY_HAS_LIVE_LISTING');
      expect(context.records.get(PROPERTY_ID).archived_at).toBeNull();
    },
  );

  it('allows property archive when listings are DRAFT only', async () => {
    const context = createPropertyTestContext({
      propertyRecords: [makeProperty()],
      listingRecords: [{ property_id: PROPERTY_ID, status: 'DRAFT' }],
    });
    const response = await auth(
      request(context.app).post(`/api/v1/properties/${PROPERTY_ID}/archive`),
    );
    expect(response.status).toBe(200);
    expect(response.body.data.archived_at).not.toBeNull();
  });
});

describe('property authorization', () => {
  it.each([
    ['GET', `/api/v1/properties/${PROPERTY_ID}`],
    ['PATCH', `/api/v1/properties/${PROPERTY_ID}`],
    ['POST', `/api/v1/properties/${PROPERTY_ID}/archive`],
  ])('privacy-preserves cross-landlord %s', async (method, path) => {
    const context = createPropertyTestContext({
      propertyRecords: [makeProperty({ landlord_id: LANDLORD_PROFILE_IDS.b })],
    });
    const requestBuilder = auth(
      request(context.app)[method.toLowerCase()](path),
    );
    const response =
      method === 'PATCH'
        ? await requestBuilder.send({ bedrooms: 3 })
        : await requestBuilder;
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('PROPERTY_NOT_FOUND');
  });

  it.each([
    ['POST', '/api/v1/properties'],
    ['GET', '/api/v1/landlord/properties'],
    ['GET', `/api/v1/properties/${PROPERTY_ID}`],
    ['PATCH', `/api/v1/properties/${PROPERTY_ID}`],
    ['POST', `/api/v1/properties/${PROPERTY_ID}/archive`],
  ])('blocks TENANT %s %s', async (method, path) => {
    const context = createPropertyTestContext({
      propertyRecords: [makeProperty()],
    });
    const response = await auth(
      request(context.app)[method.toLowerCase()](path),
      'tenant-token',
    ).send(
      method === 'POST' && path === '/api/v1/properties'
        ? validProperty
        : undefined,
    );
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it.each(['SUSPENDED', 'DELETED'])('blocks a %s landlord', async (status) => {
    const context = createPropertyTestContext({
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
      request(context.app).post('/api/v1/properties'),
    ).send(validProperty);
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe(
      status === 'SUSPENDED' ? 'ACCOUNT_SUSPENDED' : 'ACCOUNT_DELETED',
    );
  });

  it('rejects invalid UUIDs before repository access', async () => {
    const context = createPropertyTestContext({
      propertyRecords: [makeProperty()],
    });
    const response = await auth(
      request(context.app).get('/api/v1/properties/not-a-uuid'),
    );
    expect(response.status).toBe(422);
  });
});
