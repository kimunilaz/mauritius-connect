import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('http://localhost:5173');
  const homes = page.getByRole('region', {
    name: 'Homes available now',
    exact: true,
  });
  await homes
    .locator('.public-listing-card')
    .first()
    .waitFor({ timeout: 30000 });
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll('.marketplace-grid img')].every(
        (img) => img.complete && img.naturalWidth > 0,
      ),
    { timeout: 30000 },
  );
  assert.equal(await homes.locator('.public-listing-card').count(), 8);
  const first = await homes
    .locator('.public-listing-card')
    .first()
    .boundingBox();
  assert.ok(first.y < 500, `Inventory begins at ${first.y}px`);
  await page.screenshot({
    path: 'test-results/marketplace-desktop.png',
    fullPage: true,
  });
  await page.getByLabel('Location', { exact: true }).fill('Moka');
  await page.getByLabel('Maximum rent').fill('24000');
  await page.getByRole('button', { name: 'Search rentals' }).click();
  await page.waitForURL('**/listings?locality=Moka&max_rent=24000');
  await page.locator('.public-listing-card').first().waitFor();
  await page.goto('http://localhost:5173');
  await homes.locator('.public-listing-card').first().waitFor();
  await homes
    .getByRole('link', { name: /^View / })
    .first()
    .click();
  await page.waitForURL(/\/listings\/[0-9a-f-]+$/);
  await page.locator('.public-detail-gallery img').first().waitFor();
  await page.screenshot({
    path: 'test-results/marketplace-detail.png',
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://localhost:5173');
  await homes.locator('.public-listing-card').first().waitFor();
  await page.waitForFunction(() => {
    const img = document.querySelector('.marketplace-grid img');
    return img?.complete && img.naturalWidth > 0;
  });
  const mobile = await homes
    .locator('.public-listing-card')
    .first()
    .boundingBox();
  await page.screenshot({
    path: 'test-results/marketplace-mobile.png',
    fullPage: false,
  });
  assert.ok(mobile.y < 560, `Mobile inventory begins at ${mobile.y}px`);
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    'No horizontal overflow',
  );
  await page.screenshot({
    path: 'test-results/marketplace-mobile.png',
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify(
      {
        desktopInventoryY: first.y,
        mobileInventoryY: mobile.y,
        desktopCards: 8,
        search: 'passed',
        detail: 'passed',
        pageErrors: errors,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
