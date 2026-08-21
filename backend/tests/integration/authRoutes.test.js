import request from 'supertest';
import { describe, expect, it } from 'vitest';
import {
  createAuthTestContext,
  makeProfile,
  TEST_USERS,
} from '../helpers/createAuthTestContext.js';

function authenticated(requestBuilder, token = 'tenant-token') {
  return requestBuilder.set('Authorization', `Bearer ${token}`);
}

const validTenantPayload = {
  role: 'TENANT',
  first_name: 'Jane',
  last_name: 'Doe',
  phone: '+230 5555 0101',
};

describe('POST /api/v1/auth/register-profile', () => {
  it.each([
    ['TENANT', 'tenant-token', TEST_USERS.tenant],
    ['LANDLORD', 'landlord-token', TEST_USERS.landlord],
  ])('creates an authenticated %s profile', async (role, token, userId) => {
    const { app, records } = createAuthTestContext();
    const response = await authenticated(
      request(app).post('/api/v1/auth/register-profile'),
      token,
    ).send({
      ...validTenantPayload,
      role,
    });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      success: true,
      data: {
        id: userId,
        role,
        first_name: 'Jane',
        last_name: 'Doe',
        phone: '+230 5555 0101',
        profile_photo_url: null,
        phone_verified: false,
        account_status: 'ACTIVE',
      },
    });
    expect(records.get(userId)).toMatchObject({
      id: userId,
      role,
      phone_verified: false,
      account_status: 'ACTIVE',
    });
  });

  it('rejects public ADMIN registration', async () => {
    const { app, records } = createAuthTestContext();
    const response = await authenticated(
      request(app).post('/api/v1/auth/register-profile'),
    ).send({ ...validTenantPayload, role: 'ADMIN' });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(records.size).toBe(0);
  });

  it.each([
    ['missing first name', { first_name: undefined }],
    ['missing last name', { last_name: undefined }],
    ['invalid role', { role: 'OWNER' }],
    ['oversized first name', { first_name: 'x'.repeat(101) }],
    ['oversized phone', { phone: `+230${'1'.repeat(40)}` }],
  ])('rejects %s', async (_case, overrides) => {
    const { app } = createAuthTestContext();
    const payload = { ...validTenantPayload, ...overrides };

    for (const [key, value] of Object.entries(payload)) {
      if (value === undefined) {
        delete payload[key];
      }
    }

    const response = await authenticated(
      request(app).post('/api/v1/auth/register-profile'),
    ).send(payload);

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it.each([
    ['id', TEST_USERS.other],
    ['user_id', TEST_USERS.other],
    ['account_status', 'SUSPENDED'],
    ['phone_verified', true],
  ])(
    'rejects protected field %s instead of mass-assigning it',
    async (key, value) => {
      const { app, records } = createAuthTestContext();
      const response = await authenticated(
        request(app).post('/api/v1/auth/register-profile'),
      ).send({ ...validTenantPayload, [key]: value });

      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(records.has(TEST_USERS.other)).toBe(false);
      expect(records.size).toBe(0);
    },
  );

  it('returns a stable conflict and cannot change an existing role', async () => {
    const existing = makeProfile({
      id: TEST_USERS.tenant,
      role: 'TENANT',
    });
    const { app, records } = createAuthTestContext([existing]);
    const response = await authenticated(
      request(app).post('/api/v1/auth/register-profile'),
    ).send({ ...validTenantPayload, role: 'LANDLORD' });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('PROFILE_ALREADY_EXISTS');
    expect(records.get(TEST_USERS.tenant).role).toBe('TENANT');
  });
});

describe('GET /api/v1/auth/me', () => {
  it('returns only safe fields for an ACTIVE profile', async () => {
    const profile = makeProfile({
      id: TEST_USERS.tenant,
      first_name: 'Jane',
      last_name: 'Doe',
      phone: '+230 5555 0101',
    });
    const { app } = createAuthTestContext([profile]);
    const response = await authenticated(request(app).get('/api/v1/auth/me'));

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(profile);
    expect(response.body.data).not.toHaveProperty('created_at');
    expect(response.body.data).not.toHaveProperty('updated_at');
  });

  it('requires authentication', async () => {
    const { app } = createAuthTestContext();
    const response = await request(app).get('/api/v1/auth/me');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('AUTH_REQUIRED');
  });

  it('rejects an invalid token', async () => {
    const { app } = createAuthTestContext();
    const response = await authenticated(
      request(app).get('/api/v1/auth/me'),
      'invalid-token',
    );

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('INVALID_TOKEN');
  });

  it('returns onboarding-required for a verified identity without a profile', async () => {
    const { app } = createAuthTestContext();
    const response = await authenticated(request(app).get('/api/v1/auth/me'));

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('ONBOARDING_REQUIRED');
  });

  it.each([
    ['SUSPENDED', 'ACCOUNT_SUSPENDED'],
    ['DELETED', 'ACCOUNT_DELETED'],
  ])('blocks a %s profile', async (accountStatus, errorCode) => {
    const profile = makeProfile({ account_status: accountStatus });
    const { app } = createAuthTestContext([profile]);
    const response = await authenticated(request(app).get('/api/v1/auth/me'));

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe(errorCode);
  });
});
