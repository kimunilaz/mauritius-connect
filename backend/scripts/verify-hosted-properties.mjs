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
  console.error(
    `Hosted property verification requires: ${missing.join(', ')}.`,
  );
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
  const apiBaseUrl = `http://127.0.0.1:${listener.address().port}/api/v1`;
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
  const cleanupPropertyIds = new Set();
  let temporaryLandlordProfileId;
  let createdTemporaryLandlordProfile = false;
  let landlordIdentity;
  let tenantIdentity;

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
      throw new Error(
        `${label} controlled integration sign-in failed (${reason}).`,
      );
    }
    return data;
  }

  async function api(path, token, { method = 'GET', body } = {}) {
    const headers = {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await globalThis.fetch(`${apiBaseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null };
  }

  try {
    const landlordClient = publicClient();
    const tenantClient = publicClient();
    landlordIdentity = await signIn(
      landlordClient,
      process.env.SUPABASE_TEST_LANDLORD_EMAIL,
      process.env.SUPABASE_TEST_LANDLORD_PASSWORD,
      'LANDLORD',
    );
    tenantIdentity = await signIn(
      tenantClient,
      process.env.SUPABASE_TEST_TENANT_EMAIL,
      process.env.SUPABASE_TEST_TENANT_PASSWORD,
      'TENANT',
    );
    const landlordToken = landlordIdentity.session.access_token;
    const tenantToken = tenantIdentity.session.access_token;
    const marker = `TASK004 ${randomUUID().slice(0, 8)}`;
    let managedProperty;

    await check(
      'LANDLORD creates a property with server-derived ownership',
      async () => {
        const created = await api('/properties', landlordToken, {
          method: 'POST',
          body: {
            property_type: 'APARTMENT',
            address_line_1: marker,
            address_line_2: null,
            district: 'Moka',
            locality: 'Moka',
            neighbourhood: null,
            latitude: -20.23,
            longitude: 57.5,
            bedrooms: 2,
            bathrooms: 1.5,
            furnished: true,
            parking_spaces: 1,
          },
        });
        assert.equal(created.status, 201);
        assert.equal(created.body.data.verification_status, 'UNVERIFIED');
        assert.equal('landlord_id' in created.body.data, false);
        managedProperty = created.body.data;
        cleanupPropertyIds.add(managedProperty.id);

        const landlordProfile = await privileged
          .from('landlord_profiles')
          .select('id')
          .eq('user_id', landlordIdentity.user.id)
          .single();
        const stored = await privileged
          .from('properties')
          .select('landlord_id')
          .eq('id', managedProperty.id)
          .single();
        assert.equal(stored.error, null);
        assert.equal(stored.data.landlord_id, landlordProfile.data.id);
      },
    );

    await check(
      'LANDLORD lists and retrieves only the owned property',
      async () => {
        const listed = await api(
          '/landlord/properties?archived=false',
          landlordToken,
        );
        assert.equal(listed.status, 200);
        assert.ok(
          listed.body.data.some((item) => item.id === managedProperty.id),
        );
        assert.ok(listed.body.meta.total >= 1);

        const found = await api(
          `/properties/${managedProperty.id}`,
          landlordToken,
        );
        assert.equal(found.status, 200);
        assert.equal(found.body.data.address_line_1, marker);
      },
    );

    await check(
      'LANDLORD updates editable fields while protected fields fail',
      async () => {
        const updated = await api(
          `/properties/${managedProperty.id}`,
          landlordToken,
          {
            method: 'PATCH',
            body: { bathrooms: 2.5, locality: 'Nouvelle Decouverte' },
          },
        );
        assert.equal(updated.status, 200);
        assert.equal(updated.body.data.bathrooms, 2.5);

        for (const protectedBody of [
          { landlord_id: randomUUID() },
          { verification_status: 'VERIFIED' },
          { archived_at: new Date().toISOString() },
        ]) {
          const rejected = await api(
            `/properties/${managedProperty.id}`,
            landlordToken,
            { method: 'PATCH', body: protectedBody },
          );
          assert.equal(rejected.status, 422);
        }
      },
    );

    await check('TENANT cannot create a property', async () => {
      const response = await api('/properties', tenantToken, {
        method: 'POST',
        body: {
          property_type: 'HOUSE',
          district: 'Flacq',
          locality: 'Centre de Flacq',
          bedrooms: 1,
          bathrooms: 1,
        },
      });
      assert.equal(response.status, 403);
      assert.equal(response.body.error.code, 'FORBIDDEN');
    });

    await check(
      'owner-scoped endpoints hide another landlord profile property',
      async () => {
        const existingTemporaryProfile = await privileged
          .from('landlord_profiles')
          .select('id')
          .eq('user_id', tenantIdentity.user.id)
          .maybeSingle();
        assert.equal(existingTemporaryProfile.error, null);

        if (existingTemporaryProfile.data) {
          temporaryLandlordProfileId = existingTemporaryProfile.data.id;
        } else {
          const inserted = await privileged
            .from('landlord_profiles')
            .insert({ user_id: tenantIdentity.user.id })
            .select('id')
            .single();
          assert.equal(inserted.error, null);
          temporaryLandlordProfileId = inserted.data.id;
          createdTemporaryLandlordProfile = true;
        }

        const foreignPropertyId = randomUUID();
        const foreign = await privileged.from('properties').insert({
          id: foreignPropertyId,
          landlord_id: temporaryLandlordProfileId,
          property_type: 'HOUSE',
          address_line_1: marker,
          district: 'Flacq',
          locality: 'Centre de Flacq',
          bedrooms: 1,
          bathrooms: 1,
        });
        assert.equal(foreign.error, null);
        cleanupPropertyIds.add(foreignPropertyId);

        for (const [method, body] of [
          ['GET', undefined],
          ['PATCH', { bedrooms: 3 }],
          ['POST', undefined],
        ]) {
          const suffix = method === 'POST' ? '/archive' : '';
          const response = await api(
            `/properties/${foreignPropertyId}${suffix}`,
            landlordToken,
            { method, body },
          );
          assert.equal(response.status, 404);
          assert.equal(response.body.error.code, 'PROPERTY_NOT_FOUND');
        }
      },
    );

    await check('archive is idempotent and blocks later edits', async () => {
      const first = await api(
        `/properties/${managedProperty.id}/archive`,
        landlordToken,
        {
          method: 'POST',
        },
      );
      const second = await api(
        `/properties/${managedProperty.id}/archive`,
        landlordToken,
        {
          method: 'POST',
        },
      );
      assert.equal(first.status, 200);
      assert.equal(second.status, 200);
      assert.equal(second.body.data.archived_at, first.body.data.archived_at);

      const edit = await api(
        `/properties/${managedProperty.id}`,
        landlordToken,
        {
          method: 'PATCH',
          body: { bedrooms: 4 },
        },
      );
      assert.equal(edit.status, 409);
      assert.equal(edit.body.error.code, 'PROPERTY_ARCHIVED');

      const archivedList = await api(
        '/landlord/properties?archived=true',
        landlordToken,
      );
      assert.ok(
        archivedList.body.data.some((item) => item.id === managedProperty.id),
      );
    });

    await check(
      'SUSPENDED landlord cannot access property management',
      async () => {
        const suspended = await privileged
          .from('profiles')
          .update({ account_status: 'SUSPENDED' })
          .eq('id', landlordIdentity.user.id);
        assert.equal(suspended.error, null);
        try {
          const blocked = await api('/landlord/properties', landlordToken);
          assert.equal(blocked.status, 403);
          assert.equal(blocked.body.error.code, 'ACCOUNT_SUSPENDED');
        } finally {
          const restored = await privileged
            .from('profiles')
            .update({ account_status: 'ACTIVE' })
            .eq('id', landlordIdentity.user.id);
          assert.equal(
            restored.error,
            null,
            'Controlled LANDLORD was not restored.',
          );
        }
      },
    );

    await check(
      'publishable clients remain denied direct property access',
      async () => {
        const anonymous = publicClient();
        const anonymousRead = await anonymous.from('properties').select('id');
        const landlordRead = await landlordClient
          .from('properties')
          .select('id');
        assert.equal(anonymousRead.error, null);
        assert.deepEqual(anonymousRead.data, []);
        assert.equal(landlordRead.error, null);
        assert.deepEqual(landlordRead.data, []);
      },
    );

    console.log(
      `Hosted property verification passed: ${passed.length} real integration checks.`,
    );
    for (const name of passed) console.log(`  PASS ${name}`);
  } catch (error) {
    console.error(
      `Hosted property verification failed: ${error.message || 'unknown safe failure'}`,
    );
    process.exitCode = 1;
  } finally {
    if (landlordIdentity) {
      await privileged
        .from('profiles')
        .update({ account_status: 'ACTIVE' })
        .eq('id', landlordIdentity.user.id);
    }
    for (const propertyId of cleanupPropertyIds) {
      await privileged.from('properties').delete().eq('id', propertyId);
    }
    if (
      createdTemporaryLandlordProfile &&
      temporaryLandlordProfileId &&
      tenantIdentity
    ) {
      const existingProperties = await privileged
        .from('properties')
        .select('id')
        .eq('landlord_id', temporaryLandlordProfileId);
      if (existingProperties.data?.length === 0) {
        await privileged
          .from('landlord_profiles')
          .delete()
          .eq('id', temporaryLandlordProfileId)
          .eq('user_id', tenantIdentity.user.id);
      }
    }
    await new Promise((resolve) => listener.close(resolve));
  }
}
