import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createAuthenticateUser } from '../../src/middleware/authenticateUser.js';
import { errorHandler } from '../../src/middleware/errorHandler.js';
import { InvalidAccessTokenError } from '../../src/services/authService.js';

function createProtectedApp(authenticateAccessToken) {
  const app = express();
  const authService = { authenticateAccessToken };

  app.get(
    '/protected',
    createAuthenticateUser(authService),
    (request_, response) => {
      response.json({ success: true, data: request_.auth });
    },
  );
  app.use(errorHandler);

  return app;
}

describe('authenticateUser', () => {
  it.each([
    ['no Authorization header', undefined],
    ['empty Authorization header', ''],
    ['wrong authentication scheme', 'Basic credentials'],
    ['empty Bearer token', 'Bearer '],
  ])('rejects %s', async (_case, authorization) => {
    const verify = vi.fn();
    let call = request(createProtectedApp(verify)).get('/protected');

    if (authorization !== undefined) {
      call = call.set('Authorization', authorization);
    }

    const response = await call;

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('AUTH_REQUIRED');
    expect(verify).not.toHaveBeenCalled();
  });

  it('rejects a token that fails Supabase verification', async () => {
    const verify = vi.fn().mockRejectedValue(new InvalidAccessTokenError());
    const response = await request(createProtectedApp(verify))
      .get('/protected')
      .set('Authorization', 'Bearer invalid-token');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('INVALID_TOKEN');
  });

  it('does not authenticate a merely decodable fake JWT', async () => {
    const verify = vi.fn().mockRejectedValue(new InvalidAccessTokenError());
    const fakeJwt = 'eyJhbGciOiJub25lIn0.eyJzdWIiOiJmYWtlIn0.';
    const response = await request(createProtectedApp(verify))
      .get('/protected')
      .set('Authorization', `Bearer ${fakeJwt}`);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('INVALID_TOKEN');
    expect(verify).toHaveBeenCalledWith(fakeJwt);
  });

  it('attaches only the verified user ID for a valid token', async () => {
    const identity = {
      userId: '00000000-0000-0000-0000-000000000001',
    };
    const verify = vi.fn().mockResolvedValue(identity);
    const response = await request(createProtectedApp(verify))
      .get('/protected')
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(identity);
    expect(verify).toHaveBeenCalledWith('valid-token');
  });
});
