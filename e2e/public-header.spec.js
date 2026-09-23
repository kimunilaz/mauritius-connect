import { test, expect } from '@playwright/test';
const user = {
  id: '00000000-0000-4000-a000-000000000001',
  email: 'header@example.test',
  aud: 'authenticated',
  role: 'authenticated',
  app_metadata: {},
  user_metadata: {},
  created_at: '2026-01-01T00:00:00Z',
};
async function setup(page, role) {
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
  await page.route('**/api/v1/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    const data = path.endsWith('/auth/me')
      ? {
          ...user,
          first_name: 'Alex',
          last_name: 'Header',
          role,
          account_status: 'ACTIVE',
        }
      : path.endsWith('/unread-count')
        ? { unread_count: 2 }
        : [];
    return route.fulfill({
      json: { success: true, data, meta: { total: 0, page: 1, limit: 20 } },
    });
  });
  if (role) {
    await page.goto('/login');
    await page.getByLabel('Email', { exact: true }).fill(user.email);
    await page.getByLabel('Password', { exact: true }).fill('fixture-password');
    await page.getByRole('button', { name: 'Log in', exact: true }).click();
    await expect(page).toHaveURL(/account/);
  }
  await page.goto('/');
}
const names = {
  GUEST: ['Browse rentals', 'Manage properties', 'Log in', 'Create account'],
  TENANT: [
    'Browse rentals',
    'Saved homes',
    'Conversations',
    'Notifications',
    'Account',
  ],
  LANDLORD: [
    'Browse rentals',
    'Manage properties',
    'Conversations',
    'Notifications',
    'Account',
  ],
  AGENT: [
    'Browse rentals',
    'Manage properties',
    'Conversations',
    'Notifications',
    'Account',
  ],
  ADMIN: [
    'Browse rentals',
    'Listing review',
    'Users',
    'Reports',
    'Verifications',
    'Account',
  ],
};
const missing = {
  GUEST: ['Saved homes', 'Listing review', 'Account'],
  TENANT: ['Manage properties', 'Create account', 'Listing review'],
  LANDLORD: ['Create account', 'Saved homes', 'Listing review'],
  AGENT: ['Create account', 'Saved homes', 'Listing review'],
  ADMIN: [
    'Manage properties',
    'Saved homes',
    'Notifications',
    'Create account',
  ],
};
for (const role of Object.keys(names))
  test(`public responsive navigation ${role}`, async ({ page }) => {
    test.setTimeout(90000);
    await setup(page, role === 'GUEST' ? null : role);
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    for (const width of [320, 375, 390, 430, 768, 1024, 1200]) {
      await page.setViewportSize({ width, height: 820 });
      const header = page.locator('.public-header'),
        brand = header.getByRole('link', { name: 'Asserta home' }),
        menu = header.getByRole('button', { name: 'Open menu' }),
        nav = header.getByRole('navigation', { name: 'Main navigation' });
      await expect(brand).toBeVisible();
      if (width < 1152) {
        await expect(menu).toBeVisible();
        await expect(menu).toHaveAttribute('aria-expanded', 'false');
        await expect(nav).toBeHidden();
        const bounds = await Promise.all([
          header.boundingBox(),
          brand.boundingBox(),
          menu.boundingBox(),
        ]);
        expect(bounds[0].height).toBeLessThanOrEqual(80);
        expect(Math.abs(bounds[1].y - bounds[2].y)).toBeLessThan(18);
        await menu.click();
        await expect(
          header.getByRole('button', { name: 'Close menu' }),
        ).toHaveAttribute('aria-expanded', 'true');
        await expect(nav).toBeVisible();
        for (const name of names[role])
          await expect(
            nav.getByRole('link', { name, exact: name !== 'Notifications' }),
          ).toBeVisible();
        for (const name of missing[role])
          await expect(
            nav.getByRole('link', { name, exact: true }),
          ).toHaveCount(0);
        if (role === 'GUEST' && width === 390)
          await page.screenshot({
            path: 'test-results/header-menu-open-390.png',
            fullPage: false,
          });
        if (role === 'ADMIN' && width === 768)
          await page.screenshot({
            path: 'test-results/header-menu-admin-768.png',
            fullPage: false,
          });
        await page.keyboard.press('Escape');
        await expect(nav).toBeHidden();
        await expect(menu).toBeFocused();
      } else {
        await expect(menu).toBeHidden();
        await expect(nav).toBeVisible();
        for (const name of names[role])
          await expect(
            nav.getByRole('link', { name, exact: name !== 'Notifications' }),
          ).toBeVisible();
        expect((await header.boundingBox()).height).toBeLessThanOrEqual(100);
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
      if (role === 'GUEST' && [320, 768, 1024, 1200].includes(width))
        await page.screenshot({
          path: `test-results/header-${width}.png`,
          fullPage: false,
        });
    }
    expect(errors).toEqual([]);
  });
test('mobile menu follows routes and closes after navigation or outside click', async ({
  page,
}) => {
  await setup(page, null);
  await page.setViewportSize({ width: 390, height: 820 });
  const header = page.locator('.public-header'),
    menu = header.getByRole('button', { name: 'Open menu' }),
    nav = header.getByRole('navigation', { name: 'Main navigation' });
  await menu.click();
  await nav.getByRole('link', { name: 'Browse rentals' }).click();
  await expect(page).toHaveURL(/\/listings$/);
  await expect(nav).toBeHidden();
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await menu.click();
  await page.mouse.click(380, 800);
  await expect(nav).toBeHidden();
  await menu.click();
  await page.setViewportSize({ width: 1200, height: 820 });
  await expect(menu).toBeHidden();
  await page.setViewportSize({ width: 390, height: 820 });
  await expect(nav).toBeHidden();
});
