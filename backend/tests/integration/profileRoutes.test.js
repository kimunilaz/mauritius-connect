import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { TEST_USERS } from '../helpers/createAuthTestContext.js';
import { createProfileTestContext } from '../helpers/createProfileTestContext.js';

const auth = (builder, token = 'tenant-token') =>
  builder.set('Authorization', `Bearer ${token}`);

describe('tenant profile routes', () => {
  it('initializes once and returns a safe tenant profile', async () => {
    const context = createProfileTestContext();
    const first = await auth(
      request(context.app).get('/api/v1/tenant/profile'),
    );
    const second = await auth(
      request(context.app).get('/api/v1/tenant/profile'),
    );

    expect(first.status).toBe(200);
    expect(first.body.data).toEqual(second.body.data);
    expect(first.body.data).not.toHaveProperty('id');
    expect(first.body.data).not.toHaveProperty('user_id');
    expect(context.tenantRecords.size).toBe(1);
  });

  it('updates allowlisted fields and normalizes optional blanks', async () => {
    const context = createProfileTestContext();
    const response = await auth(
      request(context.app).patch('/api/v1/tenant/profile'),
    ).send({
      occupation_type: ' STUDENT ',
      employer_or_school: '',
      preferred_move_date: '2026-10-01',
      preferred_lease_duration_months: 6,
      number_of_occupants: 2,
      has_pets: true,
      bio: 'Quiet household',
    });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      occupation_type: 'STUDENT',
      employer_or_school: null,
      preferred_lease_duration_months: 6,
      number_of_occupants: 2,
      has_pets: true,
    });
  });

  it.each([
    [{ preferred_move_date: '2026-02-30' }],
    [{ preferred_lease_duration_months: 0 }],
    [{ number_of_occupants: 0 }],
    [{ bio: 'x'.repeat(1001) }],
    [{ id: TEST_USERS.other }],
    [{ user_id: TEST_USERS.other }],
    [{ created_at: '2026-01-01T00:00:00Z' }],
    [{ updated_at: '2026-01-01T00:00:00Z' }],
    [{ role: 'LANDLORD' }],
    [{ account_status: 'ACTIVE' }],
    [{ phone_verified: true }],
    [{}],
  ])('rejects invalid or protected tenant update %j', async (payload) => {
    const context = createProfileTestContext();
    const response = await auth(
      request(context.app).patch('/api/v1/tenant/profile'),
    ).send(payload);
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('blocks cross-role and inactive access before initialization', async () => {
    const crossRole = createProfileTestContext();
    const landlord = await auth(
      request(crossRole.app).get('/api/v1/tenant/profile'),
      'landlord-token',
    );
    expect(landlord.status).toBe(403);
    expect(crossRole.tenantRecords.has(TEST_USERS.landlord)).toBe(false);

    for (const status of ['SUSPENDED', 'DELETED']) {
      const context = createProfileTestContext({
        applicationProfiles: [
          {
            id: TEST_USERS.tenant,
            role: 'TENANT',
            first_name: 'Test',
            last_name: 'Tenant',
            phone: null,
            profile_photo_url: null,
            phone_verified: false,
            account_status: status,
          },
        ],
      });
      const response = await auth(
        request(context.app).get('/api/v1/tenant/profile'),
      );
      expect(response.status).toBe(403);
      expect(context.tenantRecords.size).toBe(0);
    }
  });
});

describe('preferred location routes', () => {
  it('creates, lists, prevents duplicates, and deletes an owned location', async () => {
    const context = createProfileTestContext();
    const created = await auth(
      request(context.app).post('/api/v1/tenant/preferred-locations'),
    ).send({ district: ' Moka ', locality: 'Moka', neighbourhood: null });
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({
      district: 'Moka',
      locality: 'Moka',
    });

    const duplicate = await auth(
      request(context.app).post('/api/v1/tenant/preferred-locations'),
    ).send({ district: 'moka', locality: ' MOKA ' });
    expect(duplicate.status).toBe(409);

    const listed = await auth(
      request(context.app).get('/api/v1/tenant/preferred-locations'),
    );
    expect(listed.body.data).toHaveLength(1);

    const removed = await auth(
      request(context.app).delete(
        `/api/v1/tenant/preferred-locations/${created.body.data.id}`,
      ),
    );
    expect(removed.status).toBe(204);
    expect(context.locationRecords.size).toBe(0);
  });

  it.each([
    [{}],
    [{ district: ' ', locality: null, neighbourhood: '' }],
    [{ district: 'x'.repeat(101) }],
    [{ tenant_profile_id: TEST_USERS.other, district: 'Moka' }],
  ])('rejects invalid or protected location %j', async (payload) => {
    const context = createProfileTestContext();
    const response = await auth(
      request(context.app).post('/api/v1/tenant/preferred-locations'),
    ).send(payload);
    expect(response.status).toBe(422);
  });

  it('does not delete another tenant profile location', async () => {
    const foreignLocationId = '90000000-0000-4000-8000-000000000001';
    const context = createProfileTestContext({
      tenantRoleProfiles: [
        {
          id: '80000000-0000-4000-8000-000000000001',
          user_id: TEST_USERS.tenant,
          has_pets: false,
        },
      ],
      preferredLocations: [
        {
          id: foreignLocationId,
          tenant_profile_id: '80000000-0000-4000-8000-000000000099',
          district: 'Flacq',
          locality: null,
          neighbourhood: null,
        },
      ],
    });
    const response = await auth(
      request(context.app).delete(
        `/api/v1/tenant/preferred-locations/${foreignLocationId}`,
      ),
    );
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('PREFERRED_LOCATION_NOT_FOUND');
    expect(context.locationRecords.has(foreignLocationId)).toBe(true);
  });
});

describe('landlord and base profile routes', () => {
  it('initializes landlord state, updates base fields, and protects verification', async () => {
    const context = createProfileTestContext();
    const initial = await auth(
      request(context.app).get('/api/v1/landlord/profile'),
      'landlord-token',
    );
    expect(initial.body.data.verification_status).toBe('UNVERIFIED');

    const updated = await auth(
      request(context.app).patch('/api/v1/landlord/profile'),
      'landlord-token',
    ).send({ first_name: 'Marie', phone: '+230 5555 1234' });
    expect(updated.status).toBe(200);
    expect(updated.body.data).toMatchObject({
      first_name: 'Marie',
      verification_status: 'UNVERIFIED',
    });

    const escalation = await auth(
      request(context.app).patch('/api/v1/landlord/profile'),
      'landlord-token',
    ).send({ verification_status: 'VERIFIED' });
    expect(escalation.status).toBe(422);
    expect(
      context.landlordRecords.get(TEST_USERS.landlord).verification_status,
    ).toBe('UNVERIFIED');
  });

  it('blocks tenant from landlord and landlord from tenant endpoints', async () => {
    const context = createProfileTestContext();
    expect(
      (await auth(request(context.app).get('/api/v1/landlord/profile'))).status,
    ).toBe(403);
    expect(
      (
        await auth(
          request(context.app).get('/api/v1/tenant/profile'),
          'landlord-token',
        )
      ).status,
    ).toBe(403);
    expect(context.landlordRecords.has(TEST_USERS.tenant)).toBe(false);
    expect(context.tenantRecords.has(TEST_USERS.landlord)).toBe(false);
  });

  it('updates tenant base data without allowing account fields', async () => {
    const context = createProfileTestContext();
    const updated = await auth(
      request(context.app).patch('/api/v1/profile'),
    ).send({
      first_name: 'Jane',
      last_name: 'Doe',
      phone: null,
    });
    expect(updated.status).toBe(200);
    const rejected = await auth(
      request(context.app).patch('/api/v1/profile'),
    ).send({
      role: 'ADMIN',
    });
    expect(rejected.status).toBe(422);
    expect(context.profileRecords.get(TEST_USERS.tenant).role).toBe('TENANT');
  });
});
