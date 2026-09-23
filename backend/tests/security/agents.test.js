import express from 'express';
import request from 'supertest';
import { describe, it, expect, vi } from 'vitest';
import { createManagedOwnerRouter } from '../../src/routes/managedOwnerRoutes.js';
import { createManagedOwnerService } from '../../src/services/managedOwnerService.js';
import { createProfileService } from '../../src/services/profileService.js';
import { createPropertyService } from '../../src/services/propertyService.js';
import { errorHandler } from '../../src/middleware/errorHandler.js';
const id = (n) => `32000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
function setup(role = 'AGENT', user = id(1), status = 'ACTIVE') {
  const records = new Map([
    [id(11), { id: id(11), manager: id(1), name: 'Owner A', version: 1 }],
    [id(12), { id: id(12), manager: id(2), name: 'Owner B', version: 1 }],
  ]);
  const repository = {
    get: vi.fn(async (m, key) =>
      records.get(key)?.manager === m ? records.get(key) : null,
    ),
    list: vi.fn(async (m) => ({
      items: [...records.values()].filter((o) => o.manager === m),
      total: 1,
    })),
    create: vi.fn(async (m, fields) => ({ id: id(13), manager: m, ...fields })),
    update: vi.fn(async (m, key, version, fields) => {
      const o = records.get(key);
      return o?.manager === m && o.version === version && !o.archived_at
        ? { ...o, ...fields, version: version + 1 }
        : null;
    }),
  };
  const profiles = {
    ensurePropertyManager: vi.fn(async (u) => ({ id: u, role })),
  };
  const service = createManagedOwnerService({ repository, profiles });
  const auth = {
    authenticateAccessToken: async () => ({ userId: user }),
    loadProfile: async () => ({ role, account_status: status }),
  };
  const app = express();
  app.use(express.json());
  app.use('/owners', createManagedOwnerRouter(auth, service));
  app.use(errorHandler);
  return { app, repository, service, profiles };
}
const token = (r) => r.set('Authorization', 'Bearer fixture');
describe('managed owner boundaries', () => {
  it.each(['LANDLORD', 'TENANT', 'ADMIN'])(
    'denies %s every owner endpoint',
    async (role) => {
      const { app } = setup(role);
      for (const [method, path, body] of [
        ['get', '/owners'],
        ['post', '/owners', { name: 'New' }],
        ['get', `/owners/${id(11)}`],
        ['patch', `/owners/${id(11)}`, { name: 'Edit', version: 1 }],
        ['post', `/owners/${id(11)}/archive`, { version: 1 }],
      ])
        expect(
          (await token(request(app)[method](path)).send(body)).status,
        ).toBe(403);
    },
  );
  it.each(['SUSPENDED', 'DELETED'])('denies %s agents', async (status) =>
    expect(
      (await token(request(setup('AGENT', id(1), status).app).get('/owners')))
        .status,
    ).toBe(403),
  );
  it('denies unauthenticated access', async () =>
    expect((await request(setup().app).get('/owners')).status).toBe(401));
  it('scopes directory to the authenticated manager', async () => {
    const c = setup();
    const r = await token(
      request(c.app).get('/owners?search=Owner&page=2&limit=10'),
    );
    expect(r.status).toBe(200);
    expect(r.body.data.items.map((o) => o.name)).toEqual(['Owner A']);
    expect(c.repository.list).toHaveBeenCalledWith(id(1), {
      search: 'Owner',
      page: 2,
      limit: 10,
      archived: false,
    });
  });
  it.each(['get', 'patch', 'archive'])(
    'hides unrelated owner on %s',
    async (action) => {
      const { app, repository } = setup();
      const path = `/owners/${id(12)}${action === 'archive' ? '/archive' : ''}`;
      const r = await token(
        request(app)[action === 'archive' ? 'post' : action](path),
      ).send(
        action === 'get'
          ? undefined
          : { version: 1, ...(action === 'patch' ? { name: 'Stolen' } : {}) },
      );
      expect(r.status).toBe(404);
      expect(repository.update).not.toHaveBeenCalled();
    },
  );
  it('creates a business record without authentication side effects', async () => {
    const c = setup();
    const r = await token(request(c.app).post('/owners')).send({
      name: 'New owner',
      email: 'client@example.test',
    });
    expect(r.status).toBe(201);
    expect(c.repository.create).toHaveBeenCalledWith(id(1), {
      name: 'New owner',
      email: 'client@example.test',
    });
  });
  it.each([
    'property_manager_id',
    'user_id',
    'landlord_id',
    'role',
    'archived_at',
  ])('rejects mass assignment of %s', async (field) => {
    const c = setup();
    expect(
      (
        await token(request(c.app).post('/owners')).send({
          name: 'Owner',
          [field]: id(2),
        })
      ).status,
    ).toBe(422);
    expect(c.repository.create).not.toHaveBeenCalled();
  });
  it('rejects stale edits and archives with the same version guard', async () => {
    const c = setup();
    expect(
      (
        await token(request(c.app).patch(`/owners/${id(11)}`)).send({
          name: 'Updated',
          version: 2,
        })
      ).status,
    ).toBe(409);
    const r = await token(
      request(c.app).post(`/owners/${id(11)}/archive`),
    ).send({ version: 1 });
    expect(r.status).toBe(200);
    expect(r.body.data.archived_at).toBeTruthy();
  });
  it('uses shared manager profiles without creating agent landlord identities', async () => {
    const landlordProfiles = { findByUserId: vi.fn() },
      managers = { findByUserId: vi.fn(async () => ({ id: id(20) })) };
    const service = createProfileService({
      profiles: { findByUserId: async () => ({ role: 'AGENT' }) },
      landlordProfiles,
      managers,
    });
    expect(await service.ensurePropertyManager(id(1))).toEqual({
      id: id(20),
      role: 'AGENT',
    });
    expect(landlordProfiles.findByUserId).not.toHaveBeenCalled();
    await expect(service.ensureLandlordProfile(id(1))).rejects.toMatchObject({
      statusCode: 403,
    });
  });
  it('requires client ownership only for agent property creation', async () => {
    const properties = { create: vi.fn(async (m, p) => p) };
    const profiles = {
      ensurePropertyManager: async (u) => ({
        id: u,
        role: u === id(1) ? 'AGENT' : 'LANDLORD',
      }),
    };
    const s = createPropertyService({ properties, profiles });
    await expect(s.create(id(1), {})).rejects.toMatchObject({
      statusCode: 422,
    });
    await expect(
      s.create(id(2), { managed_owner_id: id(11) }),
    ).rejects.toMatchObject({ statusCode: 422 });
    expect(await s.create(id(1), { managed_owner_id: id(11) })).toMatchObject({
      managed_owner_id: id(11),
    });
    expect(await s.create(id(2), {})).not.toHaveProperty('managed_owner_id');
  });
});
