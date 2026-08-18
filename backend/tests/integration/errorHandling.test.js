import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../../src/app.js';

describe('request parsing', () => {
  it('returns a safe standard error for malformed JSON', async () => {
    const response = await request(app)
      .post('/api/v1/missing')
      .set('Content-Type', 'application/json')
      .send('{');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'INVALID_JSON',
        message: 'Request body contains invalid JSON.',
      },
    });
    expect(response.body.error).not.toHaveProperty('stack');
  });
});
