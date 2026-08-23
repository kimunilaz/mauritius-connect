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
    `Hosted application-submission verification requires: ${missing.join(', ')}.`,
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
  const propertyIds = [];
  const listingIds = [];
  const questionIds = [];
  const applicationIds = [];
  let temporaryUserId;
  let temporaryTenantProfileId;

  async function check(name, callback) {
    await callback();
    passed.push(name);
  }

  async function signIn(email, password, label) {
    const client = supabaseClient(process.env.SUPABASE_PUBLISHABLE_KEY);
    const { data, error } = await client.auth.signInWithPassword({
      email,
      password,
    });
    if (error || !data.session?.access_token) {
      throw new Error(`${label} integration sign-in failed.`);
    }
    return { client, ...data };
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

  async function createListing(landlordId, status = 'ACTIVE') {
    const propertyId = randomUUID();
    const listingId = randomUUID();
    propertyIds.push(propertyId);
    listingIds.push(listingId);
    const property = await privileged.from('properties').insert({
      id: propertyId,
      landlord_id: landlordId,
      property_type: 'APARTMENT',
      address_line_1: 'TASK012 controlled private address',
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
      title: 'TASK012 controlled submission fixture',
      description: 'Disposable hosted application-submission verification.',
      monthly_rent: 24000,
      deposit_amount: 24000,
      available_from: '2026-12-01',
      minimum_lease_months: 6,
      maximum_occupants: 4,
      pets_allowed: false,
      status,
      published_at: status === 'ACTIVE' ? new Date().toISOString() : null,
    });
    assert.equal(listing.error, null);
    return listingId;
  }

  async function createQuestion(listingId, landlordToken, overrides = {}) {
    const response = await api(
      `/listings/${listingId}/application-questions`,
      landlordToken,
      {
        method: 'POST',
        body: {
          question_text: 'Why is this home suitable?',
          question_type: 'TEXT',
          is_required: true,
          display_order: 0,
          ...overrides,
        },
      },
    );
    assert.equal(response.status, 201);
    questionIds.push(response.body.data.id);
    return response.body.data;
  }

  async function createDraft(listingId, tenantToken, overrides = {}) {
    const response = await api(
      `/listings/${listingId}/applications`,
      tenantToken,
      {
        method: 'POST',
        body: {
          move_in_date: '2026-12-01',
          requested_lease_duration_months: 12,
          number_of_occupants: 2,
          introductory_message: 'Controlled TASK012 application.',
          ...overrides,
        },
      },
    );
    assert.ok(response.status === 200 || response.status === 201);
    applicationIds.push(response.body.data.id);
    return response.body.data;
  }

  async function answer(applicationId, questionId, tenantToken, value) {
    const response = await api(
      `/applications/${applicationId}/answers`,
      tenantToken,
      {
        method: 'PUT',
        body: { answers: [{ question_id: questionId, answer_text: value }] },
      },
    );
    assert.equal(response.status, 200);
  }

  async function historyFor(applicationId) {
    const result = await privileged
      .from('application_status_history')
      .select('from_status,to_status,changed_by_user_id')
      .eq('application_id', applicationId)
      .eq('from_status', 'DRAFT')
      .eq('to_status', 'SUBMITTED');
    assert.equal(result.error, null);
    return result.data;
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
    const tenantToken = tenant.session.access_token;
    const landlordToken = landlord.session.access_token;
    const landlordProfile = await privileged
      .from('landlord_profiles')
      .select('id')
      .eq('user_id', landlord.user.id)
      .single();
    assert.equal(landlordProfile.error, null);

    const temporaryEmail = `task012-${randomUUID()}@example.com`;
    const temporaryPassword = randomBytes(32).toString('base64url');
    const createdUser = await privileged.auth.admin.createUser({
      email: temporaryEmail,
      password: temporaryPassword,
      email_confirm: true,
    });
    assert.equal(createdUser.error, null);
    temporaryUserId = createdUser.data.user.id;
    const temporaryProfile = await privileged.from('profiles').insert({
      id: temporaryUserId,
      role: 'TENANT',
      first_name: 'TASK012',
      last_name: 'Other Tenant',
      account_status: 'ACTIVE',
    });
    assert.equal(temporaryProfile.error, null);
    temporaryTenantProfileId = randomUUID();
    const temporaryRole = await privileged.from('tenant_profiles').insert({
      id: temporaryTenantProfileId,
      user_id: temporaryUserId,
    });
    assert.equal(temporaryRole.error, null);
    const otherTenant = await signIn(
      temporaryEmail,
      temporaryPassword,
      'temporary TENANT',
    );

    const mainListing = await createListing(landlordProfile.data.id);
    const mainQuestion = await createQuestion(mainListing, landlordToken);
    const mainApplication = await createDraft(mainListing, tenantToken);
    await answer(
      mainApplication.id,
      mainQuestion.id,
      tenantToken,
      'It is suitable for my household.',
    );

    await check(
      'cross-tenant and LANDLORD submission are blocked',
      async () => {
        const crossTenant = await api(
          `/applications/${mainApplication.id}/submit`,
          otherTenant.session.access_token,
          { method: 'POST' },
        );
        const wrongRole = await api(
          `/applications/${mainApplication.id}/submit`,
          landlordToken,
          { method: 'POST' },
        );
        assert.equal(crossTenant.status, 404);
        assert.equal(wrongRole.status, 403);
      },
    );

    await check(
      'concurrent submission creates one transition and history row',
      async () => {
        const responses = await Promise.all(
          Array.from({ length: 8 }, () =>
            api(`/applications/${mainApplication.id}/submit`, tenantToken, {
              method: 'POST',
            }),
          ),
        );
        assert.ok(responses.every((response) => response.status === 200));
        assert.equal(
          responses.filter((response) => response.body.meta.submitted_now)
            .length,
          1,
        );
        const stored = await privileged
          .from('applications')
          .select('status,submitted_at,withdrawn_at')
          .eq('id', mainApplication.id)
          .single();
        assert.equal(stored.error, null);
        assert.equal(stored.data.status, 'SUBMITTED');
        assert.ok(stored.data.submitted_at);
        assert.equal(stored.data.withdrawn_at, null);
        const history = await historyFor(mainApplication.id);
        assert.equal(history.length, 1);
        assert.equal(history[0].changed_by_user_id, tenant.user.id);
      },
    );

    await check('repeated submission is idempotent', async () => {
      const response = await api(
        `/applications/${mainApplication.id}/submit`,
        tenantToken,
        { method: 'POST' },
      );
      assert.equal(response.status, 200);
      assert.equal(response.body.meta.submitted_now, false);
      assert.equal((await historyFor(mainApplication.id)).length, 1);
    });

    await check(
      'post-submission edits and question mutations are locked',
      async () => {
        const draftEdit = await api(
          `/applications/${mainApplication.id}`,
          tenantToken,
          { method: 'PATCH', body: { number_of_occupants: 3 } },
        );
        const answerEdit = await api(
          `/applications/${mainApplication.id}/answers`,
          tenantToken,
          {
            method: 'PUT',
            body: {
              answers: [
                { question_id: mainQuestion.id, answer_text: 'Changed' },
              ],
            },
          },
        );
        const questionEdit = await api(
          `/listings/${mainListing}/application-questions/${mainQuestion.id}`,
          landlordToken,
          { method: 'PATCH', body: { question_text: 'Changed?' } },
        );
        assert.equal(draftEdit.status, 409);
        assert.equal(answerEdit.status, 409);
        assert.equal(questionEdit.status, 409);
        assert.equal(
          questionEdit.body.error.code,
          'APPLICATION_QUESTIONS_LOCKED',
        );
      },
    );

    await check(
      'required core and current required questions are enforced',
      async () => {
        const coreListing = await createListing(landlordProfile.data.id);
        const coreDraft = await createDraft(coreListing, tenantToken, {
          move_in_date: null,
        });
        const coreResponse = await api(
          `/applications/${coreDraft.id}/submit`,
          tenantToken,
          { method: 'POST' },
        );
        assert.equal(coreResponse.status, 422);
        assert.ok(
          coreResponse.body.error.fields.missing_fields.includes(
            'move_in_date',
          ),
        );

        const requiredListing = await createListing(landlordProfile.data.id);
        const requiredQuestion = await createQuestion(
          requiredListing,
          landlordToken,
        );
        const requiredDraft = await createDraft(requiredListing, tenantToken);
        const requiredResponse = await api(
          `/applications/${requiredDraft.id}/submit`,
          tenantToken,
          { method: 'POST' },
        );
        assert.equal(requiredResponse.status, 422);
        assert.ok(
          requiredResponse.body.error.fields.missing_question_ids.includes(
            requiredQuestion.id,
          ),
        );
      },
    );

    await check(
      'an unanswered optional question can be submitted',
      async () => {
        const listingId = await createListing(landlordProfile.data.id);
        await createQuestion(listingId, landlordToken, { is_required: false });
        const draft = await createDraft(listingId, tenantToken);
        const response = await api(
          `/applications/${draft.id}/submit`,
          tenantToken,
          {
            method: 'POST',
          },
        );
        assert.equal(response.status, 200);
      },
    );

    await check(
      'listing unavailability is rechecked at submission',
      async () => {
        const listingId = await createListing(landlordProfile.data.id);
        const draft = await createDraft(listingId, tenantToken);
        const paused = await privileged
          .from('listings')
          .update({ status: 'PAUSED' })
          .eq('id', listingId);
        assert.equal(paused.error, null);
        const response = await api(
          `/applications/${draft.id}/submit`,
          tenantToken,
          {
            method: 'POST',
          },
        );
        assert.equal(response.status, 409);
        assert.equal(response.body.error.code, 'LISTING_NOT_AVAILABLE');
      },
    );

    await check(
      'mutation-first submission validates the resulting structure',
      async () => {
        const listingId = await createListing(landlordProfile.data.id);
        const currentQuestion = await createQuestion(listingId, landlordToken);
        const draft = await createDraft(listingId, tenantToken);
        await answer(draft.id, currentQuestion.id, tenantToken, 'Text answer');
        const mutation = await api(
          `/listings/${listingId}/application-questions/${currentQuestion.id}`,
          landlordToken,
          { method: 'PATCH', body: { question_type: 'NUMBER' } },
        );
        assert.equal(mutation.status, 200);
        const submission = await api(
          `/applications/${draft.id}/submit`,
          tenantToken,
          {
            method: 'POST',
          },
        );
        assert.equal(submission.status, 422);
        assert.equal(submission.body.error.code, 'APPLICATION_INCOMPLETE');
      },
    );

    await check(
      'simultaneous structural mutation and submission are safely serialized',
      async () => {
        const listingId = await createListing(landlordProfile.data.id);
        const currentQuestion = await createQuestion(listingId, landlordToken);
        const draft = await createDraft(listingId, tenantToken);
        await answer(draft.id, currentQuestion.id, tenantToken, 'Text answer');
        const [submission, mutation] = await Promise.all([
          api(`/applications/${draft.id}/submit`, tenantToken, {
            method: 'POST',
          }),
          api(
            `/listings/${listingId}/application-questions/${currentQuestion.id}`,
            landlordToken,
            { method: 'PATCH', body: { question_type: 'NUMBER' } },
          ),
        ]);
        const submissionWon = submission.status === 200;
        if (submissionWon) {
          assert.equal(mutation.status, 409);
          assert.equal(
            mutation.body.error.code,
            'APPLICATION_QUESTIONS_LOCKED',
          );
        } else {
          assert.equal(submission.status, 422);
          assert.equal(mutation.status, 200);
          assert.equal(submission.body.error.code, 'APPLICATION_INCOMPLETE');
        }
      },
    );

    await check(
      'publishable-key clients cannot bypass the Node API',
      async () => {
        const directAnonymous = await anonymous.rpc(
          'submit_application_transaction',
          {
            p_application_id: mainApplication.id,
            p_tenant_id: temporaryTenantProfileId,
            p_actor_user_id: temporaryUserId,
          },
        );
        const directAuthenticated = await tenant.client.rpc(
          'submit_application_transaction',
          {
            p_application_id: mainApplication.id,
            p_tenant_id: temporaryTenantProfileId,
            p_actor_user_id: temporaryUserId,
          },
        );
        const applicationWrite = await tenant.client
          .from('applications')
          .update({ status: 'ACCEPTED' })
          .eq('id', mainApplication.id)
          .select('id');
        const historyWrite = await tenant.client
          .from('application_status_history')
          .insert({
            application_id: mainApplication.id,
            from_status: 'SUBMITTED',
            to_status: 'ACCEPTED',
            changed_by_user_id: tenant.user.id,
          });
        assert.ok(directAnonymous.error);
        assert.ok(directAuthenticated.error);
        assert.ok(applicationWrite.error || applicationWrite.data.length === 0);
        assert.ok(historyWrite.error);
        const unchanged = await privileged
          .from('applications')
          .select('status')
          .eq('id', mainApplication.id)
          .single();
        assert.equal(unchanged.data.status, 'SUBMITTED');
      },
    );

    console.log(
      `Hosted application-submission verification passed (${passed.length} checks).`,
    );
    for (const name of passed) console.log(`  PASS ${name}`);
  } finally {
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
    if (temporaryUserId) {
      await privileged.from('profiles').delete().eq('id', temporaryUserId);
      await privileged.auth.admin.deleteUser(temporaryUserId);
    }
    await new Promise((resolve) => server.close(resolve));
  }
}
