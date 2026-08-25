import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';

const API_URL = process.env.E2E_API_URL ?? 'http://127.0.0.1:3100/api/v1';
const requiredEnvironment = [
  'SUPABASE_URL',
  'SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SECRET_KEY',
];
const fixture = {
  people: {},
  ids: {},
  title: `TASK-025 rental ${crypto.randomUUID().slice(0, 8)}`,
};
const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

let adminClient;

function futureDate(days = 30) {
  const value = new Date();
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function futureLocalDateTime(hours = 24) {
  const value = new Date(Date.now() + hours * 60 * 60 * 1000);
  const pad = (number) => String(number).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

async function api(path, { token, method = 'GET', body, headers = {} } = {}) {
  const requestHeaders = { Accept: 'application/json', ...headers };
  if (token) requestHeaders.Authorization = `Bearer ${token}`;
  const multipart = body instanceof FormData;
  if (body !== undefined && !multipart) {
    requestHeaders['Content-Type'] = 'application/json';
  }
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: requestHeaders,
    body: body === undefined || multipart ? body : JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null);
  return { status: response.status, payload, headers: response.headers };
}

async function createPerson(key, role, firstName) {
  const password = `Qa!${crypto.randomUUID()}9z`;
  const email = `task025-${key}-${crypto.randomUUID()}@example.test`;
  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  expect(error, `create ${key} auth fixture`).toBeNull();
  const person = {
    id: data.user.id,
    email,
    password,
    role,
    firstName,
    lastName: 'Task025',
  };
  const { error: profileError } = await adminClient.from('profiles').insert({
    id: person.id,
    role,
    first_name: firstName,
    last_name: person.lastName,
    account_status: 'ACTIVE',
  });
  expect(profileError, `create ${key} profile fixture`).toBeNull();
  if (role === 'TENANT') {
    const { data: tenant, error: tenantError } = await adminClient
      .from('tenant_profiles')
      .insert({ user_id: person.id })
      .select('id')
      .single();
    expect(tenantError, `create ${key} tenant fixture`).toBeNull();
    person.profileId = tenant.id;
  }
  if (role === 'LANDLORD') {
    const { data: landlord, error: landlordError } = await adminClient
      .from('landlord_profiles')
      .insert({ user_id: person.id })
      .select('id')
      .single();
    expect(landlordError, `create ${key} landlord fixture`).toBeNull();
    person.profileId = landlord.id;
  }
  const publicClient = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data: session, error: signInError } =
    await publicClient.auth.signInWithPassword({ email, password });
  expect(signInError, `authenticate ${key} fixture`).toBeNull();
  person.token = session.session.access_token;
  fixture.people[key] = person;
}

async function login(page, person) {
  await page.goto('/');
  await page.evaluate(() => globalThis.localStorage.clear());
  await page.context().clearCookies();
  await page.goto('/login');
  await page.getByLabel('Email').fill(person.email);
  await page.getByLabel('Password').fill(person.password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/account$/, { timeout: 20_000 });
}

function captureBrowserFailures(page) {
  const failures = [];
  page.on('pageerror', (error) => failures.push(`page: ${error.message}`));
  page.on('console', (message) => {
    const browserResourceError = message
      .text()
      .startsWith(
        'Failed to load resource: the server responded with a status',
      );
    if (message.type() === 'error' && !browserResourceError) {
      failures.push(`console: ${message.text()}`);
    }
  });
  page.on('requestfailed', (request) => {
    if (!request.failure()?.errorText.includes('ERR_ABORTED')) {
      failures.push(`network: ${request.method()} ${request.url()}`);
    }
  });
  page.on('response', (response) => {
    if (
      response.status() >= 500 &&
      /^http:\/\/(127\.0\.0\.1|localhost):(3100|5174)/.test(response.url())
    ) {
      failures.push(`server: ${response.status()} ${response.url()}`);
    }
  });
  return failures;
}

async function assertNoHorizontalOverflow(page) {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth + 1,
      ),
    )
    .toBe(true);
}

async function assertAccessibleBasics(page) {
  const findings = await page.evaluate(() => {
    const issues = [];
    if (!document.querySelector('main')) issues.push('missing main landmark');
    if (!document.querySelector('h1')) issues.push('missing h1');
    for (const element of document.querySelectorAll(
      'button, a[href], input, select, textarea',
    )) {
      const name =
        element.getAttribute('aria-label') ||
        element.getAttribute('title') ||
        element.labels?.[0]?.textContent?.trim() ||
        element.textContent?.trim();
      if (!name) issues.push(`unnamed ${element.tagName.toLowerCase()}`);
    }
    for (const image of document.querySelectorAll('img')) {
      if (!image.hasAttribute('alt')) issues.push('image without alt');
    }
    return issues;
  });
  expect(findings).toEqual([]);
}

async function deleteWhere(table, column, values) {
  const filtered = [...new Set((values ?? []).filter(Boolean))];
  if (!filtered.length) return;
  const { error } = await adminClient.from(table).delete().in(column, filtered);
  if (error) {
    throw new Error(`Fixture cleanup failed for ${table}: ${error.message}`);
  }
}

async function cleanupFixtures() {
  if (!adminClient) return;
  const { data: authPage, error: authListError } =
    await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (authListError) throw new Error('Fixture auth cleanup discovery failed.');
  const userIds = authPage.users
    .filter(({ email }) => email?.startsWith('task025-'))
    .map(({ id }) => id);
  const { data: tenantProfiles = [] } = userIds.length
    ? await adminClient
        .from('tenant_profiles')
        .select('id')
        .in('user_id', userIds)
    : { data: [] };
  const tenantIds = tenantProfiles.map(({ id }) => id);
  const { data: landlordProfiles = [] } = userIds.length
    ? await adminClient
        .from('landlord_profiles')
        .select('id')
        .in('user_id', userIds)
    : { data: [] };
  const landlordIds = landlordProfiles.map(({ id }) => id);
  const { data: properties = [] } = landlordIds.length
    ? await adminClient
        .from('properties')
        .select('id')
        .in('landlord_id', landlordIds)
    : { data: [] };
  const propertyIds = properties.map(({ id }) => id);
  const { data: images = [] } = propertyIds.length
    ? await adminClient
        .from('property_images')
        .select('storage_path')
        .in('property_id', propertyIds)
    : { data: [] };
  const { data: listings = [] } = propertyIds.length
    ? await adminClient
        .from('listings')
        .select('id')
        .in('property_id', propertyIds)
    : { data: [] };
  const listingIds = listings.map(({ id }) => id);
  const { data: applications = [] } = listingIds.length
    ? await adminClient
        .from('applications')
        .select('id')
        .in('listing_id', listingIds)
    : { data: [] };
  const applicationIds = applications.map(({ id }) => id);
  const { data: conversations = [] } = listingIds.length
    ? await adminClient
        .from('conversations')
        .select('id')
        .in('listing_id', listingIds)
    : { data: [] };
  const conversationIds = conversations.map(({ id }) => id);
  const { data: messages = [] } = conversationIds.length
    ? await adminClient
        .from('messages')
        .select('id')
        .in('conversation_id', conversationIds)
    : { data: [] };
  const messageIds = messages.map(({ id }) => id);
  const { data: questions = [] } = listingIds.length
    ? await adminClient
        .from('application_questions')
        .select('id')
        .in('listing_id', listingIds)
    : { data: [] };
  const questionIds = questions.map(({ id }) => id);
  const { data: verifications = [] } =
    propertyIds.length || userIds.length
      ? await adminClient
          .from('verification_records')
          .select('id,evidence_path')
          .in('subject_id', [...propertyIds, ...userIds])
      : { data: [] };
  const verificationIds = verifications.map(({ id }) => id);

  await deleteWhere('admin_audit_logs', 'admin_user_id', userIds);
  await deleteWhere('notifications', 'user_id', userIds);
  await deleteWhere('reports', 'reporter_user_id', userIds);
  await deleteWhere('reports', 'message_id', messageIds);
  await deleteWhere('reports', 'listing_id', listingIds);
  await deleteWhere('verification_records', 'id', verificationIds);
  await deleteWhere('messages', 'conversation_id', conversationIds);
  await deleteWhere(
    'conversation_participants',
    'conversation_id',
    conversationIds,
  );
  await deleteWhere('conversations', 'id', conversationIds);
  await deleteWhere('viewings', 'application_id', applicationIds);
  await deleteWhere(
    'application_status_history',
    'application_id',
    applicationIds,
  );
  if (applicationIds.length) {
    const { error: resetError } = await adminClient
      .from('applications')
      .update({ status: 'DRAFT', submitted_at: null, withdrawn_at: null })
      .in('id', applicationIds);
    if (resetError) {
      throw new Error(
        `Fixture application cleanup failed: ${resetError.message}`,
      );
    }
  }
  await deleteWhere('application_answers', 'application_id', applicationIds);
  await deleteWhere('applications', 'id', applicationIds);
  await deleteWhere('application_question_options', 'question_id', questionIds);
  await deleteWhere('application_questions', 'id', questionIds);
  await deleteWhere('saved_listings', 'listing_id', listingIds);
  await deleteWhere('listings', 'id', listingIds);
  await deleteWhere('property_images', 'property_id', propertyIds);
  const imagePaths = images
    .map(({ storage_path }) => storage_path)
    .filter(Boolean);
  if (imagePaths.length) {
    await adminClient.storage.from('property-images').remove(imagePaths);
  }
  const evidencePaths = verifications
    .map(({ evidence_path }) => evidence_path)
    .filter(Boolean);
  if (evidencePaths.length) {
    await adminClient.storage
      .from('verification-evidence')
      .remove(evidencePaths);
  }
  await deleteWhere('properties', 'id', propertyIds);
  await deleteWhere(
    'tenant_preferred_locations',
    'tenant_profile_id',
    tenantIds,
  );
  await deleteWhere('tenant_profiles', 'id', tenantIds);
  await deleteWhere('landlord_profiles', 'id', landlordIds);
  await deleteWhere('notifications', 'user_id', userIds);
  await deleteWhere('profiles', 'id', userIds);
  for (const userId of userIds) await adminClient.auth.admin.deleteUser(userId);
}

test.describe('TASK-025 deterministic prototype QA', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    for (const name of requiredEnvironment) {
      expect(process.env[name], `${name} must be configured`).toBeTruthy();
    }
    adminClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SECRET_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    await createPerson('tenantA', 'TENANT', 'Aisha');
    await createPerson('tenantB', 'TENANT', 'Benoit');
    await createPerson('tenantDraft', 'TENANT', 'Chloe');
    await createPerson('landlordA', 'LANDLORD', 'Dev');
    await createPerson('landlordB', 'LANDLORD', 'Elise');
    await createPerson('admin', 'ADMIN', 'Farah');
  });

  test.afterAll(async () => {
    await cleanupFixtures();
  });

  test('public loading, error, empty, responsive, accessibility, CORS, and auth boundaries', async ({
    page,
    request,
  }) => {
    const failures = captureBrowserFailures(page);
    const listingApiPattern = (url) => url.pathname === '/api/v1/listings';
    const delayedListings = async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 250));
      await route.continue().catch(() => {});
    };
    await page.route(listingApiPattern, delayedListings);
    await page.goto('/listings');
    await expect(page.getByText('Loading rentals...')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: /Find a rental/i }),
    ).toBeVisible();
    await expect(page.getByLabel('District')).toBeVisible();
    await expect(page.getByText(/rentals found|No rentals match/i)).toBeVisible(
      {
        timeout: 20_000,
      },
    );
    await page.getByLabel('District').fill(`No-match-${crypto.randomUUID()}`);
    await page.getByRole('button', { name: 'Search rentals' }).click();
    await expect(
      page.getByRole('heading', { name: /No rentals match/i }),
    ).toBeVisible();
    await assertAccessibleBasics(page);
    await assertNoHorizontalOverflow(page);

    await page.setViewportSize({ width: 375, height: 812 });
    await page.reload();
    await page.getByRole('button', { name: 'Show filters' }).click();
    await expect(page.getByLabel('Property type')).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus')).toBeVisible();

    await page.unroute(listingApiPattern, delayedListings, {
      behavior: 'wait',
    });
    const errorPage = await page.context().newPage();
    let controlledErrorRequests = 0;
    await errorPage.route(listingApiPattern, (route) => {
      controlledErrorRequests += 1;
      return route.fulfill({
        status: 503,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          success: false,
          error: { code: 'QA_ERROR', message: 'Controlled QA error' },
        }),
      });
    });
    await errorPage.goto(page.url());
    await expect.poll(() => controlledErrorRequests).toBeGreaterThan(0);
    await expect(errorPage.getByText(/couldn't load rentals/i)).toBeVisible();
    await errorPage.close();

    await page.goto('/conversations');
    await expect(page).toHaveURL(/\/login/);
    let mutations = 0;
    page.on('request', (requestItem) => {
      if (requestItem.method() !== 'GET') mutations += 1;
    });
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page.getByRole('alert')).toHaveText(
      'Enter your email and password.',
    );
    expect(mutations).toBe(0);

    const corsResponse = await request.get(`${API_URL}/health`, {
      headers: { Origin: 'https://untrusted.example' },
    });
    expect(
      corsResponse.headers()['access-control-allow-origin'],
    ).toBeUndefined();
    expect(failures.filter((item) => !item.includes('503'))).toEqual([]);
  });

  test('authentication persists across refresh, rejects wrong-role navigation, logs out, and exposes recovery UI', async ({
    page,
  }) => {
    await login(page, fixture.people.tenantA);
    await page.reload();
    await expect(
      page.getByRole('heading', { name: 'Aisha Task025' }),
    ).toBeVisible();
    await page.goto('/admin/reports');
    await expect(page).toHaveURL(/\/account$/);
    await page.goto('/landlord/properties');
    await expect(page).toHaveURL(/\/account$/);
    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.getByRole('link', { name: 'Forgot password?' }).click();
    await expect(
      page.getByRole('heading', { name: 'Reset your password' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Send reset instructions' }).click();
    await expect(page.getByRole('status')).toHaveText(
      'Enter your email address.',
    );
  });

  test('landlord creates a private property, image, listing, and application question', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await login(page, fixture.people.landlordA);
    await page.goto('/landlord/properties/new');
    await page.getByRole('button', { name: 'Create property' }).click();
    await expect(page.getByText('Enter a district.')).toBeVisible();
    await page.getByLabel('Bedrooms *').fill('2');
    await page.getByLabel('Bathrooms *').fill('1.5');
    await page.getByLabel('Address line 1').fill('25 Private QA Lane');
    await page.getByLabel('District *').fill('Moka');
    await page.getByLabel('Locality *').fill('Saint Pierre');
    await page.getByLabel('Neighbourhood').fill('Helvetia');
    await page.getByLabel('Furnished').check();
    await page.getByLabel('Parking spaces').fill('1');
    await page.getByRole('button', { name: 'Create property' }).click();
    await expect(page).toHaveURL(/\/landlord\/properties\/[0-9a-f-]+$/);
    fixture.ids.property = page.url().split('/').pop();

    await page.locator('input[type="file"]').setInputFiles({
      name: 'task-025-property.png',
      mimeType: 'image/png',
      buffer: tinyPng,
    });
    await expect(page.getByRole('status')).toHaveText('Image uploaded.', {
      timeout: 20_000,
    });
    await page.getByRole('link', { name: 'Create listing' }).click();
    await page.getByRole('button', { name: 'Save draft' }).click();
    await expect(page.getByText('Enter a listing title.')).toBeVisible();
    await page.getByLabel('Title *').fill(fixture.title);
    await page
      .getByLabel('Description *')
      .fill('Deterministic two-bedroom QA rental near everyday services.');
    await page.getByLabel('Monthly rent (Rs) *').fill('24500');
    await page.getByLabel('Deposit (Rs)').fill('24500');
    await page.getByLabel('Available from *').fill(futureDate());
    await page.getByLabel('Minimum lease (months)').fill('12');
    await page.getByLabel('Maximum occupants').fill('4');
    await page.getByRole('button', { name: 'Save draft' }).click();
    await expect(page).toHaveURL(/\/landlord\/listings\/[0-9a-f-]+$/);
    fixture.ids.listing = page.url().split('/').pop();

    await page.getByRole('button', { name: 'Add question' }).click();
    await page
      .getByRole('textbox', { name: 'Question', exact: true })
      .fill('Why is this rental suitable?');
    await page.getByLabel('Required').check();
    await page
      .getByRole('button', { name: 'Add question', exact: true })
      .click();
    await expect(page.getByText('Why is this rental suitable?')).toBeVisible();

    const draftPublic = await api(`/listings/${fixture.ids.listing}`);
    expect(draftPublic.status).toBe(404);
    expect(JSON.stringify(draftPublic.payload)).not.toContain(
      '25 Private QA Lane',
    );
    const foreignLandlord = await api(
      `/landlord/listings/${fixture.ids.listing}`,
      { token: fixture.people.landlordB.token },
    );
    expect(foreignLandlord.status).toBe(404);

    await page.goto(`/listings/${fixture.ids.listing}`);
    await expect(
      page.getByRole('heading', { name: 'Rental unavailable' }),
    ).toBeVisible();
    await page.goto(`/landlord/listings/${fixture.ids.listing}`);

    await page.getByRole('button', { name: 'Submit for review' }).click();
    await expect(page.getByText(/pending review/i)).toBeVisible();
  });

  test('admin approves the listing and public discovery preserves address privacy', async ({
    page,
  }) => {
    await login(page, fixture.people.admin);
    await page.goto('/admin/listings');
    await expect(
      page.getByRole('heading', { name: 'Listing review' }),
    ).toBeVisible();
    await page.getByRole('link', { name: new RegExp(fixture.title) }).click();
    await expect(
      page.getByRole('button', { name: 'Return to draft' }),
    ).toBeDisabled();
    await page.getByRole('button', { name: 'Approve listing' }).click();
    await expect(page.getByRole('status')).toHaveText(
      'Listing approved and made active.',
    );

    await page.goto('/listings');
    await expect(page.getByText(fixture.title)).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole('link', { name: fixture.title, exact: true }).click();
    await expect(
      page.getByRole('heading', { name: fixture.title }),
    ).toBeVisible();
    await expect(page.getByText('Saint Pierre, Moka')).toBeVisible();
    await expect(page.getByText('25 Private QA Lane')).toHaveCount(0);
    await expect(page.getByText('Why is this rental suitable?')).toBeVisible();
  });

  test('tenants discover, save, report, converse, submit competing applications, and retain a private draft', async ({
    page,
  }) => {
    await login(page, fixture.people.tenantA);
    await page.goto(`/listings/${fixture.ids.listing}`);
    await page.getByRole('button', { name: 'Save rental' }).click();
    await expect(page.getByRole('status')).toContainText('Rental saved.');
    await page.getByRole('button', { name: 'Report listing' }).click();
    await page
      .getByLabel('Details (optional)')
      .fill('Controlled TASK-025 listing moderation fixture.');
    await page.getByRole('button', { name: 'Submit report' }).click();
    await expect(
      page.getByText('Thanks. Your report was submitted.'),
    ).toBeVisible();
    const duplicateListingReport = await api('/reports', {
      token: fixture.people.tenantA.token,
      method: 'POST',
      body: {
        target_type: 'LISTING',
        target_id: fixture.ids.listing,
        reason: 'FRAUD_OR_SCAM',
        details: 'Duplicate controlled report.',
      },
    });
    expect(duplicateListingReport.status).toBe(200);
    expect(duplicateListingReport.payload.data.created).toBe(false);

    await page.getByRole('button', { name: 'Contact landlord' }).click();
    await expect(page).toHaveURL(/\/conversations\/[0-9a-f-]+$/);
    fixture.ids.conversation = page.url().split('/').pop();
    await expect(
      page.getByRole('button', { name: 'Send message' }),
    ).toBeDisabled();
    await page
      .getByRole('textbox', { name: 'Message', exact: true })
      .fill('Hello from the primary tenant fixture.');
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(
      page.getByText('Hello from the primary tenant fixture.'),
    ).toBeVisible();
    await page.goto(`/listings/${fixture.ids.listing}`);
    await page.getByRole('button', { name: 'Contact landlord' }).click();
    await expect(page).toHaveURL(
      new RegExp(`/conversations/${fixture.ids.conversation}$`),
    );

    await page.goto(`/listings/${fixture.ids.listing}/apply`);
    await page.getByRole('button', { name: 'Review application' }).click();
    await expect(page.getByText(/Complete these required items/)).toBeVisible();
    await page.getByLabel('Preferred move-in date').fill(futureDate(45));
    await page.getByLabel('Requested lease duration (months)').fill('12');
    await page.getByLabel('Number of occupants').fill('2');
    await page
      .getByLabel('Brief introduction')
      .fill('Primary deterministic tenant application.');
    await page
      .getByLabel(/Why is this rental suitable/)
      .fill('It is close to work.');
    await page.getByRole('button', { name: 'Review application' }).click();
    await expect(
      page.getByRole('heading', { name: 'Review your application' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Submit application' }).click();
    await expect(
      page.getByRole('heading', { name: 'Application submitted' }),
    ).toBeVisible();

    const submitApplication = async (person, introduction, submit) => {
      await login(page, person);
      await page.goto(`/listings/${fixture.ids.listing}/apply`);
      await page.getByLabel('Preferred move-in date').fill(futureDate(50));
      await page.getByLabel('Requested lease duration (months)').fill('6');
      await page.getByLabel('Number of occupants').fill('1');
      await page.getByLabel('Brief introduction').fill(introduction);
      await page
        .getByLabel(/Why is this rental suitable/)
        .fill('It meets my needs.');
      if (submit) {
        await page.getByRole('button', { name: 'Review application' }).click();
        await page.getByRole('button', { name: 'Submit application' }).click();
        await expect(
          page.getByRole('heading', { name: 'Application submitted' }),
        ).toBeVisible();
      } else {
        await page.getByRole('button', { name: 'Save draft' }).click();
        await expect(page.getByRole('status')).toContainText(
          'not been submitted',
        );
      }
    };
    await submitApplication(
      fixture.people.tenantB,
      'Competing deterministic tenant application.',
      true,
    );
    await submitApplication(
      fixture.people.tenantDraft,
      'Private draft that must remain invisible.',
      false,
    );

    const { data: applications, error } = await adminClient
      .from('applications')
      .select('id,tenant_id,status')
      .eq('listing_id', fixture.ids.listing);
    expect(error).toBeNull();
    for (const [key, idKey] of [
      ['tenantA', 'applicationA'],
      ['tenantB', 'applicationB'],
      ['tenantDraft', 'applicationDraft'],
    ]) {
      fixture.ids[idKey] = applications.find(
        ({ tenant_id }) => tenant_id === fixture.people[key].profileId,
      ).id;
    }
    expect(
      applications.find(({ id }) => id === fixture.ids.applicationDraft).status,
    ).toBe('DRAFT');
    const draftByLandlord = await api(
      `/landlord/applications/${fixture.ids.applicationDraft}`,
      { token: fixture.people.landlordA.token },
    );
    expect(draftByLandlord.status).toBe(404);
    const draftByOtherTenant = await api(
      `/tenant/applications/${fixture.ids.applicationDraft}`,
      { token: fixture.people.tenantB.token },
    );
    expect(draftByOtherTenant.status).toBe(404);
    await login(page, fixture.people.landlordA);
    await page.goto(`/landlord/applications/${fixture.ids.applicationDraft}`);
    await expect(
      page.getByRole('heading', { name: 'Application unavailable' }),
    ).toBeVisible();
  });

  test('landlord reviews, shortlists, proposes a viewing, and exchanges a reportable message', async ({
    page,
  }) => {
    await login(page, fixture.people.landlordA);
    await page.goto(`/landlord/listings/${fixture.ids.listing}/applications`);
    await expect(page.getByText('Aisha Task025')).toBeVisible();
    await expect(page.getByText('Benoit Task025')).toBeVisible();
    await expect(page.getByText('Chloe Task025')).toHaveCount(0);

    await page.goto(`/landlord/applications/${fixture.ids.applicationA}`);
    await page.getByRole('button', { name: 'Mark under review' }).click();
    await expect(page.getByRole('status')).toContainText('under review');
    await page.getByRole('button', { name: 'Shortlist' }).click();
    await expect(page.getByRole('status')).toContainText('shortlisted');
    const invalidViewing = await api(
      `/landlord/applications/${fixture.ids.applicationA}/viewings`,
      {
        token: fixture.people.landlordA.token,
        method: 'POST',
        body: {
          start_time: new Date(Date.now() - 60_000).toISOString(),
          end_time: null,
          notes: null,
        },
      },
    );
    expect(invalidViewing.status).toBe(422);
    await page.getByRole('button', { name: 'Propose viewing' }).click();
    await page.getByLabel('Start time *').fill(futureLocalDateTime());
    await page.getByLabel('Notes').fill('Controlled TASK-025 viewing.');
    await page.getByRole('button', { name: 'Send viewing proposal' }).click();
    await expect(page.getByText('Viewing proposed.')).toBeVisible();

    await page.goto(`/conversations/${fixture.ids.conversation}`);
    await page
      .getByRole('textbox', { name: 'Message', exact: true })
      .fill('Landlord reply for message reporting QA.');
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(
      page.getByText('Landlord reply for message reporting QA.'),
    ).toBeVisible();

    await login(page, fixture.people.tenantA);
    await page.goto(`/conversations/${fixture.ids.conversation}`);
    const landlordReply = page
      .getByRole('listitem')
      .filter({ hasText: 'Landlord reply for message reporting QA.' });
    await landlordReply.getByRole('button', { name: 'Report message' }).click();
    await landlordReply
      .getByLabel('Details (optional)')
      .fill('Controlled TASK-025 message moderation fixture.');
    await landlordReply.getByRole('button', { name: 'Submit report' }).click();
    await expect(page.getByRole('status')).toContainText('Message reported.');
    const { data: reportedMessage } = await adminClient
      .from('messages')
      .select('id')
      .eq('conversation_id', fixture.ids.conversation)
      .eq('sender_user_id', fixture.people.landlordA.id)
      .single();
    const duplicateMessageReport = await api('/reports', {
      token: fixture.people.tenantA.token,
      method: 'POST',
      body: {
        target_type: 'MESSAGE',
        target_id: reportedMessage.id,
        reason: 'HARASSMENT',
        details: 'Duplicate controlled report.',
      },
    });
    expect(duplicateMessageReport.status).toBe(200);
    expect(duplicateMessageReport.payload.data.created).toBe(false);
    const history = page.getByRole('list', { name: 'Message history' });
    await expect(history.getByRole('listitem').nth(0)).toContainText(
      'Hello from the primary tenant fixture.',
    );
    await expect(history.getByRole('listitem').nth(1)).toContainText(
      'Landlord reply for message reporting QA.',
    );
  });

  test('tenant confirms and landlord completes the viewing with notifications', async ({
    page,
  }) => {
    await login(page, fixture.people.tenantA);
    await page.goto(`/tenant/applications/${fixture.ids.applicationA}`);
    await page.getByRole('button', { name: 'Confirm viewing' }).click();
    await expect(page.getByRole('status')).toContainText('Viewing confirmed.');
    await page.goto('/notifications');
    await expect(
      page.getByRole('heading', { name: 'Notifications' }),
    ).toBeVisible();
    await expect(page.getByText(/viewing/i).first()).toBeVisible();
    await expect(
      page.getByText('Landlord reply for message reporting QA.'),
    ).toHaveCount(0);
    const firstUnread = page.getByRole('button', { name: /^Unread:/ }).first();
    if (await firstUnread.isVisible()) {
      await firstUnread.click();
      await page.goto('/notifications');
      await expect(
        page.getByRole('button', { name: /^Read:/ }).first(),
      ).toBeVisible();
    }
    const markAll = page.getByRole('button', { name: 'Mark all as read' });
    if (await markAll.isVisible()) await markAll.click();

    const { data: viewing, error } = await adminClient
      .from('viewings')
      .select('id')
      .eq('application_id', fixture.ids.applicationA)
      .eq('status', 'CONFIRMED')
      .single();
    expect(error).toBeNull();
    fixture.ids.viewing = viewing.id;
    const { error: timeError } = await adminClient
      .from('viewings')
      .update({ start_time: new Date(Date.now() - 60_000).toISOString() })
      .eq('id', viewing.id);
    expect(timeError).toBeNull();

    await login(page, fixture.people.landlordA);
    await page.goto(`/landlord/applications/${fixture.ids.applicationA}`);
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Complete viewing' }).click();
    await expect(page.getByRole('status')).toContainText('Viewing completed.');
    await expect(
      page.getByRole('button', { name: 'Accept application' }),
    ).toBeVisible();
  });

  test('alternate viewing paths enforce one-open viewing and support decline, cancel, re-propose, and no-show', async ({
    page,
  }) => {
    await login(page, fixture.people.landlordA);
    await page.goto(`/landlord/applications/${fixture.ids.applicationB}`);
    await page.getByRole('button', { name: 'Mark under review' }).click();
    await page.getByRole('button', { name: 'Shortlist' }).click();
    await page.getByRole('button', { name: 'Propose viewing' }).click();
    await page.getByLabel('Start time *').fill(futureLocalDateTime(30));
    await page.getByRole('button', { name: 'Send viewing proposal' }).click();
    await expect(page.getByText('Viewing proposed.')).toBeVisible();

    await login(page, fixture.people.tenantB);
    await page.goto(`/tenant/applications/${fixture.ids.applicationB}`);
    await page.getByRole('button', { name: 'Decline viewing' }).click();
    await expect(page.getByText('Viewing declined.')).toBeVisible();

    await login(page, fixture.people.landlordA);
    await page.goto(`/landlord/applications/${fixture.ids.applicationB}`);
    await page.getByRole('button', { name: 'Propose viewing' }).click();
    await page.getByLabel('Start time *').fill(futureLocalDateTime(36));
    await page.getByRole('button', { name: 'Send viewing proposal' }).click();
    await expect(page.getByText('Viewing proposed.')).toBeVisible();
    const duplicateOpen = await api(
      `/landlord/applications/${fixture.ids.applicationB}/viewings`,
      {
        token: fixture.people.landlordA.token,
        method: 'POST',
        body: {
          start_time: new Date(Date.now() + 40 * 60 * 60 * 1000).toISOString(),
          end_time: null,
          notes: 'Must be rejected by the one-open invariant.',
        },
      },
    );
    expect(duplicateOpen.status).toBe(409);
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Cancel viewing' }).click();
    await expect(page.getByText('Viewing cancelled.')).toBeVisible();

    await page.getByRole('button', { name: 'Propose viewing' }).click();
    await page.getByLabel('Start time *').fill(futureLocalDateTime(48));
    await page.getByRole('button', { name: 'Send viewing proposal' }).click();
    await login(page, fixture.people.tenantB);
    await page.goto(`/tenant/applications/${fixture.ids.applicationB}`);
    await page.getByRole('button', { name: 'Confirm viewing' }).click();
    await expect(page.getByText('Viewing confirmed.')).toBeVisible();
    const { data: openViewing, error: openViewingError } = await adminClient
      .from('viewings')
      .select('id')
      .eq('application_id', fixture.ids.applicationB)
      .eq('status', 'CONFIRMED')
      .single();
    expect(openViewingError).toBeNull();
    const { error: startError } = await adminClient
      .from('viewings')
      .update({ start_time: new Date(Date.now() - 60_000).toISOString() })
      .eq('id', openViewing.id);
    expect(startError).toBeNull();
    await login(page, fixture.people.landlordA);
    await page.goto(`/landlord/applications/${fixture.ids.applicationB}`);
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Mark no-show' }).click();
    await expect(page.getByText('Viewing marked no-show.')).toBeVisible();
  });

  test('verification and report moderation work through admin QA surfaces', async ({
    page,
  }) => {
    const created = await api('/landlord/verifications', {
      token: fixture.people.landlordA.token,
      method: 'POST',
      body: {
        type: 'PROPERTY_AUTHORITY',
        property_id: fixture.ids.property,
      },
    });
    expect(created.status).toBe(201);
    fixture.ids.verification = created.payload.data.id;
    const identity = await api('/landlord/verifications', {
      token: fixture.people.landlordA.token,
      method: 'POST',
      body: { type: 'LANDLORD_IDENTITY' },
    });
    expect(identity.status).toBe(201);
    fixture.ids.identityVerification = identity.payload.data.id;
    const invalidEvidenceForm = new FormData();
    invalidEvidenceForm.append(
      'evidence',
      new Blob(['not evidence'], { type: 'text/plain' }),
      'invalid.txt',
    );
    const invalidEvidence = await api(
      `/landlord/verifications/${fixture.ids.verification}/evidence`,
      {
        token: fixture.people.landlordA.token,
        method: 'POST',
        body: invalidEvidenceForm,
      },
    );
    expect(invalidEvidence.status).toBe(422);
    expect(invalidEvidence.payload.error.code).toBe('INVALID_EVIDENCE');
    const form = new FormData();
    form.append(
      'evidence',
      new Blob([tinyPng], { type: 'image/png' }),
      'evidence.png',
    );
    const evidence = await api(
      `/landlord/verifications/${fixture.ids.verification}/evidence`,
      { token: fixture.people.landlordA.token, method: 'POST', body: form },
    );
    expect(evidence.status).toBe(201);
    const identityForm = new FormData();
    identityForm.append(
      'evidence',
      new Blob([tinyPng], { type: 'image/png' }),
      'identity.png',
    );
    const identityEvidence = await api(
      `/landlord/verifications/${fixture.ids.identityVerification}/evidence`,
      {
        token: fixture.people.landlordA.token,
        method: 'POST',
        body: identityForm,
      },
    );
    expect(identityEvidence.status).toBe(201);
    const tenantEvidence = await api(
      `/admin/verifications/${fixture.ids.verification}/evidence`,
      { token: fixture.people.tenantA.token },
    );
    expect(tenantEvidence.status).toBe(403);

    await login(page, fixture.people.admin);
    await page.goto('/admin/verifications');
    await expect(page.getByText('PROPERTY_AUTHORITY')).toBeVisible();
    await page.getByText('PROPERTY_AUTHORITY').click();
    await page.getByRole('button', { name: 'Approve' }).click();
    await expect(page.getByRole('status')).toHaveText('Verification approved.');
    await page.goto(`/admin/verifications/${fixture.ids.identityVerification}`);
    await page.getByRole('button', { name: 'Reject' }).click();
    await expect(page.getByRole('status')).toHaveText('Verification rejected.');
    await page.goto(`/listings/${fixture.ids.listing}`);
    await expect(page.getByText('Property evidence reviewed')).toBeVisible();

    const { data: reports, error } = await adminClient
      .from('reports')
      .select('id,target_type')
      .eq('reporter_user_id', fixture.people.tenantA.id);
    expect(error).toBeNull();
    expect(reports).toHaveLength(2);
    await page.goto('/admin/reports');
    await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible();
    for (const report of reports) {
      await page.goto(`/admin/reports/${report.id}`);
      await page.getByRole('button', { name: 'Mark under review' }).click();
      await expect(page.getByRole('status')).toHaveText('Report updated.');
      await page
        .getByLabel('Moderation note (optional)')
        .fill('TASK-025 reviewed.');
      await page
        .getByRole('button', {
          name: report.target_type === 'LISTING' ? 'Resolve' : 'Dismiss',
        })
        .click();
      await expect(page.getByRole('status')).toHaveText('Report updated.');
    }
  });

  test('admin suspension hides the listing, blocks access, and reactivation does not auto-activate', async ({
    page,
  }) => {
    await login(page, fixture.people.admin);
    await page.goto(`/admin/users/${fixture.people.landlordA.id}`);
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Suspend account' }).click();
    await expect(page.getByRole('status')).toHaveText('Account suspended.');
    const suspendedListing = await api(`/listings/${fixture.ids.listing}`);
    expect(suspendedListing.status).toBe(404);
    const suspendedAccess = await api('/landlord/properties', {
      token: fixture.people.landlordA.token,
    });
    expect(suspendedAccess.status).toBe(403);

    await page.getByRole('button', { name: 'Reactivate account' }).click();
    await expect(page.getByRole('status')).toHaveText('Account reactivated.');
    const stillPaused = await api(`/listings/${fixture.ids.listing}`);
    expect(stillPaused.status).toBe(404);

    await login(page, fixture.people.landlordA);
    await page.goto(`/landlord/listings/${fixture.ids.listing}`);
    await expect(page.getByText(/Status: Paused/i)).toBeVisible();
    await page.getByRole('button', { name: 'Activate listing' }).click();
    await expect(page.getByText(/Status: Active/i)).toBeVisible();
    expect((await api(`/listings/${fixture.ids.listing}`)).status).toBe(200);
  });

  test('cross-role authorization remains privacy safe', async () => {
    const tenantAdmin = await api('/admin/users', {
      token: fixture.people.tenantA.token,
    });
    expect(tenantAdmin.status).toBe(403);
    const adminTenant = await api('/tenant/applications', {
      token: fixture.people.admin.token,
    });
    expect(adminTenant.status).toBe(403);
    const foreignProperty = await api(`/properties/${fixture.ids.property}`, {
      token: fixture.people.landlordB.token,
    });
    expect(foreignProperty.status).toBe(404);
    const foreignConversation = await api(
      `/conversations/${fixture.ids.conversation}`,
      { token: fixture.people.tenantB.token },
    );
    expect(foreignConversation.status).toBe(404);
    const anonymousApplication = await api(
      `/tenant/applications/${fixture.ids.applicationA}`,
    );
    expect(anonymousApplication.status).toBe(401);
  });

  test('acceptance marks the listing RENTED, rejects competition, preserves DRAFT privacy and history', async ({
    page,
  }) => {
    await login(page, fixture.people.landlordA);
    await page.goto(`/landlord/applications/${fixture.ids.applicationA}`);
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Accept application' }).click();
    await expect(page.getByRole('status')).toContainText(
      'Application accepted and listing marked rented.',
    );
    await expect(page.getByText('Status: Rented')).toBeVisible();

    const { data: listing } = await adminClient
      .from('listings')
      .select('status')
      .eq('id', fixture.ids.listing)
      .single();
    expect(listing.status).toBe('RENTED');
    const { data: applications } = await adminClient
      .from('applications')
      .select('id,status')
      .eq('listing_id', fixture.ids.listing);
    expect(
      applications.find(({ id }) => id === fixture.ids.applicationA).status,
    ).toBe('ACCEPTED');
    expect(
      applications.find(({ id }) => id === fixture.ids.applicationB).status,
    ).toBe('REJECTED');
    expect(
      applications.find(({ id }) => id === fixture.ids.applicationDraft).status,
    ).toBe('DRAFT');
    const { count } = await adminClient
      .from('application_status_history')
      .select('*', { count: 'exact', head: true })
      .eq('application_id', fixture.ids.applicationA)
      .eq('to_status', 'ACCEPTED');
    expect(count).toBe(1);

    expect((await api(`/listings/${fixture.ids.listing}`)).status).toBe(404);
    const draftPrivacy = await api(
      `/landlord/applications/${fixture.ids.applicationDraft}`,
      { token: fixture.people.landlordA.token },
    );
    expect(draftPrivacy.status).toBe(404);

    await login(page, fixture.people.tenantA);
    await page.goto('/tenant/saved-listings');
    await expect(
      page.getByRole('heading', { name: 'This rental is no longer available' }),
    ).toBeVisible();
    await page.goto(`/tenant/applications/${fixture.ids.applicationA}`);
    await expect(
      page.getByText('Accepted', { exact: true }).first(),
    ).toBeVisible();
    await page.goto(`/conversations/${fixture.ids.conversation}`);
    await expect(
      page.getByRole('heading', { name: /Dev Task025/ }),
    ).toBeVisible();
    await expect(page.getByText('Unavailable')).toBeVisible();
    await expect(page.getByText('25 Private QA Lane')).toHaveCount(0);
    await page.goto('/notifications');
    await expect(page.getByText(/accepted/i).first()).toBeVisible();
  });

  test('major authenticated layouts remain responsive and free of console/server failures', async ({
    page,
  }) => {
    const failures = captureBrowserFailures(page);

    const auditRoutes = async (routes) => {
      for (const [route, heading] of routes) {
        await page.goto(route);
        await expect(page.locator('main')).toBeVisible();
        await expect(
          page.getByRole('heading', { name: heading }),
        ).toBeVisible();
        await assertNoHorizontalOverflow(page);
        await assertAccessibleBasics(page);
      }
    };

    await page.setViewportSize({ width: 375, height: 812 });
    await login(page, fixture.people.tenantA);
    await auditRoutes([
      ['/tenant/saved-listings', 'Saved rentals'],
      [
        `/tenant/applications/${fixture.ids.applicationA}`,
        'Application details',
      ],
      [`/conversations/${fixture.ids.conversation}`, /Dev Task025/],
      ['/notifications', 'Notifications'],
      [`/listings/${fixture.ids.listing}`, 'Rental unavailable'],
    ]);

    await page.setViewportSize({ width: 768, height: 900 });
    await login(page, fixture.people.landlordA);
    await auditRoutes([
      ['/landlord/properties', 'Your properties'],
      [`/landlord/properties/${fixture.ids.property}`, 'Saint Pierre, Moka'],
      ['/landlord/listings', 'Your listings'],
      [`/landlord/listings/${fixture.ids.listing}`, fixture.title],
      [`/landlord/listings/${fixture.ids.listing}/applications`, fixture.title],
      [`/landlord/applications/${fixture.ids.applicationA}`, 'Aisha Task025'],
    ]);

    await page.setViewportSize({ width: 1280, height: 900 });
    await login(page, fixture.people.admin);
    await auditRoutes([
      ['/account', 'Farah Task025'],
      ['/admin/listings', 'Listing review'],
      ['/admin/users', 'User administration'],
      ['/admin/reports', 'Reports'],
      ['/admin/verifications', 'Verification queue'],
    ]);
    expect(failures).toEqual([]);
  });
});
