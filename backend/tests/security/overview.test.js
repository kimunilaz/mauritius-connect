import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { createOverviewRouter } from '../../src/routes/overviewRoutes.js';
import { createOverviewRepository } from '../../src/repositories/overviewRepository.js';
import { errorHandler } from '../../src/middleware/errorHandler.js';
import { InvalidAccessTokenError } from '../../src/services/authService.js';

function setup(role = 'LANDLORD', status = 'ACTIVE') {
  const repository = {
    landlord: vi.fn().mockResolvedValue({}),
    admin: vi.fn().mockResolvedValue({}),
  };
  const auth = {
    authenticateAccessToken: async (token) => {
      if (token !== 'valid') throw new InvalidAccessTokenError();
      return { userId: 'verified-owner', user_metadata: { role: 'ADMIN' } };
    },
    loadProfile: async () => (role ? { role, account_status: status } : null),
  };
  const app = express();
  app.use('/overview', createOverviewRouter(auth, repository));
  app.use(errorHandler);
  return { app, repository };
}

describe('overview authorization', () => {
  it.each(['landlord', 'admin'])(
    'requires authentication for %s',
    async (path) => {
      const { app, repository } = setup();
      expect((await request(app).get(`/overview/${path}`)).status).toBe(401);
      expect(
        (
          await request(app)
            .get(`/overview/${path}`)
            .set('Authorization', 'Bearer invalid')
        ).status,
      ).toBe(401);
      expect(repository[path]).not.toHaveBeenCalled();
    },
  );
  it.each([
    ['TENANT', 'landlord'],
    ['TENANT', 'admin'],
    ['LANDLORD', 'admin'],
    ['ADMIN', 'landlord'],
    [null, 'admin'],
  ])('rejects %s at %s regardless of claimed metadata', async (role, path) => {
    const { app, repository } = setup(role);
    const response = await request(app)
      .get(`/overview/${path}?role=ADMIN&userId=other`)
      .set('Authorization', 'Bearer valid');
    expect(response.status).toBe(403);
    expect(repository[path]).not.toHaveBeenCalled();
  });
  it.each(['SUSPENDED', 'DELETED'])(
    'rejects %s accounts before reading data',
    async (status) => {
      const { app, repository } = setup('ADMIN', status);
      expect(
        (
          await request(app)
            .get('/overview/admin')
            .set('Authorization', 'Bearer valid')
        ).status,
      ).toBe(403);
      expect(repository.admin).not.toHaveBeenCalled();
    },
  );
  it('derives landlord identity exclusively from the verified session', async () => {
    const { app, repository } = setup();
    expect(
      (
        await request(app)
          .get('/overview/landlord?userId=other')
          .set('Authorization', 'Bearer valid')
      ).status,
    ).toBe(200);
    expect(repository.landlord).toHaveBeenCalledExactlyOnceWith(
      'verified-owner',
    );
  });
  it('allows active admins and exposes no write operation', async () => {
    const { app, repository } = setup('ADMIN');
    expect(
      (
        await request(app)
          .get('/overview/admin')
          .set('Authorization', 'Bearer valid')
      ).status,
    ).toBe(200);
    expect(
      (
        await request(app)
          .post('/overview/admin')
          .set('Authorization', 'Bearer valid')
      ).status,
    ).toBe(404);
    expect(repository.admin).toHaveBeenCalledOnce();
  });
  it('fails closed on database errors', async () => {
    const { app, repository } = setup();
    repository.landlord.mockRejectedValue(
      new Error('private database details'),
    );
    const response = await request(app)
      .get('/overview/landlord')
      .set('Authorization', 'Bearer valid');
    expect(response.status).toBe(500);
    expect(JSON.stringify(response.body)).not.toContain(
      'private database details',
    );
  });
});

function captureQueries(fail = false) {
  const urls = [];
  const client = createClient('https://overview.example.test', 'test-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async (input) => {
        urls.push(new globalThis.URL(input));
        return new globalThis.Response(
          JSON.stringify(fail ? { message: 'failure' } : []),
          {
            status: fail ? 500 : 200,
            headers: {
              'Content-Type': 'application/json',
              'Content-Range': '*/0',
            },
          },
        );
      },
    },
  });
  return { urls, repository: createOverviewRepository(() => client) };
}

describe('overview query privacy', () => {
  it('filters every landlord application and viewing by ownership and non-draft submission', async () => {
    const { urls, repository } = captureQueries();
    expect(await repository.landlord('verified-owner')).toEqual({
      applications: { items: [], total: 0, waiting: 0 },
      viewings: { items: [], total: 0 },
    });
    expect(urls).toHaveLength(3);
    for (const url of urls) {
      const viewing = url.pathname.endsWith('/viewings');
      const prefix = viewing ? 'application.' : '';
      expect(
        url.searchParams.get(`${prefix}listing.property.landlord.user_id`),
      ).toBe('eq.verified-owner');
      expect(url.searchParams.get(`${prefix}status`)).toBe('neq.DRAFT');
      expect(url.searchParams.get(`${prefix}submitted_at`)).toBe('not.is.null');
      expect(url.searchParams.get('limit')).toBe('3');
      expect(url.searchParams.get('select')).not.toMatch(
        /introductory_message|answers|notes|tenant_id/,
      );
      if (viewing) {
        expect(url.searchParams.get('status')).toBe('in.(PROPOSED,CONFIRMED)');
        expect(url.searchParams.get('start_time')).toMatch(/^gte\./);
      }
    }
  });
  it('reads only bounded operational queues for admin, never evidence or messages', async () => {
    const { urls, repository } = captureQueries();
    await repository.admin();
    expect(urls.map((url) => url.pathname)).toEqual([
      '/rest/v1/listings',
      '/rest/v1/reports',
      '/rest/v1/verification_records',
      '/rest/v1/profiles',
    ]);
    for (const url of urls) {
      expect(url.searchParams.get('limit')).toBe('3');
      expect(url.searchParams.get('select')).not.toMatch(
        /\*|evidence|notes|description|message|content|email|phone/,
      );
    }
    expect(urls[0].searchParams.get('status')).toBe('eq.PENDING_REVIEW');
    expect(urls[1].searchParams.get('status')).toBe('in.(OPEN,UNDER_REVIEW)');
    expect(urls[2].searchParams.get('status')).toBe(
      'in.(PENDING,UNDER_REVIEW)',
    );
    expect(urls[3].searchParams.get('account_status')).toBe('eq.SUSPENDED');
  });
  it('never turns database failures into empty queues', async () => {
    const { repository } = captureQueries(true);
    await expect(repository.admin()).rejects.toThrow('Overview query failed');
  });
});
