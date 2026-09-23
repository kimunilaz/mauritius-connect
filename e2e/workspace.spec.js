import { expect, test } from '@playwright/test';
import { operationalOverview, ownerOperations } from './workspace-fixtures.js';

async function assertBrand(page) {
  await expect(page).toHaveTitle('Asserta — Rental tools for property owners');
  const visibleBrand = page.locator('a.asserta-brand:visible').first();
  await expect(visibleBrand).toHaveAccessibleName('Asserta home');
  await expect(visibleBrand).toHaveAttribute('href', '/');
  await expect
    .poll(() =>
      visibleBrand
        .locator('img')
        .evaluate((img) => img.complete && img.naturalWidth > 0),
    )
    .toBe(true);
  await expect(page.locator('body')).not.toContainText(
    /Mauritius[\s-]*Connect/i,
  );
}

const user = {
  id: '00000000-0000-4000-a000-000000000001',
  email: 'workspace@example.test',
  aud: 'authenticated',
  role: 'authenticated',
  app_metadata: {},
  user_metadata: {},
  created_at: '2026-01-01T00:00:00Z',
};
const property = {
  id: '00000000-0000-4000-a000-000000000002',
  locality: 'Moka',
  district: 'Moka',
  bedrooms: 3,
  bathrooms: 2,
  property_type: 'APARTMENT',
  furnished: true,
  archived_at: null,
};
const listing = {
  id: '00000000-0000-4000-a000-000000000003',
  property_id: property.id,
  title: 'A bright apartment in Moka',
  monthly_rent: 28000,
  status: 'ACTIVE',
  available_from: '2026-10-01',
  property,
  cover_image: null,
};

async function fixtures(
  page,
  { empty = false, unavailable = false, tenant = false, admin = false } = {},
) {
  await page.route('https://**.supabase.co/**', async (route) => {
    if (route.request().method() === 'OPTIONS')
      return route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-headers': '*',
        },
      });
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const encode = (value) =>
      Buffer.from(JSON.stringify(value)).toString('base64url');
    const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: user.id, exp, aud: 'authenticated' })}.fixture`;
    await route.fulfill({
      json: {
        access_token: token,
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: exp,
        refresh_token: 'workspace-fixture-refresh',
        user,
      },
      headers: { 'access-control-allow-origin': '*' },
    });
  });
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/operations/summary'))
      return route.fulfill({
        status: unavailable ? 503 : 200,
        json: unavailable
          ? { success: false, error: { message: 'Operations unavailable' } }
          : { success: true, data: ownerOperations(empty) },
      });
    if (url.pathname.endsWith('/auth/me'))
      return route.fulfill({
        json: {
          success: true,
          data: {
            ...user,
            first_name: 'Alex',
            last_name: 'Morgan',
            role: admin ? 'ADMIN' : tenant ? 'TENANT' : 'LANDLORD',
            account_status: 'ACTIVE',
          },
        },
      });
    if (tenant && !unavailable && !url.pathname.endsWith('/auth/me')) {
      let data = [];
      if (url.pathname.endsWith('/unread-count'))
        data = { unread_count: empty ? 0 : 3 };
      else if (!empty && url.pathname.endsWith('/saved-listings'))
        data = [
          {
            id: 'saved',
            listing_id: listing.id,
            availability: 'AVAILABLE',
            listing,
          },
          {
            id: 'private',
            listing_id: 'private',
            availability: 'UNAVAILABLE',
            listing: { title: 'PRIVATE LISTING' },
          },
        ];
      else if (!empty && url.pathname.endsWith('/applications'))
        data = [
          {
            id: 'application',
            status: 'VIEWING_INVITED',
            availability: 'AVAILABLE',
            listing,
            updated_at: '2026-09-20T10:00:00Z',
          },
        ];
      else if (!empty && url.pathname.endsWith('/conversations'))
        data = [
          {
            id: 'conversation',
            unread_count: 2,
            last_message: { content: 'PRIVATE MESSAGE' },
          },
        ];
      return route.fulfill({
        json: {
          success: true,
          data,
          meta: {
            total: Array.isArray(data) ? data.length : 0,
            page: 1,
            total_pages: empty ? 0 : 1,
          },
        },
      });
    }
    if (unavailable)
      return route.fulfill({
        status: 503,
        json: {
          success: false,
          error: { code: 'UNAVAILABLE', message: 'Please try again.' },
        },
      });
    if (url.pathname.includes('/overview/'))
      return route.fulfill({
        json: {
          success: true,
          data: operationalOverview(admin ? 'ADMIN' : 'LANDLORD', empty),
        },
      });
    if (url.pathname.endsWith('/conversations'))
      return route.fulfill({
        json: {
          success: true,
          data: empty
            ? []
            : [
                {
                  id: 'conversation',
                  unread_count: 2,
                  last_message: { content: 'PRIVATE MESSAGE' },
                },
              ],
          meta: { total: empty ? 0 : 1, page: 1, total_pages: empty ? 0 : 1 },
        },
      });
    if (url.pathname.endsWith('/verifications'))
      return route.fulfill({
        json: {
          success: true,
          data: empty
            ? []
            : [
                {
                  id: 'verification',
                  type: 'LANDLORD_IDENTITY',
                  status: 'PENDING',
                },
              ],
          meta: { total: empty ? 0 : 1, page: 1 },
        },
      });
    if (url.pathname.endsWith('/applications'))
      return route.fulfill({
        json: {
          success: true,
          data: [],
          meta: { total: 0, page: 1, total_pages: 0, listing },
        },
      });
    const isProperties = url.pathname.endsWith('/properties');
    const status = url.searchParams.get('status');
    const items = empty
      ? []
      : isProperties
        ? [property]
        : [
            {
              ...listing,
              id: status ? listing.id + '-' + status : listing.id,
              status: status || 'ACTIVE',
            },
          ];
    const total = empty ? 0 : isProperties ? 3 : status === 'ACTIVE' ? 1 : 1;
    await route.fulfill({
      json: {
        success: true,
        data: items,
        meta: { total, page: 1, total_pages: total ? 1 : 0 },
      },
    });
  });
}

async function login(page) {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(user.email);
  await page
    .getByLabel('Password', { exact: true })
    .fill('workspace-fixture-password');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(
    page.getByRole('heading', {
      name: /Welcome back, Alex|Portfolio overview/,
    }),
  ).toBeVisible();
}

async function noOverflow(page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
}

test('desktop landlord overview links to filtered listings and applicants', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const failures = [];
  page.on('pageerror', (error) => failures.push(error.message));
  await fixtures(page);
  await login(page);
  await expect(
    page.getByRole('heading', { name: 'Portfolio overview' }),
  ).toBeVisible();
  await expect(page.getByText('Rent overdue')).toBeVisible();
  await noOverflow(page);
  await page.screenshot({
    path: 'test-results/workspace-desktop.png',
    fullPage: true,
  });
  await page
    .getByRole('navigation', { name: 'Owner navigation' })
    .getByRole('link', { name: 'Listings' })
    .click();
  await page.getByLabel('Status', { exact: true }).selectOption('ACTIVE');
  await expect(page.getByLabel('Status', { exact: true })).toHaveValue(
    'ACTIVE',
  );
  await page.getByRole('link', { name: /View applicants/ }).click();
  await expect(
    page.getByRole('navigation', { name: 'Rental journey' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Back to listing' }),
  ).toBeVisible();
  expect(failures).toEqual([]);
});

test('mobile navigation, setup journey and logout work at narrow widths', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fixtures(page, { empty: true });
  await login(page);
  await expect(page.getByText(/Add your first property/)).toBeVisible();
  await noOverflow(page);
  await page.screenshot({
    path: 'test-results/workspace-mobile.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Close menu', exact: true }),
  ).toBeInViewport();
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('button', { name: 'Menu', exact: true }),
  ).toBeFocused();
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page
    .getByRole('navigation', { name: 'Owner navigation' })
    .getByRole('link', { name: 'Properties', exact: true })
    .click();
  await expect(page.getByRole('heading', { name: 'Properties' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Menu', exact: true }),
  ).toHaveAttribute('aria-expanded', 'false');
  await page
    .getByRole('link', { name: 'Add property', exact: true })
    .first()
    .click();
  await expect(page.getByText(/vacant or already occupied/)).toBeVisible();
  await page.setViewportSize({ width: 320, height: 740 });
  await noOverflow(page);
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Log in', exact: true }),
  ).toBeVisible();
  await noOverflow(page);
});

test('failed overview offers recovery without invented totals', async ({
  page,
}) => {
  await fixtures(page, { unavailable: true });
  await login(page);
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Operations unavailable');
});

test('public homepage and login fit mobile and desktop', async ({ page }) => {
  await fixtures(page);
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await assertBrand(page);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Manage your properties with clarity.',
    );
    await noOverflow(page);
    await page.screenshot({
      path: `test-results/asserta-home-${width}.png`,
      fullPage: true,
    });
    await page.goto('/login');
    await assertBrand(page);
    await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
    await noOverflow(page);
    if (width === 1440)
      await page.screenshot({
        path: 'test-results/workspace-login.png',
        fullPage: true,
      });
  }
});

test('Asserta assets render at favicon and header sizes', async ({ page }) => {
  await fixtures(page);
  await page.goto('/');
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute(
    'href',
    '/brand/favicon.svg',
  );
  const origin = new URL(page.url()).origin;
  await page.setContent(
    `<main style="font-family:Arial;padding:32px"><h1>Asserta identity size review</h1>${[16, 24, 32, 48].map((size) => `<p>Favicon ${size}px <img src="${origin}/brand/favicon.svg" width="${size}" height="${size}" alt="Asserta favicon ${size}" /></p>`).join('')}<p><img src="${origin}/brand/wordmark.svg" width="188" height="48" alt="Asserta on light" /></p><p style="background:#004182;padding:24px"><img src="${origin}/brand/wordmark-light.svg" width="188" height="48" alt="Asserta on dark" /></p></main>`,
  );
  for (const img of await page.getByRole('img').all())
    await expect
      .poll(() =>
        img.evaluate((node) => node.complete && node.naturalWidth > 0),
      )
      .toBe(true);
  await page.screenshot({
    path: 'test-results/asserta-identity.png',
    fullPage: true,
  });
});

test('public Asserta owner and tenant entry points preserve existing routes', async ({
  page,
}) => {
  await fixtures(page);
  await page.goto('/');
  await page
    .getByRole('link', { name: 'Manage your properties', exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/register$/);
  await assertBrand(page);
  await expect(
    page.getByRole('heading', { name: 'Create your account' }),
  ).toBeVisible();
  await page.goto('/');
  await page
    .getByRole('link', { name: 'Browse rentals', exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/listings$/);
  await assertBrand(page);
});

for (const width of [1440, 1024, 390]) {
  for (const empty of [false, true]) {
    test(
      'tenant ' + (empty ? 'new' : 'returning') + ' at ' + width,
      async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await fixtures(page, { tenant: true, empty });
        await page.goto('/login');
        await page.getByLabel('Email', { exact: true }).fill(user.email);
        await page
          .getByLabel('Password', { exact: true })
          .fill('workspace-fixture-password');
        await page.getByRole('button', { name: 'Log in', exact: true }).click();
        await expect(
          page.getByRole('heading', {
            name: empty ? 'Welcome, Alex' : 'Welcome back, Alex',
            exact: true,
          }),
        ).toBeVisible();
        const main = page.getByRole('main');
        await assertBrand(page);
        if (empty) {
          await expect(
            main.getByRole('link', { name: 'Browse rentals' }),
          ).toBeVisible();
          await expect(
            main.getByRole('region', { name: 'Rental activity' }),
          ).toHaveCount(0);
        } else {
          await expect(
            main.getByRole('region', { name: 'Recently saved' }),
          ).toBeVisible();
          await expect(main.getByText('Viewing proposed')).toBeVisible();
          await expect(
            main.getByRole('link', {
              name: 'Messages 2 unread in the 3 most recent conversations',
            }),
          ).toBeVisible();
          await expect(
            main.getByRole('link', {
              name: 'Notifications 3 unread notifications',
            }),
          ).toBeVisible();
          await expect(main.locator('.primary-link-button')).toHaveCount(0);
          await expect(main.getByText('PRIVATE LISTING')).toHaveCount(0);
          await expect(main.getByText('PRIVATE MESSAGE')).toHaveCount(0);
        }
        await noOverflow(page);
        await page.screenshot({
          path:
            'test-results/tenant-' +
            (empty ? 'new-' : 'returning-') +
            width +
            '.png',
          fullPage: true,
        });
        if (width < 801)
          await page.getByRole('button', { name: 'Menu', exact: true }).click();
        const nav = page.getByRole('navigation', { name: 'Tenant navigation' });
        for (const label of [
          'Overview',
          'Browse rentals',
          'Saved homes',
          'Applications',
          'Messages',
          'Notifications',
          'My profile',
        ])
          await expect(
            nav.getByRole('link', { name: label, exact: true }),
          ).toBeVisible();
        await nav
          .getByRole('link', { name: 'Saved homes', exact: true })
          .click();
        await expect(
          page.getByRole('heading', { name: 'Saved homes', exact: true }),
        ).toBeVisible();
        if (width < 801)
          await expect(
            page.getByRole('button', { name: 'Menu', exact: true }),
          ).toHaveAttribute('aria-expanded', 'false');
        expect(errors).toEqual([]);
      },
    );
  }
}
for (const role of ['LANDLORD', 'ADMIN']) {
  for (const width of [1440, 768, 390]) {
    for (const empty of [false, true]) {
      test(
        role + (empty ? ' empty' : ' active') + ' overview at ' + width,
        async ({ page }) => {
          await page.setViewportSize({ width, height: 900 });
          const errors = [];
          const requests = [];
          page.on('pageerror', (error) => errors.push(error.message));
          page.on('request', (request) => {
            if (request.url().includes('/api/v1/'))
              requests.push(request.url());
          });
          await fixtures(page, { admin: role === 'ADMIN', empty });
          await login(page);
          const main = page.getByRole('main');
          await assertBrand(page);
          if (empty)
            await expect(
              main.getByText(
                role === 'ADMIN'
                  ? 'Nothing currently needs review.'
                  : /Add your first property/,
              ),
            ).toBeVisible();
          else {
            await expect(
              main.getByText(
                role === 'ADMIN'
                  ? 'Apartment awaiting approval'
                  : 'Rent overdue',
              ),
            ).toBeVisible();
            await expect(
              main.getByText(
                role === 'ADMIN' ? 'Sam Example' : 'Routine inspection',
              ),
            ).toBeVisible();
            await expect(main.locator('.primary-link-button')).toHaveCount(0);
          }
          await expect(
            main.getByText(
              /PRIVATE MESSAGE|PRIVATE EVIDENCE|Your personal workspace|next chapter/,
            ),
          ).toHaveCount(0);
          await expect(
            main.getByText('PENDING_REVIEW', { exact: true }),
          ).toHaveCount(0);
          await expect(
            main.getByText('UNDER_REVIEW', { exact: true }),
          ).toHaveCount(0);
          await noOverflow(page);
          await page.screenshot({
            path:
              'test-results/' +
              role.toLowerCase() +
              '-' +
              (empty ? 'empty-' : 'active-') +
              width +
              '.png',
            fullPage: true,
          });
          if (width < 801) {
            await page
              .getByRole('button', { name: 'Menu', exact: true })
              .click();
            await page.keyboard.press('Escape');
            await expect(
              page.getByRole('button', { name: 'Menu', exact: true }),
            ).toBeFocused();
            await page
              .getByRole('button', { name: 'Menu', exact: true })
              .click();
          }
          const nav = page.getByRole('navigation', {
            name: role === 'ADMIN' ? 'Admin navigation' : 'Owner navigation',
          });
          await expect(
            nav.getByRole('link', { name: 'Overview', exact: true }),
          ).toHaveAttribute('aria-current', 'page');
          if (role === 'ADMIN') {
            expect(
              requests.some((url) => /conversations|evidence/.test(url)),
            ).toBe(false);
            await nav
              .getByRole('link', { name: 'Listings', exact: true })
              .click();
            await expect(
              page.getByRole('heading', { name: 'Listing review' }),
            ).toBeVisible();
          } else {
            expect(requests.length).toBeLessThan(12);
            await nav
              .getByRole('link', { name: 'Verification', exact: true })
              .click();
            await expect(
              page.getByRole('heading', { name: 'Verification', exact: true }),
            ).toBeVisible();
            if (!empty)
              await expect(page.getByText('Landlord identity')).toBeVisible();
          }
          if (width < 801)
            await expect(
              page.getByRole('button', { name: 'Menu', exact: true }),
            ).toHaveAttribute('aria-expanded', 'false');
          await noOverflow(page);
          expect(errors).toEqual([]);
        },
      );
    }
  }
}
