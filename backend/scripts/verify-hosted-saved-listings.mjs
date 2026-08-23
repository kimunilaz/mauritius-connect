import assert from 'node:assert/strict';
import console from 'node:console';
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

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
    `Hosted saved-listing verification requires: ${missing.join(', ')}.`,
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
  const storagePaths = [];
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
    const multipart = body instanceof globalThis.FormData;
    if (body !== undefined && !multipart) {
      headers['Content-Type'] = 'application/json';
    }
    const response = await globalThis.fetch(`${apiBaseUrl}${path}`, {
      method,
      headers,
      body: body === undefined || multipart ? body : JSON.stringify(body),
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null };
  }

  async function insertFixture(
    landlordProfileId,
    marker,
    { status, archived = false },
  ) {
    const propertyId = randomUUID();
    const listingId = randomUUID();
    propertyIds.push(propertyId);
    listingIds.push(listingId);
    const property = await privileged.from('properties').insert({
      id: propertyId,
      landlord_id: landlordProfileId,
      property_type: 'APARTMENT',
      address_line_1: `TASK008 private address ${marker}`,
      address_line_2: 'Never serialize this saved-listing fixture field',
      district: 'Moka',
      locality: 'Saint Pierre',
      neighbourhood: 'Helvetia',
      latitude: -20.220001,
      longitude: 57.530001,
      bedrooms: 2,
      bathrooms: 1.5,
      furnished: true,
      parking_spaces: 1,
      archived_at: archived ? new Date().toISOString() : null,
    });
    assert.equal(property.error, null);
    const listing = await privileged.from('listings').insert({
      id: listingId,
      property_id: propertyId,
      title: `TASK008 ${status} ${marker}`,
      description: `Private description for controlled fixture ${marker}.`,
      monthly_rent: 18500,
      deposit_amount: 18500,
      available_from: '2026-10-01',
      minimum_lease_months: 6,
      maximum_occupants: 3,
      pets_allowed: true,
      status,
      published_at: status === 'ACTIVE' ? new Date().toISOString() : null,
    });
    assert.equal(listing.error, null);
    return { propertyId, listingId };
  }

  async function uploadCover(token, propertyId) {
    const buffer = await sharp({
      create: {
        width: 10,
        height: 8,
        channels: 3,
        background: '#28614b',
      },
    })
      .jpeg()
      .toBuffer();
    const form = new globalThis.FormData();
    form.append('image', new globalThis.Blob([buffer]), 'saved-cover.jpg');
    const response = await api(`/properties/${propertyId}/images`, token, {
      method: 'POST',
      body: form,
    });
    assert.equal(response.status, 201);
    const row = await privileged
      .from('property_images')
      .select('storage_path')
      .eq('id', response.body.data.id)
      .single();
    assert.equal(row.error, null);
    storagePaths.push(row.data.storage_path);
  }

  function findSave(response, listingId) {
    return response.body.data.find((save) => save.listing_id === listingId);
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
    const active = await insertFixture(landlordProfile.data.id, marker, {
      status: 'ACTIVE',
    });
    const paused = await insertFixture(landlordProfile.data.id, marker, {
      status: 'PAUSED',
    });
    const archived = await insertFixture(landlordProfile.data.id, marker, {
      status: 'ACTIVE',
      archived: true,
    });
    await uploadCover(landlordToken, active.propertyId);

    const temporaryEmail = `task008-${randomUUID()}@example.com`;
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
        last_name: 'Save Test',
      },
    });
    assert.equal(onboarding.status, 201);

    await check('TENANT saves an ACTIVE public listing', async () => {
      const response = await api(
        `/listings/${active.listingId}/save`,
        tenantToken,
        {
          method: 'POST',
          body: {},
        },
      );
      assert.equal(response.status, 200);
      assert.deepEqual(response.body.data, {
        listing_id: active.listingId,
        saved: true,
      });
    });

    await check(
      'duplicate save is idempotent and remains one row',
      async () => {
        const response = await api(
          `/listings/${active.listingId}/save`,
          tenantToken,
          {
            method: 'POST',
            body: {},
          },
        );
        assert.equal(response.status, 200);
        const tenantProfile = await privileged
          .from('tenant_profiles')
          .select('id')
          .eq('user_id', tenant.user.id)
          .single();
        assert.equal(tenantProfile.error, null);
        const rows = await privileged
          .from('saved_listings')
          .select('listing_id', { count: 'exact' })
          .eq('tenant_id', tenantProfile.data.id)
          .eq('listing_id', active.listingId);
        assert.equal(rows.error, null);
        assert.equal(rows.count, 1);
      },
    );

    await check(
      'saved list uses the safe public card and signed cover',
      async () => {
        const response = await api(
          '/tenant/saved-listings?limit=100',
          tenantToken,
        );
        assert.equal(response.status, 200);
        const save = findSave(response, active.listingId);
        assert.equal(save.availability, 'AVAILABLE');
        assert.equal(save.listing.id, active.listingId);
        assert.ok(save.listing.cover_image_url.startsWith('https://'));
        assert.equal(
          (await globalThis.fetch(save.listing.cover_image_url)).ok,
          true,
        );
        const serialized = JSON.stringify(save);
        for (const privateField of [
          'address_line_1',
          'address_line_2',
          'latitude',
          'longitude',
          'landlord_id',
          'storage_path',
          `TASK008 private address ${marker}`,
        ]) {
          assert.equal(serialized.includes(privateField), false);
        }
      },
    );

    await check(
      'status is tenant-private and reports the saved relation',
      async () => {
        const first = await api(
          `/tenant/saved-listings/${active.listingId}/status`,
          tenantToken,
        );
        const secondTenantBeforeSave = await api(
          `/tenant/saved-listings/${active.listingId}/status`,
          secondToken,
        );
        assert.equal(first.body.data.saved, true);
        assert.equal(secondTenantBeforeSave.body.data.saved, false);
      },
    );

    await check('second TENANT has independent saved state', async () => {
      const saved = await api(
        `/listings/${active.listingId}/save`,
        secondToken,
        {
          method: 'POST',
          body: {},
        },
      );
      assert.equal(saved.status, 200);
      const profile = await privileged
        .from('tenant_profiles')
        .select('id')
        .eq('user_id', temporaryTenantUserId)
        .single();
      assert.equal(profile.error, null);
      temporaryTenantProfileId = profile.data.id;
      const rows = await privileged
        .from('saved_listings')
        .select('tenant_id')
        .eq('listing_id', active.listingId);
      assert.equal(rows.error, null);
      assert.equal(rows.data.length, 2);
      assert.equal(new Set(rows.data.map((row) => row.tenant_id)).size, 2);
    });

    await check('LANDLORD save attempt is forbidden', async () => {
      const response = await api(
        `/listings/${active.listingId}/save`,
        landlordToken,
        {
          method: 'POST',
          body: {},
        },
      );
      assert.equal(response.status, 403);
      assert.equal(response.body.error.code, 'FORBIDDEN');
    });

    await check(
      'non-public and archived listings cannot be newly saved',
      async () => {
        for (const listingId of [paused.listingId, archived.listingId]) {
          const response = await api(
            `/listings/${listingId}/save`,
            tenantToken,
            {
              method: 'POST',
              body: {},
            },
          );
          assert.equal(response.status, 404);
          assert.equal(response.body.error.code, 'LISTING_NOT_FOUND');
        }
      },
    );

    await check(
      'old save survives PAUSED and CLOSED without private data',
      async () => {
        for (const status of ['PAUSED', 'CLOSED']) {
          const changed = await privileged
            .from('listings')
            .update({
              status,
              closed_at: status === 'CLOSED' ? new Date().toISOString() : null,
            })
            .eq('id', active.listingId);
          assert.equal(changed.error, null);
          const response = await api(
            '/tenant/saved-listings?limit=100',
            tenantToken,
          );
          const save = findSave(response, active.listingId);
          assert.deepEqual(Object.keys(save).sort(), [
            'availability',
            'listing',
            'listing_id',
            'saved_at',
          ]);
          assert.equal(save.availability, 'UNAVAILABLE');
          assert.equal(save.listing, null);
          assert.equal(JSON.stringify(save).includes(marker), false);
        }
        const status = await api(
          `/tenant/saved-listings/${active.listingId}/status`,
          tenantToken,
        );
        assert.equal(status.body.data.saved, true);
      },
    );

    await check('unavailable save can be removed idempotently', async () => {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const removed = await api(
          `/listings/${active.listingId}/save`,
          tenantToken,
          {
            method: 'DELETE',
          },
        );
        assert.equal(removed.status, 204);
      }
      const status = await api(
        `/tenant/saved-listings/${active.listingId}/status`,
        tenantToken,
      );
      assert.equal(status.body.data.saved, false);
      const listing = await privileged
        .from('listings')
        .select('id')
        .eq('id', active.listingId)
        .single();
      assert.equal(listing.error, null);
    });

    await check(
      'publishable-key reads and mutations remain blocked by RLS',
      async () => {
        const anonymous = browserClient();
        const anonymousRead = await anonymous
          .from('saved_listings')
          .select('*');
        const tenantRead = await tenantClient
          .from('saved_listings')
          .select('*');
        assert.equal(anonymousRead.error, null);
        assert.deepEqual(anonymousRead.data, []);
        assert.equal(tenantRead.error, null);
        assert.deepEqual(tenantRead.data, []);
        const before = await privileged
          .from('saved_listings')
          .select('tenant_id', { count: 'exact' })
          .eq('listing_id', active.listingId);
        const directInsert = await tenantClient.from('saved_listings').insert({
          tenant_id: temporaryTenantProfileId,
          listing_id: paused.listingId,
        });
        assert.notEqual(directInsert.error, null);
        const after = await privileged
          .from('saved_listings')
          .select('tenant_id', { count: 'exact' })
          .eq('listing_id', active.listingId);
        assert.equal(after.count, before.count);
      },
    );

    console.log(
      `Hosted saved-listing verification passed: ${passed.length}/${passed.length} checks.`,
    );
    for (const name of passed) console.log(`  PASS ${name}`);
  } finally {
    if (listingIds.length) {
      await privileged
        .from('saved_listings')
        .delete()
        .in('listing_id', listingIds);
      await privileged.from('listings').delete().in('id', listingIds);
    }
    if (propertyIds.length) {
      await privileged
        .from('property_images')
        .delete()
        .in('property_id', propertyIds);
    }
    if (storagePaths.length) {
      await privileged.storage.from('property-images').remove(storagePaths);
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
