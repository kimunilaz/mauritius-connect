import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { errorHandler } from '../../src/middleware/errorHandler.js';
import { requireRole } from '../../src/middleware/requireRole.js';

function createRoleApp(profileRole, requiredRoles, auth = {}) {
  const app = express();
  app.use(express.json());
  app.post(
    '/protected',
    (request_, _response, next) => {
      request_.auth = auth;
      request_.profile = { role: profileRole };
      next();
    },
    requireRole(...requiredRoles),
    (_request, response) => {
      response.json({ success: true });
    },
  );
  app.use(errorHandler);
  return app;
}

describe('requireRole', () => {
  it.each([
    ['TENANT', ['TENANT']],
    ['LANDLORD', ['LANDLORD']],
    ['ADMIN', ['ADMIN']],
    ['TENANT', ['TENANT', 'LANDLORD']],
  ])('allows %s for %j', async (profileRole, requiredRoles) => {
    const response = await request(
      createRoleApp(profileRole, requiredRoles),
    ).post('/protected');

    expect(response.status).toBe(200);
  });

  it.each([
    ['TENANT', ['LANDLORD']],
    ['TENANT', ['ADMIN']],
    ['LANDLORD', ['ADMIN']],
  ])('rejects %s for %j', async (profileRole, requiredRoles) => {
    const response = await request(
      createRoleApp(profileRole, requiredRoles),
    ).post('/protected');

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('ignores request-body role escalation', async () => {
    const response = await request(createRoleApp('TENANT', ['ADMIN']))
      .post('/protected')
      .send({ role: 'ADMIN' });

    expect(response.status).toBe(403);
  });

  it('ignores an ADMIN role in auth user metadata', async () => {
    const response = await request(
      createRoleApp('TENANT', ['ADMIN'], {
        userId: 'verified-user',
        user_metadata: { role: 'ADMIN' },
      }),
    ).post('/protected');

    expect(response.status).toBe(403);
  });
});
