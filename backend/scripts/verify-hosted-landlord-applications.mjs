import assert from 'node:assert/strict';
import console from 'node:console';
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

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
    `Hosted landlord-application verification requires: ${missing.join(', ')}.`,
  );
  process.exitCode = 1;
} else {
  await run();
}

function supabaseClient(key) {
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
  const privileged = supabaseClient(process.env.SUPABASE_SECRET_KEY);
  const anonymous = supabaseClient(process.env.SUPABASE_PUBLISHABLE_KEY);
  const passed = [];
  const temporaryUserIds = [];
  const temporaryTenantProfileIds = [];
  const temporaryLandlordProfileIds = [];
  const applicationIds = [];
  const questionIds = [];
  let propertyId;
  let listingId;
  let controlledLandlordUserId;

  async function check(name, callback) {
    await callback();
    passed.push(name);
  }

  async function signIn(email, password, label) {
    const browser = supabaseClient(process.env.SUPABASE_PUBLISHABLE_KEY);
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
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await globalThis.fetch(`${apiBaseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null };
  }

  async function temporaryIdentity(role, label) {
    const email = `task014-${label}-${randomUUID()}@example.com`;
    const password = randomBytes(32).toString('base64url');
    const created = await privileged.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    assert.equal(created.error, null);
    temporaryUserIds.push(created.data.user.id);
    const signedIn = await signIn(email, password, label);
    const onboarding = await api(
      '/auth/register-profile',
      signedIn.session.access_token,
      {
        method: 'POST',
        body: { role, first_name: `TASK014 ${label}`, last_name: 'Fixture' },
      },
    );
    assert.equal(onboarding.status, 201);
    const profilePath =
      role === 'TENANT' ? '/tenant/profile' : '/landlord/profile';
    assert.equal(
      (await api(profilePath, signedIn.session.access_token)).status,
      200,
    );
    const table = role === 'TENANT' ? 'tenant_profiles' : 'landlord_profiles';
    const roleProfile = await privileged
      .from(table)
      .select('id')
      .eq('user_id', created.data.user.id)
      .single();
    assert.equal(roleProfile.error, null);
    if (role === 'TENANT') temporaryTenantProfileIds.push(roleProfile.data.id);
    else temporaryLandlordProfileIds.push(roleProfile.data.id);
    return { ...signedIn, profileId: roleProfile.data.id };
  }

  async function createDraft(token, marker) {
    const response = await api(`/listings/${listingId}/applications`, token, {
      method: 'POST',
      body: {
        move_in_date: '2026-12-01',
        requested_lease_duration_months: 12,
        number_of_occupants: 2,
        introductory_message: `TASK014 ${marker} introduction`,
      },
    });
    assert.ok([200, 201].includes(response.status));
    applicationIds.push(response.body.data.id);
    return response.body.data;
  }

  function assertPrivateFieldsAbsent(value) {
    const serialized = JSON.stringify(value);
    for (const forbidden of [
      'tenant_id',
      'user_id',
      'email',
      'phone',
      'account_status',
      'income_range',
      'employer_or_school',
      'occupation_type',
      'preferred_locations',
      'bio',
      'changed_by_user_id',
      'storage_path',
      'supabase',
      'TASK014 PRIVATE PHONE',
      'TASK014 PRIVATE EMPLOYER',
      'TASK014 PRIVATE BIO',
    ])
      assert.equal(
        serialized.includes(forbidden),
        false,
        `Leaked ${forbidden}`,
      );
  }

  try {
    const controlledTenant = await signIn(
      process.env.SUPABASE_TEST_TENANT_EMAIL,
      process.env.SUPABASE_TEST_TENANT_PASSWORD,
      'controlled TENANT',
    );
    const controlledLandlord = await signIn(
      process.env.SUPABASE_TEST_LANDLORD_EMAIL,
      process.env.SUPABASE_TEST_LANDLORD_PASSWORD,
      'controlled LANDLORD',
    );
    controlledLandlordUserId = controlledLandlord.user.id;
    const tenantToken = controlledTenant.session.access_token;
    const landlordToken = controlledLandlord.session.access_token;
    const landlordProfile = await privileged
      .from('landlord_profiles')
      .select('id')
      .eq('user_id', controlledLandlord.user.id)
      .single();
    assert.equal(landlordProfile.error, null);

    const submittedTenant = await temporaryIdentity(
      'TENANT',
      'submitted-tenant',
    );
    const otherLandlord = await temporaryIdentity('LANDLORD', 'other-landlord');
    const privateBase = await privileged
      .from('profiles')
      .update({
        phone: 'TASK014 PRIVATE PHONE',
        profile_photo_url: 'https://images.example.test/task014-profile.jpg',
      })
      .eq('id', submittedTenant.user.id);
    assert.equal(privateBase.error, null);
    const privateTenant = await privileged
      .from('tenant_profiles')
      .update({
        income_range: 'TASK014 PRIVATE INCOME',
        employer_or_school: 'TASK014 PRIVATE EMPLOYER',
        occupation_type: 'TASK014 PRIVATE OCCUPATION',
        bio: 'TASK014 PRIVATE BIO',
      })
      .eq('id', submittedTenant.profileId);
    assert.equal(privateTenant.error, null);

    propertyId = randomUUID();
    listingId = randomUUID();
    const property = await privileged.from('properties').insert({
      id: propertyId,
      landlord_id: landlordProfile.data.id,
      property_type: 'APARTMENT',
      address_line_1: 'TASK014 PRIVATE LANDLORD STREET',
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
      title: 'TASK014 owned listing',
      description: 'TASK014 private listing description',
      monthly_rent: 22000,
      deposit_amount: 22000,
      available_from: '2026-12-01',
      minimum_lease_months: 6,
      maximum_occupants: 4,
      pets_allowed: false,
      status: 'ACTIVE',
      published_at: new Date().toISOString(),
    });
    assert.equal(listing.error, null);

    const question = await api(
      `/listings/${listingId}/application-questions`,
      landlordToken,
      {
        method: 'POST',
        body: {
          question_text: 'TASK014 submitted question?',
          question_type: 'TEXT',
          is_required: true,
          display_order: 0,
        },
      },
    );
    assert.equal(question.status, 201);
    questionIds.push(question.body.data.id);
    const submittedDraft = await createDraft(
      submittedTenant.session.access_token,
      'submitted tenant',
    );
    const answer = await api(
      `/applications/${submittedDraft.id}/answers`,
      submittedTenant.session.access_token,
      {
        method: 'PUT',
        body: {
          answers: [
            {
              question_id: question.body.data.id,
              answer_text: 'TASK014 submitted answer',
            },
          ],
        },
      },
    );
    assert.equal(answer.status, 200);
    assert.equal(
      (
        await api(
          `/applications/${submittedDraft.id}/submit`,
          submittedTenant.session.access_token,
          { method: 'POST' },
        )
      ).status,
      200,
    );
    const controlledDraft = await createDraft(tenantToken, 'hidden DRAFT');

    const listPath = `/landlord/listings/${listingId}/applications`;
    const detailPath = `/landlord/applications/${submittedDraft.id}`;

    await check(
      'own submitted application appears while DRAFT remains invisible',
      async () => {
        const response = await api(`${listPath}?limit=100`, landlordToken);
        assert.equal(response.status, 200);
        assert.ok(
          response.body.data.some(
            ({ application_id }) => application_id === submittedDraft.id,
          ),
        );
        assert.equal(
          response.body.data.some(
            ({ application_id }) => application_id === controlledDraft.id,
          ),
          false,
        );
        assert.equal(response.body.meta.total, 1);
      },
    );

    await check(
      'guessed DRAFT detail returns privacy-preserving 404',
      async () => {
        const response = await api(
          `/landlord/applications/${controlledDraft.id}`,
          landlordToken,
        );
        assert.equal(response.status, 404);
        assert.equal(response.body.error.code, 'APPLICATION_NOT_FOUND');
      },
    );

    await check(
      'status filters are allowlisted and DRAFT is rejected',
      async () => {
        for (const status of [
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
            `${listPath}?status=${status}`,
            landlordToken,
          );
          assert.equal(response.status, 200);
          assert.ok(response.body.data.every((item) => item.status === status));
        }
        assert.equal(
          (await api(`${listPath}?status=DRAFT`, landlordToken)).status,
          422,
        );
      },
    );

    await check(
      'detail includes answers and actor-free history with minimal identity',
      async () => {
        const response = await api(detailPath, landlordToken);
        assert.equal(response.status, 200);
        assert.equal(
          response.body.data.answers[0].question_text,
          'TASK014 submitted question?',
        );
        assert.equal(
          response.body.data.answers[0].answer_text,
          'TASK014 submitted answer',
        );
        assert.equal(response.body.data.history.length, 1);
        assert.deepEqual(Object.keys(response.body.data.history[0]).sort(), [
          'created_at',
          'from_status',
          'to_status',
        ]);
        assert.deepEqual(Object.keys(response.body.data.tenant).sort(), [
          'first_name',
          'last_name',
          'profile_photo_url',
        ]);
        assert.equal(
          response.body.data.tenant.profile_photo_url,
          'https://images.example.test/task014-profile.jpg',
        );
        assertPrivateFieldsAbsent(response.body);
      },
    );

    await check('cross-landlord and TENANT access are blocked', async () => {
      assert.equal(
        (await api(listPath, otherLandlord.session.access_token)).status,
        404,
      );
      assert.equal(
        (await api(detailPath, otherLandlord.session.access_token)).status,
        404,
      );
      assert.equal((await api(listPath, tenantToken)).status, 403);
      assert.equal((await api(detailPath, tenantToken)).status, 403);
    });

    await check(
      'historical application remains visible after PAUSED and CLOSED',
      async () => {
        for (const status of ['PAUSED', 'CLOSED']) {
          const changed = await privileged
            .from('listings')
            .update({ status })
            .eq('id', listingId);
          assert.equal(changed.error, null);
          const listResponse = await api(listPath, landlordToken);
          const detailResponse = await api(detailPath, landlordToken);
          assert.equal(listResponse.status, 200);
          assert.equal(listResponse.body.data.length, 1);
          assert.equal(detailResponse.status, 200);
          assert.equal(detailResponse.body.data.listing.status, status);
        }
      },
    );

    await check('SUSPENDED landlord is denied and then restored', async () => {
      const suspended = await privileged
        .from('profiles')
        .update({ account_status: 'SUSPENDED' })
        .eq('id', controlledLandlordUserId);
      assert.equal(suspended.error, null);
      try {
        assert.equal((await api(listPath, landlordToken)).status, 403);
      } finally {
        await privileged
          .from('profiles')
          .update({ account_status: 'ACTIVE' })
          .eq('id', controlledLandlordUserId);
      }
    });

    await check(
      'no unsupported landlord state-mutation route exists',
      async () => {
        for (const action of ['under-review', 'accept', 'invite-viewing']) {
          assert.equal(
            (
              await api(
                `/landlord/applications/${submittedDraft.id}/${action}`,
                landlordToken,
                {
                  method: 'POST',
                },
              )
            ).status,
            404,
          );
        }
        assert.equal(
          (
            await api(
              `/applications/${submittedDraft.id}/status`,
              landlordToken,
              { method: 'PATCH' },
            )
          ).status,
          404,
        );
      },
    );

    await check(
      'publishable-key clients cannot directly read applicant tables',
      async () => {
        for (const browser of [
          controlledLandlord.browser,
          submittedTenant.browser,
          anonymous,
        ]) {
          const applications = await browser
            .from('applications')
            .select('*')
            .in('id', applicationIds);
          const answers = await browser
            .from('application_answers')
            .select('*')
            .eq('application_id', submittedDraft.id);
          const history = await browser
            .from('application_status_history')
            .select('*')
            .eq('application_id', submittedDraft.id);
          assert.ok(applications.error || applications.data.length === 0);
          assert.ok(answers.error || answers.data.length === 0);
          assert.ok(history.error || history.data.length === 0);
        }
      },
    );

    console.log(
      `Hosted landlord-application verification passed (${passed.length} checks).`,
    );
    for (const name of passed) console.log(`  PASS ${name}`);
  } finally {
    if (controlledLandlordUserId) {
      await privileged
        .from('profiles')
        .update({ account_status: 'ACTIVE' })
        .eq('id', controlledLandlordUserId);
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
    if (listingId)
      await privileged.from('listings').delete().eq('id', listingId);
    if (propertyId)
      await privileged.from('properties').delete().eq('id', propertyId);
    if (temporaryTenantProfileIds.length) {
      await privileged
        .from('tenant_profiles')
        .delete()
        .in('id', temporaryTenantProfileIds);
    }
    if (temporaryLandlordProfileIds.length) {
      await privileged
        .from('landlord_profiles')
        .delete()
        .in('id', temporaryLandlordProfileIds);
    }
    for (const userId of temporaryUserIds) {
      await privileged.from('profiles').delete().eq('id', userId);
      await privileged.auth.admin.deleteUser(userId);
    }
    await new Promise((resolve) => server.close(resolve));
  }
}
