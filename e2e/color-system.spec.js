import { expect, test } from '@playwright/test';
import { operationalOverview, ownerOperations } from './workspace-fixtures.js';

// Local presentation fixtures only. No hosted identities, data or uploads are touched.
const id = (n) => `00000000-0000-4000-a000-${String(n).padStart(12, '0')}`;
const date = '2026-09-10T10:00:00Z';
const person = {
  first_name: 'Alex',
  last_name: 'Morgan',
  profile_photo_url: null,
};
const property = {
  id: id(2),
  locality: 'Moka',
  district: 'Moka',
  bedrooms: 2,
  bathrooms: 1,
  property_type: 'APARTMENT',
  furnished: true,
  parking_spaces: 1,
  verification_status: 'VERIFIED',
  property_information_verified: true,
  archived_at: null,
  images: [],
};
const listing = {
  id: id(3),
  property_id: property.id,
  title: 'A bright apartment in Moka',
  description: 'A comfortable rental with space to work and relax.',
  monthly_rent: 28000,
  deposit_amount: 28000,
  status: 'ACTIVE',
  available_from: '2026-10-01',
  minimum_lease_months: 12,
  maximum_occupants: 3,
  pets_allowed: false,
  property,
  images: [],
  cover_image: null,
  cover_image_url: null,
  landlord_verified: true,
  property_authority_verified: true,
};
const application = {
  id: id(4),
  application_id: id(4),
  listing_id: listing.id,
  status: 'SUBMITTED',
  availability: 'AVAILABLE',
  listing,
  tenant: person,
  submitted_at: date,
  updated_at: date,
  created_at: date,
  move_in_date: '2026-10-01',
  requested_lease_duration_months: 12,
  number_of_occupants: 2,
  introductory_message: 'Looking forward to viewing this home.',
  answers: [],
  history: [],
};
const conversation = {
  id: id(5),
  counterparty: person,
  created_at: date,
  updated_at: date,
  listing_context: {
    listing_id: listing.id,
    listing,
    availability: 'AVAILABLE',
  },
  unread_count: 1,
  last_message: { body: 'The viewing is confirmed.', created_at: date },
};
const notification = {
  id: id(6),
  title: 'Viewing confirmed',
  message: 'Your viewing time has been confirmed.',
  created_at: date,
  read_at: null,
  navigation_target: null,
};
const verification = {
  id: id(7),
  type: 'LANDLORD_IDENTITY',
  status: 'PENDING',
};
const report = {
  id: id(8),
  target_type: 'LISTING',
  reason: 'MISLEADING_INFORMATION',
  details: 'Please review the listing information.',
  status: 'OPEN',
  reporter: person,
  target: { type: 'LISTING', listing },
};

async function fixtures(page, role = 'TENANT') {
  const failures = [];
  page.on('pageerror', (error) => failures.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') failures.push(message.text());
  });
  const user = {
    id: id(1),
    email: 'palette@example.test',
    aud: 'authenticated',
    role: 'authenticated',
    app_metadata: {},
    user_metadata: {},
    created_at: date,
  };
  await page.route('https://**.supabase.co/**', async (route) => {
    const headers = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
    };
    if (route.request().method() === 'OPTIONS')
      return route.fulfill({ status: 204, headers });
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const encode = (value) =>
      Buffer.from(JSON.stringify(value)).toString('base64url');
    return route.fulfill({
      headers,
      json: {
        access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: user.id, exp, aud: 'authenticated' })}.fixture`,
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: exp,
        refresh_token: 'palette-fixture-refresh',
        user,
      },
    });
  });
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace('/api/v1', '');
    const meta = { page: 1, limit: 20, total: 1, total_pages: 1, listing };
    const send = (data, extra = {}) =>
      route.fulfill({ json: { success: true, data, meta, ...extra } });
    if (path === '/landlord/operations/summary') return send(ownerOperations());
    if (path === '/auth/me')
      return send({ ...user, ...person, role, account_status: 'ACTIVE' });
    if (path === '/overview/landlord' || path === '/overview/admin')
      return send(operationalOverview(role));
    if (path === '/landlord/verifications') return send([verification]);
    if (path.endsWith('/application-questions'))
      return send([], { meta: { ...meta, locked: true, editable: false } });
    if (path === '/landlord/profile')
      return send({ ...person, verification_status: 'VERIFIED', phone: '' });
    if (path === '/landlord/properties') return send([property]);
    if (path === `/properties/${property.id}`) return send(property);
    if (path === '/listings' || path === '/landlord/listings') {
      const status = url.searchParams.get('status');
      return send(status && status !== 'ACTIVE' ? [] : [listing]);
    }
    if (
      path === `/listings/${listing.id}` ||
      path === `/landlord/listings/${listing.id}`
    )
      return send(listing);
    if (path.includes('/saved-listings/') && path.endsWith('/status'))
      return send({ saved: false });
    if (path === '/tenant/applications')
      return send(
        ['SUBMITTED', 'ACCEPTED', 'REJECTED'].map((status, i) => ({
          ...application,
          id: id(40 + i),
          status,
        })),
      );
    if (path === `/landlord/listings/${listing.id}/applications`)
      return send(
        ['SUBMITTED', 'ACCEPTED', 'REJECTED'].map((status, i) => ({
          ...application,
          application_id: id(40 + i),
          status,
        })),
      );
    if (
      path === `/applications/${application.id}` ||
      path === `/landlord/applications/${application.id}`
    )
      return send(application);
    if (path.endsWith('/viewings'))
      return send([
        {
          id: id(9),
          status: 'COMPLETED',
          start_time: date,
          end_time: null,
          notes: 'Viewing completed.',
        },
      ]);
    if (path === '/conversations') return send([conversation]);
    if (path === `/conversations/${conversation.id}`) return send(conversation);
    if (path.endsWith('/messages')) {
      if (route.request().method() === 'POST')
        return send({
          id: id(23),
          body: route.request().postDataJSON().body,
          sender: { is_me: true },
          created_at: date,
        });
      return send([
        {
          id: id(21),
          body: 'Is the viewing still available?',
          sender: { is_me: true },
          created_at: date,
        },
        {
          id: id(22),
          body: 'Yes, the viewing is confirmed.',
          sender: { is_me: false },
          created_at: date,
        },
      ]);
    }
    if (path.endsWith('/read') || path.endsWith('/read-all')) return send({});
    if (path === '/notifications')
      return send([
        notification,
        {
          ...notification,
          id: id(61),
          title: 'Application received',
          read_at: date,
        },
      ]);
    if (path === '/notifications/unread-count')
      return send({ unread_count: 1 });
    if (path === '/admin/listings')
      return send([{ ...listing, status: 'PENDING_REVIEW' }]);
    if (path === `/admin/listings/${listing.id}`)
      return send({ ...listing, status: 'PENDING_REVIEW' });
    if (path === '/admin/users')
      return send([
        { ...person, id: id(10), role: 'LANDLORD', account_status: 'ACTIVE' },
      ]);
    if (path === `/admin/users/${id(10)}`)
      return send({
        ...person,
        id: id(10),
        role: 'LANDLORD',
        account_status: 'ACTIVE',
      });
    if (path === '/admin/reports') return send([report]);
    if (path === `/admin/reports/${report.id}`) return send(report);
    if (path === '/admin/verifications') return send([verification]);
    if (path === `/admin/verifications/${verification.id}`)
      return send(verification);
    failures.push(`Unmocked request: ${route.request().method()} ${path}`);
    return route.fulfill({
      status: 404,
      json: {
        success: false,
        error: { code: 'FIXTURE_MISSING', message: path },
      },
    });
  });
  return failures;
}

async function login(page) {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill('palette@example.test');
  await page
    .getByLabel('Password', { exact: true })
    .fill('palette-fixture-password');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
}

async function capture(page, name, route) {
  await page.goto(route);
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  await expect(
    page.getByText(/^(Loading|Checking) .*\.\.\.$/).first(),
  ).not.toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/task027/${name}.png`,
    fullPage: true,
  });
}

const views = {
  LANDLORD: [
    ['dashboard', '/account'],
    ['properties', '/landlord/properties'],
    ['property', `/landlord/properties/${property.id}`],
    ['property-form', '/landlord/properties/new'],
    ['listings', '/landlord/listings'],
    ['listing', `/landlord/listings/${listing.id}`],
    ['pipeline', `/landlord/listings/${listing.id}/applications`],
    ['applicant', `/landlord/applications/${application.id}`],
    ['verification', '/landlord/profile'],
  ],
  TENANT: [
    ['applications', '/tenant/applications'],
    ['application', `/tenant/applications/${application.id}`],
    ['conversations', '/conversations'],
    ['messages', `/conversations/${conversation.id}`],
    ['notifications', '/notifications'],
  ],
  ADMIN: [
    ['overview', '/account'],
    ['listings', '/admin/listings'],
    ['listing', `/admin/listings/${listing.id}`],
    ['users', '/admin/users'],
    ['user', `/admin/users/${id(10)}`],
    ['reports', '/admin/reports'],
    ['report', `/admin/reports/${report.id}`],
    ['verifications', '/admin/verifications'],
    ['verification', `/admin/verifications/${verification.id}`],
  ],
};

for (const width of [390, 1440]) {
  for (const [role, routes] of Object.entries(views)) {
    test(`${role} color smoke at ${width}px`, async ({ page }) => {
      test.setTimeout(90_000);
      await page.setViewportSize({ width, height: 900 });
      const failures = await fixtures(page, role);
      await login(page);
      for (const [name, route] of routes)
        await capture(page, `${role.toLowerCase()}-${name}-${width}`, route);
      expect(failures).toEqual([]);
    });
  }
  test(`public listings, authentication and report form at ${width}px`, async ({
    page,
  }) => {
    const failures = await fixtures(page);
    await page.setViewportSize({ width, height: 900 });
    for (const [name, route] of [
      ['home', '/'],
      ['search', '/listings'],
      ['detail', `/listings/${listing.id}`],
      ['login', '/login'],
      ['register', '/register'],
    ]) {
      await capture(page, `public-${name}-${width}`, route);
    }
    await login(page);
    await page.goto(`/listings/${listing.id}`);
    await page
      .getByRole('button', { name: 'Report listing', exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: 'Submit report', exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: `test-results/task027/public-report-${width}.png`,
      fullPage: true,
    });
    expect(failures).toEqual([]);
  });
}

test('blue interaction states, semantic outcomes and message send remain distinct', async ({
  page,
}) => {
  const failures = await fixtures(page);
  await page.goto('/login');
  const primary = page.getByRole('button', { name: 'Log in', exact: true });
  await expect(primary).toHaveCSS('background-color', 'rgb(10, 102, 194)');
  await primary.hover();
  await expect(primary).toHaveCSS('background-color', 'rgb(0, 65, 130)');
  await page.mouse.down();
  await expect(primary).toHaveCSS('background-color', 'rgb(0, 58, 112)');
  await page.mouse.move(0, 0);
  await page.mouse.up();
  await page.getByLabel('Email', { exact: true }).focus();
  await expect(page.getByLabel('Email', { exact: true })).toHaveCSS(
    'outline-style',
    'solid',
  );
  await expect(page.getByLabel('Email', { exact: true })).toHaveCSS(
    'outline-color',
    'rgb(10, 102, 194)',
  );
  await login(page);
  await page.goto('/tenant/applications');
  await expect(page.locator('.status-label[data-status="ACCEPTED"]')).toHaveCSS(
    'color',
    'rgb(21, 122, 85)',
  );
  await expect(page.locator('.status-label[data-status="REJECTED"]')).toHaveCSS(
    'color',
    'rgb(180, 35, 24)',
  );
  await expect(
    page.locator('.status-label[data-status="SUBMITTED"]'),
  ).toHaveCSS('color', 'rgb(10, 102, 194)');
  await page.goto('/notifications');
  await expect(
    page.getByRole('button', { name: 'Unread: Viewing confirmed' }),
  ).toHaveCSS('border-left-color', 'rgb(10, 102, 194)');
  await page.getByRole('button', { name: 'Mark all as read' }).click();
  await expect(
    page.getByRole('button', { name: 'Read: Viewing confirmed' }),
  ).toBeVisible();
  await page.goto(`/conversations/${conversation.id}`);
  await expect(page.locator('.message-own')).toHaveCSS(
    'background-color',
    'rgb(232, 243, 255)',
  );
  await page
    .getByLabel('Message', { exact: true })
    .fill('Thank you. See you then.');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(
    page.getByText('Thank you. See you then.', { exact: true }),
  ).toBeVisible();
  expect(failures).toEqual([]);
});
