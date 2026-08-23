import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { makeProfile, TEST_USERS } from '../helpers/createAuthTestContext.js';
import {
  APPLICATION_IDS,
  createApplicationTestContext,
  makeApplication,
} from '../helpers/createApplicationTestContext.js';
import {
  LISTING_IDS,
  makeListing,
} from '../helpers/createListingTestContext.js';
import { makeProperty } from '../helpers/createPropertyTestContext.js';
import { TENANT_PROFILE_IDS } from '../helpers/createSavedListingTestContext.js';

const auth = (builder, token = 'tenant-token') =>
  builder.set('Authorization', `Bearer ${token}`);

const draftPath = `/api/v1/listings/${LISTING_IDS.a}/applications`;
const ownedPath = `/api/v1/applications/${APPLICATION_IDS.a}`;

describe('rental application draft creation', () => {
  it('creates a DRAFT for an ACTIVE non-archived listing using derived ownership', async () => {
    const context = createApplicationTestContext();
    const response = await auth(request(context.app).post(draftPath)).send({
      move_in_date: '2026-11-01',
      requested_lease_duration_months: 12,
      number_of_occupants: 2,
      introductory_message: '  A quiet working household.  ',
    });
    expect(response.status).toBe(201);
    expect(response.body.data).toEqual({
      id: APPLICATION_IDS.a,
      listing_id: LISTING_IDS.a,
      move_in_date: '2026-11-01',
      requested_lease_duration_months: 12,
      number_of_occupants: 2,
      introductory_message: 'A quiet working household.',
      status: 'DRAFT',
      created_at: '2026-08-22T08:00:00.000Z',
      updated_at: '2026-08-22T08:00:00.000Z',
    });
    expect(response.body.meta).toEqual({
      listing_available: true,
      editable: true,
    });
    expect(context.applicationRecords[0]).toMatchObject({
      tenant_id: TENANT_PROFILE_IDS.a,
      listing_id: LISTING_IDS.a,
      status: 'DRAFT',
      submitted_at: null,
      withdrawn_at: null,
    });
    expect(JSON.stringify(response.body)).not.toContain('tenant_id');
  });

  it('is idempotent and does not overwrite an existing draft', async () => {
    const context = createApplicationTestContext({
      applicationRecords: [
        makeApplication({ introductory_message: 'Keep this draft' }),
      ],
    });
    const response = await auth(request(context.app).post(draftPath)).send({
      introductory_message: 'Attacker replacement',
    });
    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe(APPLICATION_IDS.a);
    expect(response.body.data.introductory_message).toBe('Keep this draft');
    expect(context.applicationRecords).toHaveLength(1);
  });

  it('maps a composite-key creation race to the one existing draft', async () => {
    const context = createApplicationTestContext({
      failConcurrentCreate: true,
    });
    const response = await auth(request(context.app).post(draftPath)).send({});
    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe(APPLICATION_IDS.a);
    expect(context.applicationRecords).toHaveLength(1);
  });

  it('allows Tenant B an independent draft for the same listing', async () => {
    const context = createApplicationTestContext({
      applicationRecords: [makeApplication()],
    });
    const response = await auth(
      request(context.app).post(draftPath),
      'other-token',
    ).send({});
    expect(response.status).toBe(201);
    expect(context.applicationRecords).toHaveLength(2);
    expect(context.applicationRecords[1].tenant_id).toBe(TENANT_PROFILE_IDS.b);
  });

  it.each(['DRAFT', 'PENDING_REVIEW', 'PAUSED', 'RENTED', 'CLOSED'])(
    'does not create for a newly targeted %s listing',
    async (status) => {
      const context = createApplicationTestContext({
        listingRecords: [makeListing({ status })],
      });
      const response = await auth(request(context.app).post(draftPath)).send(
        {},
      );
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('LISTING_NOT_FOUND');
      expect(context.applicationRecords).toHaveLength(0);
    },
  );

  it('does not create for an archived-property or unknown listing', async () => {
    const context = createApplicationTestContext({
      propertyRecords: [
        makeProperty({ archived_at: '2026-08-22T00:00:00.000Z' }),
      ],
    });
    expect(
      (await auth(request(context.app).post(draftPath)).send({})).status,
    ).toBe(404);
    expect(
      (
        await auth(
          request(context.app).post(
            '/api/v1/listings/80000000-0000-4000-8000-999999999999/applications',
          ),
        ).send({})
      ).status,
    ).toBe(404);
    expect(context.applicationRecords).toHaveLength(0);
  });

  it('returns conflict for an existing non-DRAFT application', async () => {
    const context = createApplicationTestContext({
      applicationRecords: [
        makeApplication({
          status: 'SUBMITTED',
          submitted_at: '2026-08-22T08:30:00.000Z',
        }),
      ],
    });
    const response = await auth(request(context.app).post(draftPath)).send({});
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('APPLICATION_ALREADY_EXISTS');
  });

  it.each([
    'id',
    'listing_id',
    'tenant_id',
    'status',
    'submitted_at',
    'withdrawn_at',
    'created_at',
    'updated_at',
  ])('rejects protected create field %s', async (field) => {
    const context = createApplicationTestContext();
    const response = await auth(request(context.app).post(draftPath)).send({
      [field]: 'attacker-controlled',
    });
    expect(response.status).toBe(422);
    expect(context.applicationRecords).toHaveLength(0);
  });

  it.each([
    [{ move_in_date: 'not-a-date' }, 'move_in_date'],
    [{ requested_lease_duration_months: 0 }, 'requested_lease_duration_months'],
    [
      { requested_lease_duration_months: 1.5 },
      'requested_lease_duration_months',
    ],
    [{ number_of_occupants: -1 }, 'number_of_occupants'],
    [{ introductory_message: 'x'.repeat(2001) }, 'introductory_message'],
  ])('rejects invalid draft values %#', async (body, field) => {
    const context = createApplicationTestContext();
    const response = await auth(request(context.app).post(draftPath)).send(
      body,
    );
    expect(response.status).toBe(422);
    expect(response.body.error.fields).toHaveProperty(field);
  });
});

describe('rental application retrieval, privacy, and editing', () => {
  it('retrieves only the authenticated tenant own draft fields', async () => {
    const context = createApplicationTestContext({
      applicationRecords: [makeApplication()],
    });
    const response = await auth(request(context.app).get(ownedPath));
    expect(response.status).toBe(200);
    expect(Object.keys(response.body.data)).toEqual([
      'id',
      'listing_id',
      'move_in_date',
      'requested_lease_duration_months',
      'number_of_occupants',
      'introductory_message',
      'status',
      'created_at',
      'updated_at',
      'submitted_at',
      'withdrawn_at',
      'availability',
      'listing',
      'answers',
      'history',
    ]);
    const serialized = JSON.stringify(response.body);
    for (const forbidden of [
      'tenant_id',
      'property_id',
      'landlord_id',
      'address_line_1',
      'storage_path',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('returns 404 for another tenant GET and PATCH', async () => {
    const context = createApplicationTestContext({
      applicationRecords: [makeApplication()],
    });
    const getResponse = await auth(
      request(context.app).get(ownedPath),
      'other-token',
    );
    const patchResponse = await auth(
      request(context.app).patch(ownedPath),
      'other-token',
    ).send({ number_of_occupants: 3 });
    expect(getResponse.status).toBe(404);
    expect(patchResponse.status).toBe(404);
    expect(context.applicationRecords[0].number_of_occupants).toBeNull();
  });

  it('updates only allowed fields while preserving protected state', async () => {
    const context = createApplicationTestContext({
      applicationRecords: [makeApplication()],
    });
    const response = await auth(request(context.app).patch(ownedPath)).send({
      move_in_date: '2026-12-01',
      requested_lease_duration_months: 24,
      number_of_occupants: 4,
      introductory_message: ' Updated introduction ',
    });
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      move_in_date: '2026-12-01',
      requested_lease_duration_months: 24,
      number_of_occupants: 4,
      introductory_message: 'Updated introduction',
      status: 'DRAFT',
    });
    expect(context.applicationRecords[0]).toMatchObject({
      tenant_id: TENANT_PROFILE_IDS.a,
      listing_id: LISTING_IDS.a,
      status: 'DRAFT',
      submitted_at: null,
      withdrawn_at: null,
    });
  });

  it('allows optional draft values to be cleared explicitly', async () => {
    const context = createApplicationTestContext({
      applicationRecords: [
        makeApplication({
          move_in_date: '2026-12-01',
          number_of_occupants: 2,
          introductory_message: 'Hello',
        }),
      ],
    });
    const response = await auth(request(context.app).patch(ownedPath)).send({
      move_in_date: null,
      number_of_occupants: null,
      introductory_message: null,
    });
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      move_in_date: null,
      number_of_occupants: null,
      introductory_message: null,
    });
  });

  it.each([
    'id',
    'listing_id',
    'tenant_id',
    'status',
    'submitted_at',
    'withdrawn_at',
    'created_at',
    'updated_at',
  ])('rejects protected PATCH field %s', async (field) => {
    const context = createApplicationTestContext({
      applicationRecords: [makeApplication()],
    });
    const response = await auth(request(context.app).patch(ownedPath)).send({
      [field]: 'attacker-controlled',
    });
    expect(response.status).toBe(422);
    expect(context.applicationRecords[0].status).toBe('DRAFT');
  });

  it('rejects an empty PATCH body', async () => {
    const context = createApplicationTestContext({
      applicationRecords: [makeApplication()],
    });
    expect(
      (await auth(request(context.app).patch(ownedPath)).send({})).status,
    ).toBe(422);
  });

  it('preserves and safely retrieves a draft after the listing is paused', async () => {
    const context = createApplicationTestContext({
      listingRecords: [
        makeListing({
          status: 'PAUSED',
          title: 'Private former title',
          description: 'Private former description',
        }),
      ],
      applicationRecords: [makeApplication()],
    });
    const response = await auth(request(context.app).get(ownedPath));
    expect(response.status).toBe(200);
    expect(response.body.meta).toEqual({
      listing_available: false,
      editable: false,
    });
    expect(response.body.data.id).toBe(APPLICATION_IDS.a);
    expect(JSON.stringify(response.body)).not.toContain('Private former');
    expect(context.applicationRecords).toHaveLength(1);
  });

  it('returns the preserved draft idempotently but blocks editing when unavailable', async () => {
    const context = createApplicationTestContext({
      listingRecords: [makeListing({ status: 'CLOSED' })],
      applicationRecords: [makeApplication()],
    });
    const repeatedCreate = await auth(
      request(context.app).post(draftPath),
    ).send({ introductory_message: 'Do not replace' });
    const update = await auth(request(context.app).patch(ownedPath)).send({
      introductory_message: 'Blocked',
    });
    expect(repeatedCreate.status).toBe(200);
    expect(repeatedCreate.body.meta.editable).toBe(false);
    expect(update.status).toBe(409);
    expect(update.body.error.code).toBe('LISTING_NOT_AVAILABLE');
    expect(context.applicationRecords[0].introductory_message).toBeNull();
  });

  it('blocks editing a non-DRAFT application', async () => {
    const context = createApplicationTestContext({
      applicationRecords: [
        makeApplication({
          status: 'SUBMITTED',
          submitted_at: '2026-08-22T08:30:00.000Z',
        }),
      ],
    });
    const response = await auth(request(context.app).patch(ownedPath)).send({
      introductory_message: 'Blocked',
    });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('APPLICATION_NOT_EDITABLE');
  });

  it('does not expose an unsupported POST answer endpoint', async () => {
    const context = createApplicationTestContext({
      applicationRecords: [makeApplication()],
    });
    expect(
      (await auth(request(context.app).post(`${ownedPath}/answers`)).send({}))
        .status,
    ).toBe(404);
  });
});

describe('rental application authentication and authorization', () => {
  it.each([
    ['POST', draftPath],
    ['GET', ownedPath],
    ['PATCH', ownedPath],
  ])('requires authentication for %s %s', async (method, path) => {
    const context = createApplicationTestContext({
      applicationRecords: [makeApplication()],
    });
    const testClient = request(context.app);
    const response = await testClient[method.toLowerCase()](path).send(
      method === 'PATCH' ? { number_of_occupants: 2 } : {},
    );
    expect(response.status).toBe(401);
  });

  it.each(['landlord-token', 'other-token'])(
    'blocks non-tenant role token %s',
    async (token) => {
      const profiles = [
        makeProfile(),
        makeProfile({ id: TEST_USERS.other, role: 'ADMIN' }),
        makeProfile({ id: TEST_USERS.landlord, role: 'LANDLORD' }),
      ];
      const context = createApplicationTestContext({
        applicationProfiles: profiles,
      });
      const response = await auth(
        request(context.app).post(draftPath),
        token,
      ).send({});
      expect(response.status).toBe(403);
      expect(context.applicationRecords).toHaveLength(0);
    },
  );

  it.each(['SUSPENDED', 'DELETED'])(
    'blocks a %s tenant before application access',
    async (accountStatus) => {
      const context = createApplicationTestContext({
        applicationProfiles: [
          makeProfile({ account_status: accountStatus }),
          makeProfile({ id: TEST_USERS.other }),
          makeProfile({ id: TEST_USERS.landlord, role: 'LANDLORD' }),
        ],
      });
      const response = await auth(request(context.app).post(draftPath)).send(
        {},
      );
      expect(response.status).toBe(403);
      expect(context.applicationRecords).toHaveLength(0);
    },
  );
});
