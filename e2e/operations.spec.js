import { test, expect } from '@playwright/test';
import { ownerOperations } from './workspace-fixtures.js';
const propertyId = '00000000-0000-4000-a000-000000000002';
const tenancyId = '31000000-0000-4000-8000-000000000031';
const today = new Date().toISOString().slice(0, 10);
async function setup(
  page,
  { tenant = false, occupied = false, agent = false } = {},
) {
  const rows = {
    tenancies: occupied
      ? [
          {
            id: tenancyId,
            property_id: propertyId,
            tenant_name: 'Jamie Tenant',
            status: 'ACTIVE',
            start_date: '2026-01-01',
            monthly_rent: 18000,
            version: 1,
          },
        ]
      : [],
    rent: [],
    maintenance: [],
    inspections: [],
    finances: [],
    tasks: [],
    documents: [],
    details: [],
  };
  const writes = [];
  const user = {
    id: '00000000-0000-4000-a000-000000000001',
    email: 'operations@example.test',
    aud: 'authenticated',
    role: 'authenticated',
    app_metadata: {},
    user_metadata: {},
    created_at: '2026-01-01T00:00:00Z',
  };
  await page.route('https://**.supabase.co/**', (route) => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const encode = (v) => Buffer.from(JSON.stringify(v)).toString('base64url');
    return route.fulfill({
      headers: { 'access-control-allow-origin': '*' },
      json: {
        access_token: `${encode({ alg: 'HS256' })}.${encode({ sub: user.id, exp, aud: 'authenticated' })}.fixture`,
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: exp,
        refresh_token: 'fixture',
        user,
      },
    });
  });
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      path = url.pathname;
    const reply = (data, status = 200) =>
      route.fulfill({
        status,
        json: {
          success: true,
          data,
          meta: {
            total: Array.isArray(data) ? data.length : 0,
            page: 1,
            total_pages: 1,
          },
        },
      });
    if (path.endsWith('/auth/me'))
      return reply({
        ...user,
        first_name: 'Alex',
        last_name: 'Owner',
        role: tenant ? 'TENANT' : agent ? 'AGENT' : 'LANDLORD',
        account_status: 'ACTIVE',
      });
    if (path.endsWith('/unread-count')) return reply({ unread_count: 0 });
    if (path.endsWith('/agent/owners'))
      return reply({
        items: [
          { id: '32000000-0000-4000-8000-000000000032', name: 'Client owner' },
        ],
        total: 1,
      });
    if (path.endsWith('/summary')) {
      const d = ownerOperations();
      const t = rows.tenancies[0];
      d.total_properties = 1;
      d.totals.properties = 1;
      d.totals.occupied = t ? 1 : 0;
      d.totals.vacant = t ? 0 : 1;
      Object.assign(d.portfolio[0], {
        occupancy: t ? 'OCCUPIED' : 'VACANT',
        tenant_name: t?.tenant_name ?? null,
        tenancy_id: t?.id ?? null,
        monthly_rent: t?.monthly_rent ?? null,
      });
      return reply(d);
    }
    if (path.endsWith('/leasing'))
      return reply({ listings: [], applications: [], viewings: [] });
    if (path.endsWith('/operations/home'))
      return reply([
        {
          id: tenancyId,
          property_id: propertyId,
          status: 'ACTIVE',
          start_date: '2026-01-01',
          monthly_rent: 18000,
          property: { locality: 'Moka', address_line_1: 'Moka apartment' },
        },
      ]);
    if (path.includes('/operations/')) {
      const parts = path.split('/operations/')[1].split('/');
      const domain = parts[0];
      if (req.method() === 'GET') {
        if (parts[1])
          return reply({
            ...rows[domain].find((r) => r.id === parts[1]),
            updates: [
              {
                id: 'update',
                status: 'NEW',
                created_at: new Date().toISOString(),
              },
            ],
          });
        return reply(rows[domain] ?? []);
      }
      if (parts[1] === 'upload') {
        writes.push({ domain, upload: req.postData() });
        const r = {
          id: 'doc',
          property_id: propertyId,
          filename: 'inspection.pdf',
          category: 'INSPECTION',
          version: 1,
          created_at: new Date().toISOString(),
        };
        rows.documents.push(r);
        return reply(r, 201);
      }
      const body = req.postDataJSON();
      writes.push({ domain, body, method: req.method() });
      if (parts[2] === 'receipts') {
        const r = rows.rent.find((r) => r.id === parts[1]);
        r.amount_paid = body.amount;
        r.outstanding = Number(r.amount_due) - body.amount;
        r.rent_status = r.outstanding ? 'PARTIALLY_PAID' : 'PAID';
        return reply({ id: 'receipt', ...body }, 201);
      }
      if (req.method() === 'PATCH') {
        const r = rows[domain].find((r) => r.id === parts[1]);
        Object.assign(r, body);
        if (body.archived)
          rows[domain] = rows[domain].filter((x) => x.id !== r.id);
        return reply(r);
      }
      const r = {
        id:
          domain === 'tenancies'
            ? tenancyId
            : `${domain}-${rows[domain].length}`,
        version: 1,
        ...body,
        ...(tenant && domain === 'maintenance'
          ? { status: 'NEW', priority: 'NORMAL' }
          : {}),
        ...(domain === 'rent'
          ? { amount_paid: 0, outstanding: body.amount_due, rent_status: 'DUE' }
          : {}),
      };
      rows[domain].push(r);
      return reply(r, 201);
    }
    return reply([]);
  });
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill('fixture-password');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page).toHaveURL(/account/);
  return { rows, writes };
}
async function section(page, name) {
  await page
    .getByRole('navigation', { name: 'Property sections' })
    .getByRole('button', { name, exact: true })
    .click();
}
async function save(page) {
  await page.getByRole('button', { name: 'Save record', exact: true }).click();
  await expect(page.getByText('Record saved.')).toBeVisible();
}
async function noOverflow(page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
}
for (const width of [1440, 390]) {
  for (const agent of [false, true]) {
    test(`${agent ? 'agent' : 'owner'} occupied onboarding, rent and property operations at ${width}px`, async ({
      page,
    }) => {
      test.setTimeout(90000);
      await page.setViewportSize({ width, height: 900 });
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      const { writes } = await setup(page, { agent });
      await page.goto(`/owner/properties/${propertyId}`);
      await expect(
        page.getByRole('heading', { name: 'Property snapshot' }),
      ).toBeVisible();
      await expect(
        page.getByText('Vacant', { exact: true }).first(),
      ).toBeVisible();
      await section(page, 'Tenancy');
      await page
        .getByRole('button', { name: 'Add tenancy', exact: true })
        .click();
      await page.getByLabel('Tenant name').fill('Jamie Tenant');
      await page.getByLabel('Start date').fill('2026-01-01');
      await page.getByLabel('Monthly rent (MUR)').fill('18000');
      await page.getByLabel('Status', { exact: false }).selectOption('ACTIVE');
      await save(page);
      expect(
        writes.find((w) => w.domain === 'tenancies').body.application_id,
      ).toBeUndefined();
      await section(page, 'Rent ledger');
      await page
        .getByRole('button', { name: 'Add record', exact: true })
        .click();
      await page.getByLabel('Related tenancy').selectOption(tenancyId);
      await page.getByLabel('Rent month').fill(today.slice(0, 7) + '-01');
      await page.getByLabel('Due date').fill(today);
      await page.getByLabel('Amount due').fill('18000');
      await save(page);
      await page
        .getByRole('button', { name: 'Record offline receipt' })
        .click();
      await page.getByLabel('Received on').fill(today);
      await page.getByRole('button', { name: 'Save receipt' }).click();
      await expect(page.getByText('Paid', { exact: true })).toBeVisible();
      expect(writes.find((w) => w.body?.request_key)?.body.amount).toBe(18000);
      await section(page, 'Maintenance');
      await page.getByRole('button', { name: 'Add record' }).click();
      await page.getByLabel('Issue title').fill('Kitchen tap');
      await page
        .getByLabel('Description', { exact: false })
        .fill('Slow leak at the tap');
      await page
        .getByLabel('Owner notes (private)')
        .fill('Private contractor note');
      await save(page);
      await expect(page.getByText('Private contractor note')).toBeVisible();
      await section(page, 'Inspections');
      await page.getByRole('button', { name: 'Add record' }).click();
      await page.getByLabel('Inspection date *', { exact: true }).fill(today);
      await page.getByLabel('Inspection type').selectOption('ROUTINE');
      await page.getByLabel('Condition observations').fill('Windows checked');
      await save(page);
      expect(
        writes.find((w) => w.domain === 'inspections').body.checklist,
      ).toHaveLength(9);
      await section(page, 'Tasks');
      await page.getByRole('button', { name: 'Add record' }).click();
      await page.getByLabel('Task title').fill('Renew insurance');
      await page.getByLabel('Due date').fill(today);
      await save(page);
      await section(page, 'Income & expenses');
      await page.getByRole('button', { name: 'Add record' }).click();
      await page.getByLabel('Record type').selectOption('EXPENSE');
      await page.getByLabel('Category').selectOption('INSURANCE');
      await page.getByLabel('Amount (MUR)').fill('600');
      await page.getByLabel('Record date').fill(today);
      await save(page);
      await section(page, 'Documents');
      await page.getByRole('button', { name: 'Upload document' }).click();
      await page.getByLabel('File *', { exact: true }).setInputFiles({
        name: 'inspection.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4\nfixture\n%%EOF'),
      });
      await page.getByRole('button', { name: 'Upload file' }).click();
      await expect(
        page.getByRole('heading', { name: 'inspection.pdf' }),
      ).toBeVisible();
      await page.getByRole('button', { name: 'Archive document' }).click();
      await expect(
        page.getByRole('heading', { name: 'inspection.pdf' }),
      ).toHaveCount(0);
      await page.goto(`/owner/properties/${propertyId}`);
      await expect(
        page.getByText('Occupied', { exact: true }).first(),
      ).toBeVisible();
      await noOverflow(page);
      await page.screenshot({
        path: `test-results/operations-${agent ? 'agent' : 'owner'}-${width}.png`,
        fullPage: true,
      });
      await page.goto('/owner/reports');
      await expect(
        page.getByRole('heading', { name: 'Recorded financial summary' }),
      ).toBeVisible();
      await noOverflow(page);
      expect(errors).toEqual([]);
    });
  }
  test(`tenant maintenance and restricted controls at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const { writes } = await setup(page, { tenant: true, occupied: true });
    await page.goto('/tenant/home');
    await expect(
      page.getByRole('heading', { name: 'My home', exact: true }),
    ).toBeVisible();
    await page
      .getByRole('navigation', { name: 'My home sections' })
      .getByRole('button', { name: 'Maintenance' })
      .click();
    await page.getByRole('button', { name: 'Add record' }).click();
    await page.getByLabel('Issue title').fill('Bathroom leak');
    await page.getByLabel('Description').fill('Water beneath the sink');
    await expect(page.getByLabel('Owner notes')).toHaveCount(0);
    await expect(page.getByLabel('Priority')).toHaveCount(0);
    await save(page);
    expect(writes.find((w) => w.domain === 'maintenance').body).toMatchObject({
      tenancy_id: tenancyId,
      property_id: propertyId,
      title: 'Bathroom leak',
    });
    await expect(page.getByRole('button', { name: 'Edit record' })).toHaveCount(
      0,
    );
    await noOverflow(page);
    await page.screenshot({
      path: `test-results/operations-tenant-${width}.png`,
      fullPage: true,
    });
  });
}
