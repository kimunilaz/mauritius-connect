import assert from 'node:assert/strict';
import console from 'node:console';
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

process.loadEnvFile('backend/.env');
if (existsSync('backend/.env.integration')) {
  process.loadEnvFile('backend/.env.integration');
}

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
    `Hosted application-question verification requires: ${missing.join(', ')}.`,
  );
  process.exitCode = 1;
} else {
  await run();
}

function browserClient() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    },
  );
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
  const privileged = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY,
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    },
  );
  const passed = [];
  const propertyIds = [];
  const listingIds = [];
  const questionIds = [];
  let applicationId;
  let temporaryLandlordUserId;
  let temporaryLandlordProfileId;

  async function check(name, callback) {
    await callback();
    passed.push(name);
  }

  async function signIn(client, email, password, label) {
    const { data, error } = await client.auth.signInWithPassword({
      email,
      password,
    });
    if (error || !data.session?.access_token) {
      const reason = error?.code ?? `HTTP_${error?.status ?? 'UNKNOWN'}`;
      throw new Error(`${label} integration sign-in failed (${reason}).`);
    }
    return data;
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

  async function insertListing(landlordProfileId, marker, status) {
    const propertyId = randomUUID();
    const listingId = randomUUID();
    propertyIds.push(propertyId);
    listingIds.push(listingId);
    const property = await privileged.from('properties').insert({
      id: propertyId,
      landlord_id: landlordProfileId,
      property_type: 'APARTMENT',
      address_line_1: `TASK009 private address ${marker}`,
      district: 'Moka',
      locality: 'Saint Pierre',
      bedrooms: 2,
      bathrooms: 1,
      furnished: true,
      parking_spaces: 1,
    });
    assert.equal(property.error, null);
    const listing = await privileged.from('listings').insert({
      id: listingId,
      property_id: propertyId,
      title: `TASK009 ${status} ${marker}`,
      description: `Controlled application-question fixture ${marker}.`,
      monthly_rent: 19000,
      deposit_amount: 19000,
      available_from: '2026-10-01',
      minimum_lease_months: 6,
      maximum_occupants: 3,
      pets_allowed: false,
      status,
      published_at: status === 'ACTIVE' ? new Date().toISOString() : null,
    });
    assert.equal(listing.error, null);
    return listingId;
  }

  const textInput = (marker, order = 2) => ({
    question_text: `TASK009 move date ${marker}`,
    question_type: 'DATE',
    is_required: true,
    display_order: order,
  });

  try {
    const landlordClient = browserClient();
    const tenantClient = browserClient();
    const landlord = await signIn(
      landlordClient,
      process.env.SUPABASE_TEST_LANDLORD_EMAIL,
      process.env.SUPABASE_TEST_LANDLORD_PASSWORD,
      'LANDLORD',
    );
    const tenant = await signIn(
      tenantClient,
      process.env.SUPABASE_TEST_TENANT_EMAIL,
      process.env.SUPABASE_TEST_TENANT_PASSWORD,
      'TENANT',
    );
    const landlordToken = landlord.session.access_token;
    const tenantToken = tenant.session.access_token;
    const landlordProfile = await privileged
      .from('landlord_profiles')
      .select('id')
      .eq('user_id', landlord.user.id)
      .single();
    const tenantProfile = await privileged
      .from('tenant_profiles')
      .select('id')
      .eq('user_id', tenant.user.id)
      .single();
    assert.equal(landlordProfile.error, null);
    assert.equal(tenantProfile.error, null);

    const marker = randomUUID().slice(0, 8);
    const activeListingId = await insertListing(
      landlordProfile.data.id,
      marker,
      'ACTIVE',
    );
    const draftListingId = await insertListing(
      landlordProfile.data.id,
      marker,
      'DRAFT',
    );

    const temporaryEmail = `task009-${randomUUID()}@example.com`;
    const temporaryPassword = randomBytes(32).toString('base64url');
    const createdUser = await privileged.auth.admin.createUser({
      email: temporaryEmail,
      password: temporaryPassword,
      email_confirm: true,
    });
    assert.equal(createdUser.error, null);
    temporaryLandlordUserId = createdUser.data.user.id;
    const otherClient = browserClient();
    const other = await signIn(
      otherClient,
      temporaryEmail,
      temporaryPassword,
      'SECOND_LANDLORD',
    );
    const otherToken = other.session.access_token;
    const onboarding = await api('/auth/register-profile', otherToken, {
      method: 'POST',
      body: {
        role: 'LANDLORD',
        first_name: 'Hosted',
        last_name: 'Question Test',
      },
    });
    assert.equal(onboarding.status, 201);
    const roleProfile = await api('/landlord/profile', otherToken);
    assert.equal(roleProfile.status, 200);
    temporaryLandlordProfileId = roleProfile.body.data.id;

    const basePath = `/listings/${activeListingId}/application-questions`;
    const ownedPath = `/landlord/listings/${activeListingId}/application-questions`;

    let textQuestion;
    await check('LANDLORD creates an owned question', async () => {
      const response = await api(basePath, landlordToken, {
        method: 'POST',
        body: textInput(marker),
      });
      assert.equal(response.status, 201);
      assert.equal(response.body.data.question_type, 'DATE');
      textQuestion = response.body.data;
      questionIds.push(textQuestion.id);
    });

    let selectQuestion;
    await check('SELECT options persist and serialize in order', async () => {
      const response = await api(basePath, landlordToken, {
        method: 'POST',
        body: {
          question_text: `TASK009 lease duration ${marker}`,
          question_type: 'SELECT',
          is_required: true,
          display_order: 0,
          options: [
            { option_text: '24 months', display_order: 2 },
            { option_text: '12 months', display_order: 0 },
          ],
        },
      });
      assert.equal(response.status, 201);
      selectQuestion = response.body.data;
      questionIds.push(selectQuestion.id);
      assert.deepEqual(
        selectQuestion.options.map((option) => option.option_text),
        ['12 months', '24 months'],
      );
      const stored = await privileged
        .from('application_question_options')
        .select('option_text')
        .eq('question_id', selectQuestion.id);
      assert.equal(stored.error, null);
      assert.equal(stored.data.length, 2);
    });

    await check(
      'owned read is ordered and updates are allowlisted',
      async () => {
        const before = await api(ownedPath, landlordToken);
        assert.equal(before.status, 200);
        assert.deepEqual(
          before.body.data.map((question) => question.id),
          [selectQuestion.id, textQuestion.id],
        );
        const updated = await api(
          `${basePath}/${textQuestion.id}`,
          landlordToken,
          {
            method: 'PATCH',
            body: {
              question_text: `TASK009 updated move date ${marker}`,
              display_order: 1,
            },
          },
        );
        assert.equal(updated.status, 200);
        assert.equal(updated.body.data.display_order, 1);
      },
    );

    await check('cross-landlord and TENANT mutations fail', async () => {
      const cross = await api(`${basePath}/${textQuestion.id}`, otherToken, {
        method: 'PATCH',
        body: { is_required: false },
      });
      assert.equal(cross.status, 404);
      assert.equal(cross.body.error.code, 'LISTING_NOT_FOUND');
      const tenantMutation = await api(basePath, tenantToken, {
        method: 'POST',
        body: textInput(marker, 5),
      });
      assert.equal(tenantMutation.status, 403);
    });

    await check('ACTIVE public read is explicit and privacy-safe', async () => {
      const response = await api(basePath);
      assert.equal(response.status, 200);
      assert.equal(response.body.data.length, 2);
      const serialized = JSON.stringify(response.body);
      for (const forbidden of [
        'listing_id',
        'landlord_id',
        'submitted_at',
        'created_at',
        'updated_at',
        `TASK009 private address ${marker}`,
      ]) {
        assert.equal(serialized.includes(forbidden), false);
      }
    });

    await check('non-public listing questions remain hidden', async () => {
      const response = await api(
        `/listings/${draftListingId}/application-questions`,
      );
      assert.equal(response.status, 404);
      assert.equal(response.body.error.code, 'LISTING_NOT_FOUND');
    });

    let disposableQuestion;
    await check('DRAFT application does not lock mutations', async () => {
      const application = await privileged
        .from('applications')
        .insert({
          listing_id: activeListingId,
          tenant_id: tenantProfile.data.id,
          status: 'DRAFT',
          submitted_at: null,
        })
        .select('id')
        .single();
      assert.equal(application.error, null);
      applicationId = application.data.id;
      const created = await api(basePath, landlordToken, {
        method: 'POST',
        body: textInput(marker, 8),
      });
      assert.equal(created.status, 201);
      disposableQuestion = created.body.data;
      questionIds.push(disposableQuestion.id);
      const updated = await api(
        `${basePath}/${disposableQuestion.id}`,
        landlordToken,
        { method: 'PATCH', body: { display_order: 9 } },
      );
      assert.equal(updated.status, 200);
      const removed = await api(
        `${basePath}/${disposableQuestion.id}`,
        landlordToken,
        { method: 'DELETE' },
      );
      assert.equal(removed.status, 204);
    });

    await check(
      'first submitted application locks every mutation',
      async () => {
        const submitted = await privileged
          .from('applications')
          .update({
            status: 'SUBMITTED',
            submitted_at: new Date().toISOString(),
          })
          .eq('id', applicationId);
        assert.equal(submitted.error, null);
        const attempts = [
          await api(basePath, landlordToken, {
            method: 'POST',
            body: textInput(marker, 10),
          }),
          await api(`${basePath}/${textQuestion.id}`, landlordToken, {
            method: 'PATCH',
            body: { display_order: 10 },
          }),
          await api(`${basePath}/${selectQuestion.id}`, landlordToken, {
            method: 'PATCH',
            body: {
              options: [{ option_text: 'Changed', display_order: 0 }],
            },
          }),
          await api(`${basePath}/${textQuestion.id}`, landlordToken, {
            method: 'DELETE',
          }),
        ];
        for (const response of attempts) {
          assert.equal(response.status, 409);
          assert.equal(
            response.body.error.code,
            'APPLICATION_QUESTIONS_LOCKED',
          );
        }
        const owned = await api(ownedPath, landlordToken);
        assert.equal(owned.body.meta.locked, true);
        assert.equal(owned.body.meta.editable, false);
      },
    );

    await check(
      'publishable-key table access remains denied by RLS',
      async () => {
        const anonymous = browserClient();
        for (const client of [anonymous, tenantClient]) {
          const questions = await client
            .from('application_questions')
            .select('*');
          const options = await client
            .from('application_question_options')
            .select('*');
          assert.equal(questions.error, null);
          assert.deepEqual(questions.data, []);
          assert.equal(options.error, null);
          assert.deepEqual(options.data, []);
        }
        const directWrite = await tenantClient
          .from('application_questions')
          .insert({
            listing_id: activeListingId,
            question_text: 'Direct write must fail',
            question_type: 'TEXT',
            is_required: false,
            display_order: 0,
          });
        assert.notEqual(directWrite.error, null);
      },
    );

    console.log(
      `Hosted application-question verification passed: ${passed.length}/${passed.length} checks.`,
    );
    for (const name of passed) console.log(`  PASS ${name}`);
  } finally {
    if (applicationId) {
      await privileged.from('applications').delete().eq('id', applicationId);
    }
    if (listingIds.length) {
      await privileged
        .from('application_questions')
        .delete()
        .in('listing_id', listingIds);
      await privileged.from('listings').delete().in('id', listingIds);
    }
    if (propertyIds.length) {
      await privileged.from('properties').delete().in('id', propertyIds);
    }
    if (temporaryLandlordProfileId) {
      await privileged
        .from('landlord_profiles')
        .delete()
        .eq('id', temporaryLandlordProfileId);
    }
    if (temporaryLandlordUserId) {
      await privileged
        .from('profiles')
        .delete()
        .eq('id', temporaryLandlordUserId);
      await privileged.auth.admin.deleteUser(temporaryLandlordUserId);
    }
    await new Promise((resolve) => server.close(resolve));
  }
}
