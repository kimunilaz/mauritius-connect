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
    `Hosted application-answer verification requires: ${missing.join(', ')}.`,
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
  const applicationIds = [];
  let temporaryTenantUserId;
  let temporaryTenantProfileId;

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

  async function insertListing(landlordId, marker, status = 'ACTIVE') {
    const propertyId = randomUUID();
    const listingId = randomUUID();
    propertyIds.push(propertyId);
    listingIds.push(listingId);
    const property = await privileged.from('properties').insert({
      id: propertyId,
      landlord_id: landlordId,
      property_type: 'APARTMENT',
      address_line_1: `TASK011 private address ${marker}`,
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
      title: `TASK011 ${status} ${marker}`,
      description: `Controlled application-answer fixture ${marker}.`,
      monthly_rent: 20000,
      deposit_amount: 20000,
      available_from: '2026-12-01',
      minimum_lease_months: 6,
      maximum_occupants: 3,
      pets_allowed: false,
      status,
      published_at: status === 'ACTIVE' ? new Date().toISOString() : null,
    });
    assert.equal(listing.error, null);
    return listingId;
  }

  async function createQuestion(listingId, token, input) {
    const response = await api(
      `/listings/${listingId}/application-questions`,
      token,
      { method: 'POST', body: input },
    );
    assert.equal(response.status, 201);
    questionIds.push(response.body.data.id);
    return response.body.data;
  }

  try {
    const tenantClient = browserClient();
    const landlordClient = browserClient();
    const tenant = await signIn(
      tenantClient,
      process.env.SUPABASE_TEST_TENANT_EMAIL,
      process.env.SUPABASE_TEST_TENANT_PASSWORD,
      'TENANT',
    );
    const landlord = await signIn(
      landlordClient,
      process.env.SUPABASE_TEST_LANDLORD_EMAIL,
      process.env.SUPABASE_TEST_LANDLORD_PASSWORD,
      'LANDLORD',
    );
    const tenantToken = tenant.session.access_token;
    const landlordToken = landlord.session.access_token;
    const landlordProfile = await privileged
      .from('landlord_profiles')
      .select('id')
      .eq('user_id', landlord.user.id)
      .single();
    assert.equal(landlordProfile.error, null);

    const marker = randomUUID().slice(0, 8);
    const listingId = await insertListing(landlordProfile.data.id, marker);
    const otherListingId = await insertListing(landlordProfile.data.id, marker);

    const temporaryEmail = `task011-${randomUUID()}@example.com`;
    const temporaryPassword = randomBytes(32).toString('base64url');
    const createdUser = await privileged.auth.admin.createUser({
      email: temporaryEmail,
      password: temporaryPassword,
      email_confirm: true,
    });
    assert.equal(createdUser.error, null);
    temporaryTenantUserId = createdUser.data.user.id;
    const secondClient = browserClient();
    const second = await signIn(
      secondClient,
      temporaryEmail,
      temporaryPassword,
      'SECOND_TENANT',
    );
    const secondToken = second.session.access_token;
    const onboarding = await api('/auth/register-profile', secondToken, {
      method: 'POST',
      body: {
        role: 'TENANT',
        first_name: 'Hosted',
        last_name: 'Answer Test',
      },
    });
    assert.equal(onboarding.status, 201);
    const secondProfile = await api('/tenant/profile', secondToken);
    assert.equal(secondProfile.status, 200);
    temporaryTenantProfileId = secondProfile.body.data.id;

    const textQuestion = await createQuestion(listingId, landlordToken, {
      question_text: `TASK011 household ${marker}`,
      question_type: 'TEXT',
      is_required: true,
      display_order: 0,
    });
    const numberQuestion = await createQuestion(listingId, landlordToken, {
      question_text: `TASK011 years ${marker}`,
      question_type: 'NUMBER',
      is_required: false,
      display_order: 1,
    });
    const booleanQuestion = await createQuestion(listingId, landlordToken, {
      question_text: `TASK011 references ${marker}`,
      question_type: 'BOOLEAN',
      is_required: false,
      display_order: 2,
    });
    const dateQuestion = await createQuestion(listingId, landlordToken, {
      question_text: `TASK011 visit ${marker}`,
      question_type: 'DATE',
      is_required: false,
      display_order: 3,
    });
    const selectQuestion = await createQuestion(listingId, landlordToken, {
      question_text: `TASK011 lease ${marker}`,
      question_type: 'SELECT',
      is_required: true,
      display_order: 4,
      options: [
        { option_text: '12 months', display_order: 0 },
        { option_text: '24 months', display_order: 1 },
      ],
    });
    const otherQuestion = await createQuestion(otherListingId, landlordToken, {
      question_text: `TASK011 other ${marker}`,
      question_type: 'TEXT',
      is_required: false,
      display_order: 0,
    });

    const createdDraft = await api(
      `/listings/${listingId}/applications`,
      tenantToken,
      { method: 'POST', body: {} },
    );
    assert.equal(createdDraft.status, 201);
    const applicationId = createdDraft.body.data.id;
    applicationIds.push(applicationId);
    const answerPath = `/applications/${applicationId}/answers`;

    await check('TENANT saves all five validated answer types', async () => {
      const response = await api(answerPath, tenantToken, {
        method: 'PUT',
        body: {
          answers: [
            {
              question_id: textQuestion.id,
              answer_text: '  Quiet household  ',
            },
            { question_id: numberQuestion.id, answer_text: '01.50' },
            { question_id: booleanQuestion.id, answer_text: 'false' },
            { question_id: dateQuestion.id, answer_text: '2027-01-15' },
            { question_id: selectQuestion.id, answer_text: '12 months' },
          ],
        },
      });
      assert.equal(response.status, 200);
      assert.deepEqual(
        response.body.data.map((answer) => answer.answer_text),
        ['Quiet household', '1.5', 'false', '2027-01-15', '12 months'],
      );
      assert.deepEqual(Object.keys(response.body.data[0]), [
        'question_id',
        'answer_text',
        'updated_at',
      ]);
    });

    await check(
      'answer update and explicit clearing persist safely',
      async () => {
        const response = await api(answerPath, tenantToken, {
          method: 'PUT',
          body: {
            answers: [
              {
                question_id: textQuestion.id,
                answer_text: 'Updated household',
              },
              { question_id: numberQuestion.id, answer_text: null },
            ],
          },
        });
        assert.equal(response.status, 200);
        assert.equal(
          response.body.data.find(
            (answer) => answer.question_id === textQuestion.id,
          ).answer_text,
          'Updated household',
        );
        assert.equal(
          response.body.data.some(
            (answer) => answer.question_id === numberQuestion.id,
          ),
          false,
        );
      },
    );

    await check('invalid SELECT text is rejected', async () => {
      const response = await api(answerPath, tenantToken, {
        method: 'PUT',
        body: {
          answers: [
            { question_id: selectQuestion.id, answer_text: 'Invented option' },
          ],
        },
      });
      assert.equal(response.status, 422);
    });

    await check('cross-listing question injection is rejected', async () => {
      const response = await api(answerPath, tenantToken, {
        method: 'PUT',
        body: {
          answers: [{ question_id: otherQuestion.id, answer_text: 'Injected' }],
        },
      });
      assert.equal(response.status, 422);
      assert.equal(response.body.error.code, 'VALIDATION_ERROR');
    });

    await check(
      'cross-tenant and LANDLORD answer access is blocked',
      async () => {
        const otherGet = await api(answerPath, secondToken);
        const otherPut = await api(answerPath, secondToken, {
          method: 'PUT',
          body: { answers: [] },
        });
        const landlordPut = await api(answerPath, landlordToken, {
          method: 'PUT',
          body: { answers: [] },
        });
        assert.equal(otherGet.status, 404);
        assert.equal(otherPut.status, 404);
        assert.equal(landlordPut.status, 403);
      },
    );

    await check('concurrent upserts retain one answer row', async () => {
      const responses = await Promise.all(
        Array.from({ length: 8 }, (_, index) =>
          api(answerPath, tenantToken, {
            method: 'PUT',
            body: {
              answers: [
                {
                  question_id: numberQuestion.id,
                  answer_text: String(index + 1),
                },
              ],
            },
          }),
        ),
      );
      assert.equal(
        responses.every((response) => response.status === 200),
        true,
      );
      const rows = await privileged
        .from('application_answers')
        .select('id', { count: 'exact' })
        .eq('application_id', applicationId)
        .eq('question_id', numberQuestion.id);
      assert.equal(rows.error, null);
      assert.equal(rows.count, 1);
    });

    await check(
      'non-structural question edits preserve the answer',
      async () => {
        for (const body of [
          { question_text: `TASK011 updated wording ${marker}` },
          { display_order: 8 },
          { is_required: false },
        ]) {
          const response = await api(
            `/listings/${listingId}/application-questions/${booleanQuestion.id}`,
            landlordToken,
            { method: 'PATCH', body },
          );
          assert.equal(response.status, 200);
        }
        const row = await privileged
          .from('application_answers')
          .select('answer_text')
          .eq('application_id', applicationId)
          .eq('question_id', booleanQuestion.id)
          .single();
        assert.equal(row.error, null);
        assert.equal(row.data.answer_text, 'false');
      },
    );

    await check(
      'question type change removes the stale DRAFT answer',
      async () => {
        const response = await api(
          `/listings/${listingId}/application-questions/${textQuestion.id}`,
          landlordToken,
          { method: 'PATCH', body: { question_type: 'NUMBER' } },
        );
        assert.equal(response.status, 200);
        const row = await privileged
          .from('application_answers')
          .select('id')
          .eq('application_id', applicationId)
          .eq('question_id', textQuestion.id)
          .maybeSingle();
        assert.equal(row.error, null);
        assert.equal(row.data, null);
      },
    );

    await check(
      'SELECT option removal invalidates only stale text',
      async () => {
        const response = await api(
          `/listings/${listingId}/application-questions/${selectQuestion.id}`,
          landlordToken,
          {
            method: 'PATCH',
            body: {
              options: [{ option_text: '24 months', display_order: 0 }],
            },
          },
        );
        assert.equal(response.status, 200);
        const row = await privileged
          .from('application_answers')
          .select('id')
          .eq('application_id', applicationId)
          .eq('question_id', selectQuestion.id)
          .maybeSingle();
        assert.equal(row.error, null);
        assert.equal(row.data, null);
      },
    );

    await check(
      'question deletion removes the dependent DRAFT answer',
      async () => {
        const response = await api(
          `/listings/${listingId}/application-questions/${dateQuestion.id}`,
          landlordToken,
          { method: 'DELETE' },
        );
        assert.equal(response.status, 204);
        const row = await privileged
          .from('application_answers')
          .select('id')
          .eq('application_id', applicationId)
          .eq('question_id', dateQuestion.id)
          .maybeSingle();
        assert.equal(row.error, null);
        assert.equal(row.data, null);
      },
    );

    await check(
      'tenant reload sees structurally invalidated answers absent',
      async () => {
        const response = await api(answerPath, tenantToken);
        assert.equal(response.status, 200);
        for (const questionId of [
          textQuestion.id,
          selectQuestion.id,
          dateQuestion.id,
        ]) {
          assert.equal(
            response.body.data.some(
              (answer) => answer.question_id === questionId,
            ),
            false,
          );
        }
      },
    );

    await check(
      'unavailable listing blocks PUT while preserving GET',
      async () => {
        const changed = await privileged
          .from('listings')
          .update({ status: 'PAUSED' })
          .eq('id', listingId);
        assert.equal(changed.error, null);
        const putResponse = await api(answerPath, tenantToken, {
          method: 'PUT',
          body: { answers: [] },
        });
        const getResponse = await api(answerPath, tenantToken);
        assert.equal(putResponse.status, 409);
        assert.equal(putResponse.body.error.code, 'LISTING_NOT_AVAILABLE');
        assert.equal(getResponse.status, 200);
        assert.equal(JSON.stringify(getResponse.body).includes(marker), false);
      },
    );

    await check(
      'publishable-key answer access remains denied by RLS',
      async () => {
        const anonymous = browserClient();
        const anonymousRead = await anonymous
          .from('application_answers')
          .select('*');
        const tenantRead = await tenantClient
          .from('application_answers')
          .select('*');
        assert.equal(anonymousRead.error, null);
        assert.deepEqual(anonymousRead.data, []);
        assert.equal(tenantRead.error, null);
        assert.deepEqual(tenantRead.data, []);
        const directInsert = await tenantClient
          .from('application_answers')
          .insert({
            application_id: applicationId,
            question_id: numberQuestion.id,
            answer_text: '999',
          });
        assert.notEqual(directInsert.error, null);
      },
    );

    console.log(
      `Hosted application-answer verification passed: ${passed.length}/${passed.length} checks.`,
    );
    for (const name of passed) console.log(`  PASS ${name}`);
  } finally {
    if (applicationIds.length) {
      await privileged
        .from('application_answers')
        .delete()
        .in('application_id', applicationIds);
      await privileged.from('applications').delete().in('id', applicationIds);
    }
    if (questionIds.length) {
      await privileged
        .from('application_questions')
        .delete()
        .in('id', questionIds);
    }
    if (listingIds.length) {
      await privileged.from('listings').delete().in('id', listingIds);
    }
    if (propertyIds.length) {
      await privileged.from('properties').delete().in('id', propertyIds);
    }
    if (temporaryTenantProfileId) {
      await privileged
        .from('tenant_profiles')
        .delete()
        .eq('id', temporaryTenantProfileId);
    }
    if (temporaryTenantUserId) {
      await privileged
        .from('profiles')
        .delete()
        .eq('id', temporaryTenantUserId);
      await privileged.auth.admin.deleteUser(temporaryTenantUserId);
    }
    await new Promise((resolve) => server.close(resolve));
  }
}
