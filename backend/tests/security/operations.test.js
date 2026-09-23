import { Buffer } from 'node:buffer';
import express from 'express';
import request from 'supertest';
import { describe, it, expect, vi } from 'vitest';
import {
  createOwnerOperationRouter,
  createTenantOperationRouter,
} from '../../src/routes/operationRoutes.js';
import {
  createOperationService,
  rentStatus,
} from '../../src/services/operationService.js';
import { operationInput } from '../../src/validators/operationValidators.js';
import { errorHandler } from '../../src/middleware/errorHandler.js';
const id = (n) => `31000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
function setup(role = 'LANDLORD', status = 'ACTIVE') {
  const repository = {
    owns: vi.fn(async (user, p) =>
      p === id(1) ? { id: p, archived_at: null } : null,
    ),
    create: vi.fn(async (d, p) => ({ id: id(4), ...p })),
    get: vi.fn(async () => null),
    related: vi.fn(async () => null),
    list: vi.fn(async () => ({ items: [], total: 0 })),
    tenantTenancy: vi.fn(async () => null),
    tenantList: vi.fn(async () => ({ items: [], total: 0 })),
    rpc: vi.fn(),
    receipts: vi.fn(async () => []),
  };
  const storage = {
    upload: vi.fn(async () => ({})),
    remove: vi.fn(async () => ({})),
    createSignedUrl: vi.fn(),
  };
  const service = createOperationService({
    repository,
    clock: () => new Date('2026-09-22T10:00:00Z'),
    storage: () => storage,
  });
  const auth = {
    authenticateAccessToken: async () => ({ userId: id(9) }),
    loadProfile: async () => ({ role, account_status: status }),
  };
  const app = express();
  app.use(express.json());
  app.use('/owner', createOwnerOperationRouter(auth, service));
  app.use('/tenant', createTenantOperationRouter(auth, service));
  app.use(errorHandler);
  return { app, repository, service, storage };
}
const token = (r) => r.set('Authorization', 'Bearer test');
describe('property operations authorization', () => {
  it('denies unauthenticated users', async () => {
    expect((await request(setup().app).get('/owner/tasks')).status).toBe(401);
  });
  it.each(['TENANT', 'ADMIN'])('denies %s owner APIs', async (role) => {
    expect(
      (await token(request(setup(role).app).get('/owner/tasks'))).status,
    ).toBe(403);
  });
  it.each(['SUSPENDED', 'DELETED'])('denies %s accounts', async (status) => {
    expect(
      (await token(request(setup('LANDLORD', status).app).get('/owner/tasks')))
        .status,
    ).toBe(403);
  });
  it.each([
    'details',
    'tenancies',
    'rent',
    'maintenance',
    'finances',
    'inspections',
    'documents',
    'tasks',
  ])('scopes %s reads to owned properties', async (domain) => {
    const { app, repository } = setup();
    expect(
      (await token(request(app).get(`/owner/${domain}?property_id=${id(2)}`)))
        .status,
    ).toBe(404);
    expect(repository.list).not.toHaveBeenCalled();
  });
  it('rejects ownership and tenant identity mass assignment', async () => {
    const { app, repository } = setup();
    const r = await token(request(app).post('/owner/tenancies')).send({
      property_id: id(1),
      tenant_name: 'A',
      tenant_user_id: id(5),
      landlord_id: id(9),
      start_date: '2026-09-01',
      monthly_rent: 100,
      status: 'ACTIVE',
    });
    expect(r.status).toBe(422);
    expect(repository.create).not.toHaveBeenCalled();
  });
  it('creates existing occupied tenancy with explicit terms and no application', async () => {
    const { app, repository } = setup();
    const r = await token(request(app).post('/owner/tenancies')).send({
      property_id: id(1),
      tenant_name: 'Existing tenant',
      start_date: '2026-09-01',
      monthly_rent: 100,
      status: 'ACTIVE',
    });
    expect(r.status).toBe(201);
    expect(repository.create.mock.calls[0][1]).not.toHaveProperty(
      'tenant_user_id',
    );
    expect(repository.create.mock.calls[0][1]).not.toHaveProperty(
      'application_id',
    );
  });
  it('does not invent lease dates or rent for accepted applications', async () => {
    const { app } = setup();
    const r = await token(request(app).post('/owner/tenancies')).send({
      property_id: id(1),
      tenant_name: 'A',
      application_id: id(5),
    });
    expect(r.status).toBe(422);
  });
  it('does not inject default statuses into partial updates', () => {
    expect(
      operationInput('maintenance', true).parse({
        version: 1,
        owner_update: 'Done',
      }),
    ).toEqual({ version: 1, owner_update: 'Done' });
  });
  it('rejects cross-property task tenancy links', async () => {
    const { app } = setup();
    const r = await token(request(app).post('/owner/tasks')).send({
      property_id: id(1),
      tenancy_id: id(2),
      title: 'Test',
      due_date: '2026-10-01',
    });
    expect(r.status).toBe(404);
  });
  it('denies former or unrelated tenant operations', async () => {
    const { app } = setup('TENANT');
    expect(
      (await token(request(app).get(`/tenant/rent?tenancy_id=${id(1)}`)))
        .status,
    ).toBe(404);
  });
  it('tenant cannot read owner finances inspections notes or tasks', async () => {
    const { app } = setup('TENANT');
    for (const domain of ['finances', 'inspections', 'details', 'tasks'])
      expect(
        (await token(request(app).get(`/tenant/${domain}?tenancy_id=${id(1)}`)))
          .status,
      ).toBe(422);
  });
  it('tenant maintenance serializer strips costs vendors and private notes', async () => {
    const { app, repository } = setup('TENANT');
    repository.tenantTenancy.mockResolvedValue({
      id: id(3),
      property_id: id(1),
      status: 'ACTIVE',
      start_date: '2026-09-01',
    });
    repository.tenantList.mockResolvedValue({
      items: [
        {
          id: id(4),
          title: 'Leak',
          status: 'NEW',
          owner_update: 'Scheduled',
          owner_notes: 'SECRET',
          actual_cost: 999,
          vendor_contact: 'PRIVATE',
          submitted_by: id(9),
        },
      ],
      total: 1,
    });
    const r = await token(
      request(app).get(`/tenant/maintenance?tenancy_id=${id(3)}`),
    );
    expect(r.status).toBe(200);
    expect(r.body.data[0]).toEqual({
      id: id(4),
      title: 'Leak',
      status: 'NEW',
      owner_update: 'Scheduled',
    });
  });
  it('upcoming tenancy can read but cannot submit a maintenance request', async () => {
    const { app, repository } = setup('TENANT');
    repository.tenantTenancy.mockResolvedValue({
      id: id(3),
      property_id: id(1),
      status: 'UPCOMING',
      start_date: '2026-10-01',
    });
    const r = await token(request(app).post('/tenant/maintenance')).send({
      property_id: id(1),
      tenancy_id: id(3),
      title: 'Leak',
      description: 'Tap',
    });
    expect(r.status).toBe(404);
    expect(repository.create).not.toHaveBeenCalled();
  });
  it('tenant submission derives actor and rejects owner-only fields', async () => {
    const { app, repository } = setup('TENANT');
    repository.tenantTenancy.mockResolvedValue({
      id: id(3),
      property_id: id(1),
      status: 'ACTIVE',
      start_date: '2026-09-01',
    });
    const input = {
      property_id: id(1),
      tenancy_id: id(3),
      title: 'Leak',
      description: 'Tap',
    };
    expect(
      (
        await token(request(app).post('/tenant/maintenance')).send({
          ...input,
          actual_cost: 1,
        })
      ).status,
    ).toBe(422);
    expect(
      (await token(request(app).post('/tenant/maintenance')).send(input))
        .status,
    ).toBe(201);
    expect(repository.create.mock.calls[0][1]).toMatchObject({
      submitted_by: id(9),
      status: 'NEW',
      priority: 'NORMAL',
    });
  });
  it('documents are never signed for a different tenancy', async () => {
    const { service, repository, storage } = setup('TENANT');
    repository.tenantTenancy.mockResolvedValue({
      id: id(3),
      property_id: id(1),
      status: 'ACTIVE',
      start_date: '2026-09-01',
    });
    repository.related.mockResolvedValue({
      id: id(4),
      shared_tenancy_id: id(8),
    });
    await expect(
      service.documentUrl(id(9), id(4), id(3)),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(storage.createSignedUrl).not.toHaveBeenCalled();
  });
  it('invalid file content cannot create a stored document', async () => {
    const { service, storage } = setup();
    await expect(
      service.upload(
        id(9),
        { property_id: id(1), category: 'OTHER' },
        {
          buffer: Buffer.from('not a file'),
          size: 10,
          originalname: 'bad.png',
        },
      ),
    ).rejects.toBeDefined();
    expect(storage.upload).not.toHaveBeenCalled();
  });
  it('rent states are deterministic and overdue remains actionable after partial payment', () => {
    const e = { amount_due: 100, due_date: '2026-09-01' };
    expect(rentStatus(e, 20, '2026-09-22')).toBe('OVERDUE');
    expect(rentStatus(e, 100, '2026-09-22')).toBe('PAID');
    expect(rentStatus({ ...e, waived: true }, 0, '2026-09-22')).toBe('WAIVED');
  });
  it('expired tenancy loses every tenant operational read', async () => {
    const { app, repository } = setup('TENANT');
    repository.tenantTenancy.mockResolvedValue({
      id: id(3),
      property_id: id(1),
      status: 'ACTIVE',
      start_date: '2026-01-01',
      expected_end_date: '2026-09-01',
    });
    for (const domain of ['rent', 'maintenance', 'documents'])
      expect(
        (await token(request(app).get(`/tenant/${domain}?tenancy_id=${id(3)}`)))
          .status,
      ).toBe(404);
    expect(repository.tenantList).not.toHaveBeenCalled();
  });
  it('private rent notes and owner-only metadata never enter the tenant DTO', async () => {
    const { app, repository } = setup('TENANT');
    repository.tenantTenancy.mockResolvedValue({
      id: id(3),
      property_id: id(1),
      status: 'ACTIVE',
      start_date: '2026-01-01',
    });
    repository.tenantList.mockResolvedValue({
      items: [
        {
          id: id(4),
          notes: 'SECRET',
          property: { address_line_1: 'PRIVATE' },
          amount_due: 100,
          amount_paid: 10,
          outstanding: 90,
          rent_status: 'OVERDUE',
          receipts: [],
        },
      ],
      total: 1,
    });
    const r = await token(request(app).get(`/tenant/rent?tenancy_id=${id(3)}`));
    expect(r.status).toBe(200);
    expect(r.body.data[0]).toMatchObject({ amount_paid: 10, outstanding: 90 });
    expect(JSON.stringify(r.body)).not.toMatch(/SECRET|PRIVATE/);
  });
  it('upload metadata failure removes the newly created private object', async () => {
    const { service, repository, storage } = setup();
    repository.create.mockRejectedValue(new Error('write conflict'));
    await expect(
      service.upload(
        id(9),
        { property_id: id(1), category: 'OTHER' },
        {
          buffer: Buffer.from('%PDF-1.4\n%%EOF'),
          size: 14,
          originalname: 'report.pdf',
        },
      ),
    ).rejects.toThrow('write conflict');
    expect(storage.upload).toHaveBeenCalledOnce();
    expect(storage.remove).toHaveBeenCalledOnce();
  });
  it('rejects incomplete PDF data before storage', async () => {
    const { service, storage } = setup();
    await expect(
      service.upload(
        id(9),
        { property_id: id(1), category: 'OTHER' },
        {
          buffer: Buffer.from('%PDF-not-a-document'),
          size: 19,
          originalname: 'report.pdf',
        },
      ),
    ).rejects.toMatchObject({ statusCode: 422 });
    expect(storage.upload).not.toHaveBeenCalled();
  });
  it('optimistic record edits report a conflict instead of overwriting newer data', async () => {
    const { service, repository } = setup();
    repository.get.mockResolvedValue({
      id: id(4),
      property_id: id(1),
      version: 2,
    });
    repository.update = vi.fn(async () => null);
    await expect(
      service.update(id(9), 'tasks', id(4), { version: 1, title: 'Changed' }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});
