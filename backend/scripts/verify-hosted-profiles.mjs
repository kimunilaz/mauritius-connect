import assert from 'node:assert/strict';
import console from 'node:console';
import { randomUUID } from 'node:crypto';
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
  console.error(`Hosted profile verification requires: ${missing.join(', ')}.`);
  process.exitCode = 1;
} else {
  await run();
}

function publicClient() {
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
  const listener = await new Promise((resolve, reject) => {
    const server = createApp().listen(0, '127.0.0.1', () => resolve(server));
    server.once('error', reject);
  });
  const baseUrl = `http://127.0.0.1:${listener.address().port}/api/v1`;
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
  let tenantIdentity;
  let landlordIdentity;
  let tenantSnapshot;
  let landlordSnapshot;
  let locationId;

  async function check(name, callback) {
    await callback();
    passed.push(name);
  }

  async function api(path, token, options = {}) {
    const headers = {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    };
    if (options.body !== undefined)
      headers['Content-Type'] = 'application/json';
    const response = await globalThis.fetch(`${baseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null };
  }

  async function signIn(client, email, password, label) {
    const { data, error } = await client.auth.signInWithPassword({
      email,
      password,
    });
    if (error || !data.session?.access_token) {
      const reason = error?.code ?? `HTTP_${error?.status ?? 'UNKNOWN'}`;
      throw new Error(
        `${label} controlled integration sign-in failed (${reason}).`,
      );
    }
    return data;
  }

  try {
    const tenantClient = publicClient();
    const landlordClient = publicClient();
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
    tenantIdentity = tenant;
    landlordIdentity = landlord;
    const tenantToken = tenant.session.access_token;
    const landlordToken = landlord.session.access_token;
    await check(
      'TENANT and LANDLORD role profiles initialize idempotently',
      async () => {
        const firstTenant = await api('/tenant/profile', tenantToken);
        const secondTenant = await api('/tenant/profile', tenantToken);
        assert.equal(firstTenant.status, 200);
        assert.deepEqual(firstTenant.body.data, secondTenant.body.data);
        assert.equal('user_id' in firstTenant.body.data, false);
        tenantSnapshot = firstTenant.body.data;

        const firstLandlord = await api('/landlord/profile', landlordToken);
        const secondLandlord = await api('/landlord/profile', landlordToken);
        assert.equal(firstLandlord.status, 200);
        assert.deepEqual(firstLandlord.body.data, secondLandlord.body.data);
        assert.ok(
          ['UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED'].includes(
            firstLandlord.body.data.verification_status,
          ),
        );
        landlordSnapshot = firstLandlord.body.data;
      },
    );

    await check(
      'cross-role profile access and initialization are blocked',
      async () => {
        assert.equal((await api('/landlord/profile', tenantToken)).status, 403);
        assert.equal((await api('/tenant/profile', landlordToken)).status, 403);
        const tenantCross = await privileged
          .from('landlord_profiles')
          .select('id')
          .eq('user_id', tenant.user.id);
        const landlordCross = await privileged
          .from('tenant_profiles')
          .select('id')
          .eq('user_id', landlord.user.id);
        assert.deepEqual(tenantCross.data, []);
        assert.deepEqual(landlordCross.data, []);
      },
    );

    await check(
      'tenant update validates and rejects protected fields',
      async () => {
        const updated = await api('/tenant/profile', tenantToken, {
          method: 'PATCH',
          body: {
            occupation_type: 'INTEGRATION_TEST',
            preferred_lease_duration_months: 6,
            number_of_occupants: 1,
            has_pets: false,
          },
        });
        assert.equal(updated.status, 200);
        const protectedAttempt = await api('/tenant/profile', tenantToken, {
          method: 'PATCH',
          body: { user_id: landlord.user.id, role: 'LANDLORD' },
        });
        assert.equal(protectedAttempt.status, 422);
        const invalid = await api('/tenant/profile', tenantToken, {
          method: 'PATCH',
          body: { number_of_occupants: 0 },
        });
        assert.equal(invalid.status, 422);
      },
    );

    await check(
      'preferred locations enforce structure, duplicates, and ownership',
      async () => {
        const marker = `Integration ${randomUUID().slice(0, 8)}`;
        const empty = await api('/tenant/preferred-locations', tenantToken, {
          method: 'POST',
          body: { district: ' ', locality: null, neighbourhood: null },
        });
        assert.equal(empty.status, 422);
        const created = await api('/tenant/preferred-locations', tenantToken, {
          method: 'POST',
          body: { district: 'Moka', locality: marker, neighbourhood: null },
        });
        assert.equal(created.status, 201);
        locationId = created.body.data.id;
        const duplicate = await api(
          '/tenant/preferred-locations',
          tenantToken,
          {
            method: 'POST',
            body: {
              district: 'moka',
              locality: marker.toUpperCase(),
              neighbourhood: null,
            },
          },
        );
        assert.equal(duplicate.status, 409);
        assert.equal(
          (
            await api(
              `/tenant/preferred-locations/${locationId}`,
              landlordToken,
              { method: 'DELETE' },
            )
          ).status,
          403,
        );
        const listed = await api('/tenant/preferred-locations', tenantToken);
        assert.ok(listed.body.data.some((item) => item.id === locationId));
        assert.equal(
          (
            await api(
              `/tenant/preferred-locations/${locationId}`,
              tenantToken,
              { method: 'DELETE' },
            )
          ).status,
          204,
        );
        locationId = null;
      },
    );

    await check(
      'landlord base update cannot change verification status',
      async () => {
        const protectedAttempt = await api('/landlord/profile', landlordToken, {
          method: 'PATCH',
          body: { verification_status: 'VERIFIED' },
        });
        assert.equal(protectedAttempt.status, 422);
        const updated = await api('/landlord/profile', landlordToken, {
          method: 'PATCH',
          body: {
            first_name: landlordSnapshot.first_name,
            phone: landlordSnapshot.phone,
          },
        });
        assert.equal(updated.status, 200);
        assert.equal(
          updated.body.data.verification_status,
          landlordSnapshot.verification_status,
        );
      },
    );

    await check('SUSPENDED status blocks role-specific access', async () => {
      const suspended = await privileged
        .from('profiles')
        .update({ account_status: 'SUSPENDED' })
        .eq('id', tenant.user.id);
      if (suspended.error)
        throw new Error('Could not set controlled account status.');
      try {
        const response = await api('/tenant/profile', tenantToken);
        assert.equal(response.status, 403);
        assert.equal(response.body.error.code, 'ACCOUNT_SUSPENDED');
      } finally {
        const restored = await privileged
          .from('profiles')
          .update({ account_status: 'ACTIVE' })
          .eq('id', tenant.user.id);
        assert.equal(
          restored.error,
          null,
          'Could not restore controlled account status.',
        );
      }
    });

    await check(
      'publishable clients cannot access role profile tables directly',
      async () => {
        for (const table of [
          'tenant_profiles',
          'tenant_preferred_locations',
          'landlord_profiles',
        ]) {
          const anonymousRead = await publicClient().from(table).select('id');
          const userRead = await tenantClient.from(table).select('id');
          assert.equal(anonymousRead.error, null);
          assert.deepEqual(anonymousRead.data, []);
          assert.equal(userRead.error, null);
          assert.deepEqual(userRead.data, []);
        }
      },
    );

    console.log(
      `Hosted profile verification passed: ${passed.length} real integration checks.`,
    );
    for (const name of passed) console.log(`  PASS ${name}`);
  } catch (error) {
    console.error(
      `Hosted profile verification failed: ${error.message || 'unknown safe failure'}`,
    );
    process.exitCode = 1;
  } finally {
    if (tenantIdentity) {
      await privileged
        .from('profiles')
        .update({ account_status: 'ACTIVE' })
        .eq('id', tenantIdentity.user.id);
    }
    if (locationId) {
      await privileged
        .from('tenant_preferred_locations')
        .delete()
        .eq('id', locationId);
    }
    if (tenantSnapshot) {
      await privileged
        .from('tenant_profiles')
        .update(tenantSnapshot)
        .eq('user_id', tenantIdentity.user.id);
    }
    if (landlordSnapshot) {
      await privileged
        .from('profiles')
        .update({
          first_name: landlordSnapshot.first_name,
          last_name: landlordSnapshot.last_name,
          phone: landlordSnapshot.phone,
        })
        .eq('id', landlordIdentity.user.id);
    }
    await new Promise((resolve) => listener.close(resolve));
  }
}
