import assert from 'node:assert/strict';
import console from 'node:console';
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

process.loadEnvFile('backend/.env');
if (existsSync('backend/.env.integration'))
  process.loadEnvFile('backend/.env.integration');

const required = [
  'SUPABASE_URL',
  'SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SECRET_KEY',
  'SUPABASE_TEST_TENANT_EMAIL',
  'SUPABASE_TEST_TENANT_PASSWORD',
  'SUPABASE_TEST_LANDLORD_EMAIL',
  'SUPABASE_TEST_LANDLORD_PASSWORD',
];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) {
  console.error(
    `Hosted tenant-application verification requires: ${missing.join(', ')}.`,
  );
  process.exitCode = 1;
} else {
  await run();
}

function client(key) {
  return createClient(process.env.SUPABASE_URL, key, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

async function run() {
  const { createApp } = await import('../src/app.js');
  const server = await new Promise((resolve, reject) => {
    const listener = createApp().listen(0, '127.0.0.1', () =>
      resolve(listener),
    );
    listener.once('error', reject);
  });
  const apiBaseUrl = `http://127.0.0.1:${server.address().port}/api/v1`;
  const privileged = client(process.env.SUPABASE_SECRET_KEY);
  const anonymous = client(process.env.SUPABASE_PUBLISHABLE_KEY);
  const passed = [];
  const propertyIds = [];
  const listingIds = [];
  const applicationIds = [];
  const questionIds = [];
  const storagePaths = [];
  let temporaryUserId;
  let temporaryTenantProfileId;
  let controlledTenantUserId;

  async function check(name, callback) {
    await callback();
    passed.push(name);
  }

  async function signIn(email, password, label) {
    const browser = client(process.env.SUPABASE_PUBLISHABLE_KEY);
    const { data, error } = await browser.auth.signInWithPassword({
      email,
      password,
    });
    if (error || !data.session?.access_token)
      throw new Error(`${label} integration sign-in failed.`);
    return { browser, ...data };
  }

  async function api(path, token, { method = 'GET', body } = {}) {
    const headers = { Accept: 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const multipart = body instanceof globalThis.FormData;
    if (body !== undefined && !multipart)
      headers['Content-Type'] = 'application/json';
    const response = await globalThis.fetch(`${apiBaseUrl}${path}`, {
      method,
      headers,
      body: body === undefined || multipart ? body : JSON.stringify(body),
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null };
  }

  async function fixture(landlordId, marker) {
    const propertyId = randomUUID();
    const listingId = randomUUID();
    propertyIds.push(propertyId);
    listingIds.push(listingId);
    const property = await privileged.from('properties').insert({
      id: propertyId,
      landlord_id: landlordId,
      property_type: 'APARTMENT',
      address_line_1: `TASK013 PRIVATE STREET ${marker}`,
      address_line_2: 'TASK013 PRIVATE ADDRESS DETAIL',
      district: 'Moka',
      locality: 'Saint Pierre',
      latitude: -20.22,
      longitude: 57.53,
      bedrooms: 2,
      bathrooms: 1.5,
      furnished: true,
      parking_spaces: 1,
    });
    assert.equal(property.error, null);
    const listing = await privileged.from('listings').insert({
      id: listingId,
      property_id: propertyId,
      title: `TASK013 public ${marker}`,
      description: `TASK013 PRIVATE DESCRIPTION ${marker}`,
      monthly_rent: 21000,
      deposit_amount: 21000,
      available_from: '2026-12-01',
      minimum_lease_months: 6,
      maximum_occupants: 4,
      pets_allowed: false,
      status: 'ACTIVE',
      published_at: new Date().toISOString(),
    });
    assert.equal(listing.error, null);
    return { propertyId, listingId };
  }

  async function cover(propertyId, landlordToken) {
    const buffer = await sharp({
      create: { width: 8, height: 8, channels: 3, background: '#28614b' },
    })
      .jpeg()
      .toBuffer();
    const form = new globalThis.FormData();
    form.append('image', new globalThis.Blob([buffer]), 'task013-cover.jpg');
    const response = await api(
      `/properties/${propertyId}/images`,
      landlordToken,
      {
        method: 'POST',
        body: form,
      },
    );
    assert.equal(response.status, 201);
    const image = await privileged
      .from('property_images')
      .select('storage_path')
      .eq('id', response.body.data.id)
      .single();
    assert.equal(image.error, null);
    storagePaths.push(image.data.storage_path);
  }

  async function draft(listingId, token, marker) {
    const response = await api(`/listings/${listingId}/applications`, token, {
      method: 'POST',
      body: {
        move_in_date: '2026-12-01',
        requested_lease_duration_months: 12,
        number_of_occupants: 2,
        introductory_message: `TASK013 tenant-owned introduction ${marker}`,
      },
    });
    assert.ok([200, 201].includes(response.status));
    applicationIds.push(response.body.data.id);
    return response.body.data;
  }

  function assertNoPrivateListingData(value) {
    const serialized = JSON.stringify(value);
    for (const marker of [
      'TASK013 PRIVATE STREET',
      'TASK013 PRIVATE ADDRESS DETAIL',
      'TASK013 PRIVATE DESCRIPTION',
      'address_line_1',
      'address_line_2',
      'latitude',
      'longitude',
      'landlord_id',
      'property_id',
      'storage_path',
    ])
      assert.equal(serialized.includes(marker), false, `Leaked ${marker}`);
  }

  try {
    const tenant = await signIn(
      process.env.SUPABASE_TEST_TENANT_EMAIL,
      process.env.SUPABASE_TEST_TENANT_PASSWORD,
      'TENANT',
    );
    const landlord = await signIn(
      process.env.SUPABASE_TEST_LANDLORD_EMAIL,
      process.env.SUPABASE_TEST_LANDLORD_PASSWORD,
      'LANDLORD',
    );
    controlledTenantUserId = tenant.user.id;
    const tenantToken = tenant.session.access_token;
    const landlordToken = landlord.session.access_token;
    const landlordProfile = await privileged
      .from('landlord_profiles')
      .select('id')
      .eq('user_id', landlord.user.id)
      .single();
    assert.equal(landlordProfile.error, null);

    const temporaryEmail = `task013-${randomUUID()}@example.com`;
    const temporaryPassword = randomBytes(32).toString('base64url');
    const created = await privileged.auth.admin.createUser({
      email: temporaryEmail,
      password: temporaryPassword,
      email_confirm: true,
    });
    assert.equal(created.error, null);
    temporaryUserId = created.data.user.id;
    const temporary = await signIn(
      temporaryEmail,
      temporaryPassword,
      'temporary TENANT',
    );
    const onboarding = await api(
      '/auth/register-profile',
      temporary.session.access_token,
      {
        method: 'POST',
        body: { role: 'TENANT', first_name: 'TASK013', last_name: 'Isolation' },
      },
    );
    assert.equal(onboarding.status, 201);
    const available = await fixture(landlordProfile.data.id, 'AVAILABLE');
    const unavailableDraftFixture = await fixture(
      landlordProfile.data.id,
      'UNAVAILABLE_DRAFT',
    );
    const submittedFixture = await fixture(
      landlordProfile.data.id,
      'SUBMITTED',
    );
    await cover(available.propertyId, landlordToken);
    const availableDraft = await draft(
      available.listingId,
      tenantToken,
      'available draft',
    );
    const unavailableDraft = await draft(
      unavailableDraftFixture.listingId,
      tenantToken,
      'unavailable draft',
    );
    const otherDraft = await draft(
      available.listingId,
      temporary.session.access_token,
      'other tenant',
    );
    const roleProfile = await privileged
      .from('tenant_profiles')
      .select('id')
      .eq('user_id', temporaryUserId)
      .single();
    assert.equal(roleProfile.error, null);
    temporaryTenantProfileId = roleProfile.data.id;

    const question = await api(
      `/listings/${submittedFixture.listingId}/application-questions`,
      landlordToken,
      {
        method: 'POST',
        body: {
          question_text: 'TASK013 submitted snapshot question?',
          question_type: 'TEXT',
          is_required: true,
          display_order: 0,
        },
      },
    );
    assert.equal(question.status, 201);
    questionIds.push(question.body.data.id);
    const submittedDraft = await draft(
      submittedFixture.listingId,
      tenantToken,
      'submitted',
    );
    const answer = await api(
      `/applications/${submittedDraft.id}/answers`,
      tenantToken,
      {
        method: 'PUT',
        body: {
          answers: [
            {
              question_id: question.body.data.id,
              answer_text: 'TASK013 own submitted answer',
            },
          ],
        },
      },
    );
    assert.equal(answer.status, 200);
    const submitted = await api(
      `/applications/${submittedDraft.id}/submit`,
      tenantToken,
      { method: 'POST' },
    );
    assert.equal(submitted.status, 200);
    const paused = await privileged
      .from('listings')
      .update({ status: 'PAUSED' })
      .in('id', [
        unavailableDraftFixture.listingId,
        submittedFixture.listingId,
      ]);
    assert.equal(paused.error, null);

    await check(
      'tenant list is owner-scoped, deterministic, and paginated',
      async () => {
        const response = await api(
          '/tenant/applications?limit=100',
          tenantToken,
        );
        assert.equal(response.status, 200);
        const controlled = response.body.data.filter((item) =>
          applicationIds.includes(item.id),
        );
        assert.equal(controlled.length, 3);
        assert.equal(
          controlled.some((item) => item.id === otherDraft.id),
          false,
        );
        assert.equal(response.body.meta.limit, 100);
        const times = controlled.map((item) => item.updated_at);
        assert.deepEqual(times, [...times].sort().reverse());
      },
    );

    await check(
      'approved status filtering and query validation work',
      async () => {
        for (const status of [
          'DRAFT',
          'SUBMITTED',
          'UNDER_REVIEW',
          'SHORTLISTED',
          'VIEWING_INVITED',
          'VIEWING_COMPLETED',
          'ACCEPTED',
          'REJECTED',
          'WITHDRAWN',
        ]) {
          const response = await api(
            `/tenant/applications?status=${status}`,
            tenantToken,
          );
          assert.equal(response.status, 200);
          assert.ok(response.body.data.every((item) => item.status === status));
        }
        assert.equal(
          (await api('/tenant/applications?status=ACTIVE', tenantToken)).status,
          422,
        );
        assert.equal(
          (await api('/tenant/applications?limit=101', tenantToken)).status,
          422,
        );
      },
    );

    await check(
      'available items use the safe public card and a signed cover URL',
      async () => {
        const response = await api(
          '/tenant/applications?limit=100',
          tenantToken,
        );
        const item = response.body.data.find(
          ({ id }) => id === availableDraft.id,
        );
        assert.equal(item.availability, 'AVAILABLE');
        assert.equal(item.listing.id, available.listingId);
        assert.match(item.listing.cover_image_url, /^https?:\/\//);
        assertNoPrivateListingData(item);
      },
    );

    await check(
      'unavailable DRAFT and SUBMITTED items preserve only minimal listing state',
      async () => {
        const response = await api(
          '/tenant/applications?limit=100',
          tenantToken,
        );
        for (const id of [unavailableDraft.id, submittedDraft.id]) {
          const item = response.body.data.find(
            (candidate) => candidate.id === id,
          );
          assert.equal(item.availability, 'UNAVAILABLE');
          assert.equal(item.listing, null);
          assertNoPrivateListingData(item);
        }
      },
    );

    await check(
      'detail returns own answers and an actor-free safe timeline',
      async () => {
        const response = await api(
          `/applications/${submittedDraft.id}`,
          tenantToken,
        );
        assert.equal(response.status, 200);
        assert.equal(response.body.meta.editable, false);
        assert.equal(response.body.data.availability, 'UNAVAILABLE');
        assert.equal(response.body.data.listing, null);
        assert.equal(
          response.body.data.answers[0].question_text,
          'TASK013 submitted snapshot question?',
        );
        assert.equal(
          response.body.data.answers[0].answer_text,
          'TASK013 own submitted answer',
        );
        assert.equal(response.body.data.history.length, 1);
        assert.deepEqual(Object.keys(response.body.data.history[0]).sort(), [
          'created_at',
          'from_status',
          'to_status',
        ]);
        assertNoPrivateListingData(response.body.data);
        assert.equal(
          JSON.stringify(response.body).includes('changed_by_user_id'),
          false,
        );
      },
    );

    await check(
      'DRAFT availability controls edit continuation metadata',
      async () => {
        const availableResponse = await api(
          `/applications/${availableDraft.id}`,
          tenantToken,
        );
        const unavailableResponse = await api(
          `/applications/${unavailableDraft.id}`,
          tenantToken,
        );
        assert.equal(availableResponse.body.meta.editable, true);
        assert.equal(availableResponse.body.data.availability, 'AVAILABLE');
        assert.equal(unavailableResponse.body.meta.editable, false);
        assert.equal(unavailableResponse.body.data.availability, 'UNAVAILABLE');
        assert.equal(unavailableResponse.body.data.listing, null);
      },
    );

    await check(
      'cross-tenant detail and wrong-role list access are blocked',
      async () => {
        assert.equal(
          (
            await api(
              `/applications/${availableDraft.id}`,
              temporary.session.access_token,
            )
          ).status,
          404,
        );
        assert.equal(
          (await api('/tenant/applications', landlordToken)).status,
          403,
        );
        assert.equal((await api('/tenant/applications', null)).status, 401);
      },
    );

    await check('SUSPENDED tenant list access is denied', async () => {
      const suspended = await privileged
        .from('profiles')
        .update({ account_status: 'SUSPENDED' })
        .eq('id', controlledTenantUserId);
      assert.equal(suspended.error, null);
      try {
        const response = await api('/tenant/applications', tenantToken);
        assert.equal(response.status, 403);
        assert.equal(response.body.error.code, 'ACCOUNT_SUSPENDED');
      } finally {
        await privileged
          .from('profiles')
          .update({ account_status: 'ACTIVE' })
          .eq('id', controlledTenantUserId);
      }
    });

    await check(
      'publishable-key clients cannot directly read application data',
      async () => {
        const directApplications = await tenant.browser
          .from('applications')
          .select('*')
          .in('id', applicationIds);
        const directAnswers = await tenant.browser
          .from('application_answers')
          .select('*')
          .eq('application_id', submittedDraft.id);
        const directHistory = await tenant.browser
          .from('application_status_history')
          .select('*')
          .eq('application_id', submittedDraft.id);
        const anonymousApplications = await anonymous
          .from('applications')
          .select('*')
          .in('id', applicationIds);
        assert.ok(
          directApplications.error || directApplications.data.length === 0,
        );
        assert.ok(directAnswers.error || directAnswers.data.length === 0);
        assert.ok(directHistory.error || directHistory.data.length === 0);
        assert.ok(
          anonymousApplications.error ||
            anonymousApplications.data.length === 0,
        );
      },
    );

    console.log(
      `Hosted tenant-application verification passed (${passed.length} checks).`,
    );
    for (const name of passed) console.log(`  PASS ${name}`);
  } finally {
    if (controlledTenantUserId) {
      await privileged
        .from('profiles')
        .update({ account_status: 'ACTIVE' })
        .eq('id', controlledTenantUserId);
    }
    if (applicationIds.length) {
      await privileged
        .from('application_status_history')
        .delete()
        .in('application_id', applicationIds);
      await privileged
        .from('applications')
        .update({ status: 'DRAFT', submitted_at: null })
        .in('id', applicationIds);
      await privileged
        .from('application_answers')
        .delete()
        .in('application_id', applicationIds);
      await privileged.from('applications').delete().in('id', applicationIds);
    }
    if (questionIds.length) {
      await privileged
        .from('application_question_options')
        .delete()
        .in('question_id', questionIds);
      await privileged
        .from('application_questions')
        .delete()
        .in('id', questionIds);
    }
    if (listingIds.length)
      await privileged.from('listings').delete().in('id', listingIds);
    if (propertyIds.length)
      await privileged
        .from('property_images')
        .delete()
        .in('property_id', propertyIds);
    if (storagePaths.length)
      await privileged.storage.from('property-images').remove(storagePaths);
    if (propertyIds.length)
      await privileged.from('properties').delete().in('id', propertyIds);
    if (temporaryTenantProfileId) {
      await privileged
        .from('tenant_profiles')
        .delete()
        .eq('id', temporaryTenantProfileId);
    }
    if (temporaryUserId) {
      await privileged.from('profiles').delete().eq('id', temporaryUserId);
      await privileged.auth.admin.deleteUser(temporaryUserId);
    }
    await new Promise((resolve) => server.close(resolve));
  }
}
