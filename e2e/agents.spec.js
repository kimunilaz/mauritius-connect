import { test, expect } from '@playwright/test';
import { ownerOperations } from './workspace-fixtures.js';
const ownerId = '32000000-0000-4000-8000-000000000032';
const propertyId = '00000000-0000-4000-a000-000000000002';
async function setup(page, role = 'AGENT') {
  const owner = {
    id: ownerId,
    name: 'Anita Ramdin',
    company: 'Ramdin Properties',
    email: 'anita@example.test',
    phone: '+230 5550 1234',
    address: 'Moka',
    notes: 'Monthly inspection updates requested.',
    version: 1,
    archived_at: null,
    property_count: 1,
    occupied: 1,
    vacant: 0,
    outstanding: 18000,
  };
  const writes = [],
    reads = [];
  const user = {
    id: '32000000-0000-4000-8000-000000000002',
    email: 'agent@example.test',
    aud: 'authenticated',
    role: 'authenticated',
    app_metadata: {},
    user_metadata: {},
    created_at: '2026-01-01T00:00:00Z',
  };
  await page.route('https://**.supabase.co/**', (route) => {
    const exp = Math.floor(Date.now() / 1000) + 3600,
      encode = (v) => Buffer.from(JSON.stringify(v)).toString('base64url');
    return route.fulfill({
      headers: { 'access-control-allow-origin': '*' },
      json: {
        access_token: `${encode({ alg: 'HS256' })}.${encode({ sub: user.id, exp, aud: 'authenticated' })}.fixture`,
        refresh_token: 'fixture',
        expires_in: 3600,
        expires_at: exp,
        token_type: 'bearer',
        user,
      },
    });
  });
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      path = url.pathname;
    reads.push(url.pathname + url.search);
    const reply = (data, status = 200) =>
      route.fulfill({
        status,
        json: {
          success: true,
          data,
          meta: {
            total: Array.isArray(data) ? data.length : 0,
            page: 1,
            limit: 20,
          },
        },
      });
    if (path.endsWith('/auth/me'))
      return reply({
        ...user,
        first_name: 'Alex',
        last_name: 'Manager',
        role,
        account_status: 'ACTIVE',
      });
    if (path.endsWith('/unread-count')) return reply({ unread_count: 0 });
    if (path.includes('/agent/owners')) {
      if (req.method() !== 'GET') {
        const body = req.postDataJSON();
        writes.push({ path, body });
        Object.assign(owner, body, { version: owner.version + 1 });
        if (path.endsWith('/archive'))
          owner.archived_at = new Date().toISOString();
        return reply(owner, req.method() === 'POST' ? 201 : 200);
      }
      if (path.endsWith('/owners'))
        return reply({
          items:
            url.searchParams.get('archived') === 'true'
              ? owner.archived_at
                ? [owner]
                : []
              : !owner.archived_at
                ? [owner]
                : [],
          total: 1,
        });
      return reply(owner);
    }
    if (path.endsWith('/summary')) {
      const d = ownerOperations();
      d.owners = 1;
      Object.assign(d.portfolio[0], {
        managed_owner_id: role === 'AGENT' ? ownerId : null,
        owner_name: role === 'AGENT' ? owner.name : null,
      });
      return reply(d);
    }
    if (path.endsWith('/properties') && req.method() === 'POST') {
      writes.push({ path, body: req.postDataJSON() });
      return reply({ id: propertyId }, 201);
    }
    if (path.endsWith(`/properties/${propertyId}`))
      return reply({
        id: propertyId,
        property_type: 'HOUSE',
        district: 'Moka',
        locality: 'Moka',
        bedrooms: 2,
        bathrooms: 1,
        parking_spaces: 0,
        furnished: false,
        verification_status: 'UNVERIFIED',
      });
    if (path.endsWith('/leasing'))
      return reply({ listings: [], applications: [], viewings: [] });
    return reply([]);
  });
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill('fixture-password');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page).toHaveURL(/account/);
  return { writes, reads };
}
for (const width of [1440, 390])
  test(`agent owners and shared property workspace at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 950 });
    const { writes, reads } = await setup(page);
    await expect(
      page.getByRole('heading', { name: 'Portfolio overview' }),
    ).toBeVisible();
    await expect(page.getByText('1 active owners')).toBeVisible();
    await page.goto('/agent/owners');
    await expect(
      page.getByRole('heading', { name: 'Owners', exact: true }),
    ).toBeVisible();
    await page.getByRole('link', { name: 'Anita Ramdin', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Anita Ramdin' }),
    ).toBeVisible();
    await page.screenshot({
      path: `test-results/task032-owner-${width}.png`,
      fullPage: true,
    });
    await page.getByRole('button', { name: 'Edit owner' }).click();
    await page
      .getByLabel('Owner name', { exact: true })
      .fill('Anita Ramdin Updated');
    await page.getByRole('button', { name: 'Save owner', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Anita Ramdin Updated' }),
    ).toBeVisible();
    expect(writes.at(-1).body.version).toBe(1);
    await page.getByRole('link', { name: 'Add property', exact: true }).click();
    await expect(
      page.getByLabel('Property owner', { exact: true }),
    ).toHaveValue(ownerId);
    await page.getByLabel('District *', { exact: true }).fill('Moka');
    await page.getByLabel('Locality *', { exact: true }).fill('Moka');
    await page.getByLabel('Bedrooms *', { exact: true }).fill('2');
    await page.getByLabel('Bathrooms *', { exact: true }).fill('1');
    await page
      .getByRole('button', { name: 'Create property', exact: true })
      .click();
    await expect
      .poll(() =>
        writes.some(
          (w) =>
            w.path.endsWith('/properties') &&
            w.body.managed_owner_id === ownerId,
        ),
      )
      .toBe(true);
    await page.goto(`/owner/properties/${propertyId}`);
    await expect(
      page.getByRole('link', { name: 'Anita Ramdin Updated', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('navigation', { name: 'Property sections' }),
    ).toContainText('Rent ledger');
    await page.screenshot({
      path: `test-results/task032-property-${width}.png`,
      fullPage: true,
    });
    await page.goto(`/owner/finances?owner_id=${ownerId}`);
    await expect
      .poll(() =>
        reads.some(
          (p) =>
            p.includes('/operations/finances?') &&
            p.includes(`owner_id=${ownerId}`),
        ),
      )
      .toBe(true);
    await page.goto(`/owner/reports?owner_id=${ownerId}`);
    await expect(
      page.getByRole('heading', { name: 'Property & portfolio reports' }),
    ).toBeVisible();
    expect(
      reads.some(
        (p) => p.includes('/summary?') && p.includes(`owner_id=${ownerId}`),
      ),
    ).toBe(true);
    await page.goto(`/agent/owners/${ownerId}`);
    await page
      .getByRole('button', { name: 'Archive owner', exact: true })
      .click();
    await page.getByRole('button', { name: 'Confirm archive' }).click();
    await expect(page.getByText('PROPERTY OWNER / ARCHIVED')).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Add property', exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('heading', { name: 'Managed properties' }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
  });
test('landlord retains self-owned flow without client selector', async ({
  page,
}) => {
  await setup(page, 'LANDLORD');
  await expect(
    page
      .getByRole('navigation', { name: 'Owner navigation' })
      .getByRole('link', { name: 'Owners', exact: true }),
  ).toHaveCount(0);
  await page.goto('/landlord/properties/new');
  await expect(
    page.getByRole('heading', { name: 'Add a property' }),
  ).toBeVisible();
  await expect(page.getByLabel('Property owner', { exact: true })).toHaveCount(
    0,
  );
  await page.goto('/agent/owners');
  await expect(
    page.getByRole('heading', { name: 'Owners', exact: true }),
  ).toHaveCount(0);
});
