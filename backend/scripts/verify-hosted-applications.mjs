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
    `Hosted application-draft verification requires: ${missing.join(', ')}.`,
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

  async function insertFixture(
    landlordId,
    marker,
    { status, archived = false },
  ) {
    const propertyId = randomUUID();
    const listingId = randomUUID();
    propertyIds.push(propertyId);
    listingIds.push(listingId);
    const property = await privileged.from('properties').insert({
      id: propertyId,
      landlord_id: landlordId,
      property_type: 'APARTMENT',
      address_line_1: `TASK010 private address ${marker}`,
      address_line_2: 'Never serialize this application fixture field',
      district: 'Moka',
      locality: 'Saint Pierre',
      latitude: -20.220001,
      longitude: 57.530001,
      bedrooms: 2,
      bathrooms: 1,
      furnished: true,
      parking_spaces: 1,
      archived_at: archived ? new Date().toISOString() : null,
    });
    assert.equal(property.error, null);
    const listing = await privileged.from('listings').insert({
      id: listingId,
      property_id: propertyId,
      title: `TASK010 ${status} ${marker}`,
      description: `Private draft fixture description ${marker}.`,
      monthly_rent: 19500,
      deposit_amount: 19500,
      available_from: '2026-11-01',
      minimum_lease_months: 6,
      maximum_occupants: 3,
      pets_allowed: false,
      status,
      published_at: status === 'ACTIVE' ? new Date().toISOString() : null,
    });
    assert.equal(listing.error, null);
    return { propertyId, listingId };
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
    const tenantProfile = await privileged
      .from('tenant_profiles')
      .select('id')
      .eq('user_id', tenant.user.id)
      .single();
    const landlordProfile = await privileged
      .from('landlord_profiles')
      .select('id')
      .eq('user_id', landlord.user.id)
      .single();
    assert.equal(tenantProfile.error, null);
    assert.equal(landlordProfile.error, null);

    const marker = randomUUID().slice(0, 8);
    const active = await insertFixture(landlordProfile.data.id, marker, {
      status: 'ACTIVE',
    });
    const concurrent = await insertFixture(landlordProfile.data.id, marker, {
      status: 'ACTIVE',
    });
    const paused = await insertFixture(landlordProfile.data.id, marker, {
      status: 'PAUSED',
    });
    const archived = await insertFixture(landlordProfile.data.id, marker, {
      status: 'ACTIVE',
      archived: true,
    });

    const temporaryEmail = `task010-${randomUUID()}@example.com`;
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
        last_name: 'Draft Test',
      },
    });
    assert.equal(onboarding.status, 201);
    const secondRoleProfile = await api('/tenant/profile', secondToken);
    assert.equal(secondRoleProfile.status, 200);
    temporaryTenantProfileId = secondRoleProfile.body.data.id;

    const createPath = `/listings/${active.listingId}/applications`;
    let tenantApplicationId;
    await check(
      'TENANT creates a protected DRAFT on an ACTIVE listing',
      async () => {
        const response = await api(createPath, tenantToken, {
          method: 'POST',
          body: {
            move_in_date: '2026-12-01',
            requested_lease_duration_months: 12,
            number_of_occupants: 2,
            introductory_message: `TASK010 tenant draft ${marker}`,
          },
        });
        assert.equal(response.status, 201);
        assert.equal(response.body.data.status, 'DRAFT');
        assert.equal(response.body.meta.editable, true);
        tenantApplicationId = response.body.data.id;
        applicationIds.push(tenantApplicationId);
        const stored = await privileged
          .from('applications')
          .select('tenant_id,status,submitted_at,withdrawn_at')
          .eq('id', tenantApplicationId)
          .single();
        assert.equal(stored.error, null);
        assert.equal(stored.data.tenant_id, tenantProfile.data.id);
        assert.equal(stored.data.status, 'DRAFT');
        assert.equal(stored.data.submitted_at, null);
        assert.equal(stored.data.withdrawn_at, null);
        assert.equal(
          JSON.stringify(response.body).includes('tenant_id'),
          false,
        );
      },
    );

    await check(
      'repeated creation is idempotent and preserves values',
      async () => {
        const response = await api(createPath, tenantToken, {
          method: 'POST',
          body: { introductory_message: 'Must not overwrite existing draft' },
        });
        assert.equal(response.status, 200);
        assert.equal(response.body.data.id, tenantApplicationId);
        assert.equal(
          response.body.data.introductory_message,
          `TASK010 tenant draft ${marker}`,
        );
        const rows = await privileged
          .from('applications')
          .select('id', { count: 'exact' })
          .eq('listing_id', active.listingId)
          .eq('tenant_id', tenantProfile.data.id);
        assert.equal(rows.error, null);
        assert.equal(rows.count, 1);
      },
    );

    await check('concurrent creation resolves to exactly one row', async () => {
      const concurrentPath = `/listings/${concurrent.listingId}/applications`;
      const responses = await Promise.all(
        Array.from({ length: 8 }, () =>
          api(concurrentPath, tenantToken, { method: 'POST', body: {} }),
        ),
      );
      assert.equal(
        responses.every((response) => [200, 201].includes(response.status)),
        true,
      );
      assert.equal(
        new Set(responses.map((response) => response.body.data.id)).size,
        1,
      );
      applicationIds.push(responses[0].body.data.id);
      const rows = await privileged
        .from('applications')
        .select('id', { count: 'exact' })
        .eq('listing_id', concurrent.listingId)
        .eq('tenant_id', tenantProfile.data.id);
      assert.equal(rows.error, null);
      assert.equal(rows.count, 1);
    });

    let secondApplicationId;
    await check('second TENANT gets an independent application', async () => {
      const response = await api(createPath, secondToken, {
        method: 'POST',
        body: { number_of_occupants: 1 },
      });
      assert.equal(response.status, 201);
      secondApplicationId = response.body.data.id;
      applicationIds.push(secondApplicationId);
      const rows = await privileged
        .from('applications')
        .select('tenant_id')
        .eq('listing_id', active.listingId);
      assert.equal(rows.error, null);
      assert.equal(rows.data.length, 2);
      assert.equal(new Set(rows.data.map((row) => row.tenant_id)).size, 2);
    });

    await check('cross-tenant GET and PATCH are hidden', async () => {
      const getResponse = await api(
        `/applications/${tenantApplicationId}`,
        secondToken,
      );
      const patchResponse = await api(
        `/applications/${tenantApplicationId}`,
        secondToken,
        { method: 'PATCH', body: { number_of_occupants: 5 } },
      );
      assert.equal(getResponse.status, 404);
      assert.equal(patchResponse.status, 404);
      const stored = await privileged
        .from('applications')
        .select('number_of_occupants')
        .eq('id', tenantApplicationId)
        .single();
      assert.equal(stored.data.number_of_occupants, 2);
    });

    await check('LANDLORD cannot create a tenant application', async () => {
      const response = await api(createPath, landlordToken, {
        method: 'POST',
        body: {},
      });
      assert.equal(response.status, 403);
    });

    await check(
      'protected fields are rejected and cannot escalate state',
      async () => {
        for (const [path, method] of [
          [createPath, 'POST'],
          [`/applications/${tenantApplicationId}`, 'PATCH'],
        ]) {
          const response = await api(path, tenantToken, {
            method,
            body: {
              tenant_id: temporaryTenantProfileId,
              listing_id: paused.listingId,
              status: 'SUBMITTED',
              submitted_at: new Date().toISOString(),
            },
          });
          assert.equal(response.status, 422);
        }
        const stored = await privileged
          .from('applications')
          .select('tenant_id,listing_id,status,submitted_at')
          .eq('id', tenantApplicationId)
          .single();
        assert.deepEqual(stored.data, {
          tenant_id: tenantProfile.data.id,
          listing_id: active.listingId,
          status: 'DRAFT',
          submitted_at: null,
        });
      },
    );

    await check('allowed DRAFT fields update through owner PATCH', async () => {
      const response = await api(
        `/applications/${tenantApplicationId}`,
        tenantToken,
        {
          method: 'PATCH',
          body: {
            move_in_date: '2027-01-15',
            requested_lease_duration_months: 18,
            number_of_occupants: 3,
            introductory_message: 'Updated hosted draft',
          },
        },
      );
      assert.equal(response.status, 200);
      assert.equal(response.body.data.number_of_occupants, 3);
      assert.equal(response.body.data.status, 'DRAFT');
    });

    await check(
      'new drafts reject non-public and archived listings',
      async () => {
        for (const listingId of [paused.listingId, archived.listingId]) {
          const response = await api(
            `/listings/${listingId}/applications`,
            tenantToken,
            { method: 'POST', body: {} },
          );
          assert.equal(response.status, 404);
          assert.equal(response.body.error.code, 'LISTING_NOT_FOUND');
        }
      },
    );

    await check(
      'unavailable listing preserves safe GET but blocks PATCH',
      async () => {
        const changed = await privileged
          .from('listings')
          .update({ status: 'PAUSED' })
          .eq('id', active.listingId);
        assert.equal(changed.error, null);
        const getResponse = await api(
          `/applications/${tenantApplicationId}`,
          tenantToken,
        );
        assert.equal(getResponse.status, 200);
        assert.equal(getResponse.body.meta.listing_available, false);
        assert.equal(getResponse.body.meta.editable, false);
        assert.deepEqual(Object.keys(getResponse.body.data), [
          'id',
          'listing_id',
          'move_in_date',
          'requested_lease_duration_months',
          'number_of_occupants',
          'introductory_message',
          'status',
          'created_at',
          'updated_at',
          'submitted_at',
          'withdrawn_at',
          'availability',
          'listing',
          'answers',
          'history',
        ]);
        assert.equal(getResponse.body.data.availability, 'UNAVAILABLE');
        assert.equal(getResponse.body.data.listing, null);
        assert.equal(JSON.stringify(getResponse.body).includes(marker), false);
        const patchResponse = await api(
          `/applications/${tenantApplicationId}`,
          tenantToken,
          { method: 'PATCH', body: { number_of_occupants: 1 } },
        );
        assert.equal(patchResponse.status, 409);
        assert.equal(patchResponse.body.error.code, 'LISTING_NOT_AVAILABLE');
        const repeated = await api(createPath, tenantToken, {
          method: 'POST',
          body: {},
        });
        assert.equal(repeated.status, 200);
        assert.equal(repeated.body.data.id, tenantApplicationId);
      },
    );

    await check('existing non-DRAFT blocks another application', async () => {
      const changed = await privileged
        .from('applications')
        .update({ status: 'SUBMITTED', submitted_at: new Date().toISOString() })
        .eq('id', secondApplicationId);
      assert.equal(changed.error, null);
      const response = await api(createPath, secondToken, {
        method: 'POST',
        body: {},
      });
      assert.equal(response.status, 409);
      assert.equal(response.body.error.code, 'APPLICATION_ALREADY_EXISTS');
    });

    await check(
      'publishable-key application reads and writes remain denied by RLS',
      async () => {
        const anonymous = browserClient();
        const anonymousRead = await anonymous.from('applications').select('*');
        const tenantRead = await tenantClient.from('applications').select('*');
        assert.equal(anonymousRead.error, null);
        assert.deepEqual(anonymousRead.data, []);
        assert.equal(tenantRead.error, null);
        assert.deepEqual(tenantRead.data, []);
        const directInsert = await tenantClient.from('applications').insert({
          tenant_id: tenantProfile.data.id,
          listing_id: paused.listingId,
        });
        assert.notEqual(directInsert.error, null);
        const directUpdate = await tenantClient
          .from('applications')
          .update({ number_of_occupants: 99 })
          .eq('id', tenantApplicationId);
        assert.equal(directUpdate.error, null);
        const stored = await privileged
          .from('applications')
          .select('number_of_occupants')
          .eq('id', tenantApplicationId)
          .single();
        assert.equal(stored.data.number_of_occupants, 3);
      },
    );

    console.log(
      `Hosted application-draft verification passed: ${passed.length}/${passed.length} checks.`,
    );
    for (const name of passed) console.log(`  PASS ${name}`);
  } finally {
    if (listingIds.length) {
      await privileged
        .from('applications')
        .delete()
        .in('listing_id', listingIds);
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
