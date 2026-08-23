import assert from 'node:assert/strict';
import console from 'node:console';
import { randomUUID } from 'node:crypto';
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
    `Hosted public-search verification requires: ${missing.join(', ')}.`,
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
  const propertyIds = [];
  const listingIds = new Map();
  const storagePaths = [];

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

  async function uploadImage(token, propertyId, color, name) {
    const buffer = await sharp({
      create: {
        width: 8,
        height: 6,
        channels: 3,
        background: color,
      },
    })
      .jpeg()
      .toBuffer();
    const form = new globalThis.FormData();
    form.append('image', new globalThis.Blob([buffer]), name);
    const response = await api(`/properties/${propertyId}/images`, token, {
      method: 'POST',
      body: form,
    });
    assert.equal(response.status, 201);
    const metadata = await privileged
      .from('property_images')
      .select('storage_path')
      .eq('id', response.body.data.id)
      .single();
    assert.equal(metadata.error, null);
    storagePaths.push(metadata.data.storage_path);
  }

  function assertPrivateFieldsAbsent(value) {
    const serialized = JSON.stringify(value);
    for (const forbidden of [
      'address_line_1',
      'address_line_2',
      'latitude',
      'longitude',
      'landlord_id',
      'landlord_email',
      'landlord_phone',
      'property_id',
      'storage_path',
      'verification_notes',
      'TASK007 exact private address',
    ]) {
      assert.equal(serialized.includes(forbidden), false);
    }
  }

  try {
    const landlordClient = browserClient();
    const tenantClient = browserClient();
    const landlordIdentity = await signIn(
      landlordClient,
      process.env.SUPABASE_TEST_LANDLORD_EMAIL,
      process.env.SUPABASE_TEST_LANDLORD_PASSWORD,
      'LANDLORD',
    );
    const tenantIdentity = await signIn(
      tenantClient,
      process.env.SUPABASE_TEST_TENANT_EMAIL,
      process.env.SUPABASE_TEST_TENANT_PASSWORD,
      'TENANT',
    );
    const landlordToken = landlordIdentity.session.access_token;
    const landlordProfile = await privileged
      .from('landlord_profiles')
      .select('id')
      .eq('user_id', landlordIdentity.user.id)
      .single();
    assert.equal(landlordProfile.error, null);

    const marker = randomUUID().slice(0, 8);
    const fixtureDefinitions = [
      {
        key: 'active_moka',
        status: 'ACTIVE',
        district: 'Moka',
        locality: 'Saint Pierre',
        neighbourhood: 'Helvetia',
        property_type: 'APARTMENT',
        bedrooms: 2,
        bathrooms: 1.5,
        furnished: true,
        parking_spaces: 1,
        monthly_rent: 18000,
        available_from: '2026-10-01',
        pets_allowed: true,
        published_at: '2026-08-20T10:00:00.000Z',
      },
      {
        key: 'active_flacq',
        status: 'ACTIVE',
        district: 'Flacq',
        locality: 'Centre de Flacq',
        neighbourhood: null,
        property_type: 'HOUSE',
        bedrooms: 4,
        bathrooms: 2,
        furnished: false,
        parking_spaces: 2,
        monthly_rent: 28000,
        available_from: '2026-09-15',
        pets_allowed: false,
        published_at: '2026-08-21T10:00:00.000Z',
      },
      ...['PENDING_REVIEW', 'PAUSED', 'CLOSED'].map((status) => ({
        key: status.toLowerCase(),
        status,
        district: 'Moka',
        locality: status,
        neighbourhood: null,
        property_type: 'STUDIO',
        bedrooms: 1,
        bathrooms: 1,
        furnished: false,
        parking_spaces: 0,
        monthly_rent: 12000,
        available_from: '2026-09-01',
        pets_allowed: false,
        published_at: '2026-08-19T10:00:00.000Z',
      })),
      {
        key: 'archived_active',
        status: 'ACTIVE',
        archived: true,
        district: 'Moka',
        locality: 'Archived fixture',
        neighbourhood: null,
        property_type: 'VILLA',
        bedrooms: 5,
        bathrooms: 3,
        furnished: true,
        parking_spaces: 3,
        monthly_rent: 50000,
        available_from: '2026-08-30',
        pets_allowed: true,
        published_at: '2026-08-22T10:00:00.000Z',
      },
    ];

    for (const fixture of fixtureDefinitions) {
      const propertyId = randomUUID();
      const listingId = randomUUID();
      propertyIds.push(propertyId);
      listingIds.set(fixture.key, listingId);
      const property = await privileged.from('properties').insert({
        id: propertyId,
        landlord_id: landlordProfile.data.id,
        property_type: fixture.property_type,
        address_line_1: `TASK007 exact private address ${marker}`,
        address_line_2: `Private fixture ${fixture.key}`,
        district: fixture.district,
        locality: fixture.locality,
        neighbourhood: fixture.neighbourhood,
        latitude: -20.220001,
        longitude: 57.530001,
        bedrooms: fixture.bedrooms,
        bathrooms: fixture.bathrooms,
        furnished: fixture.furnished,
        parking_spaces: fixture.parking_spaces,
        archived_at: fixture.archived ? '2026-08-21T00:00:00.000Z' : null,
      });
      assert.equal(property.error, null);
      const listing = await privileged.from('listings').insert({
        id: listingId,
        property_id: propertyId,
        title: `TASK007 ${fixture.key} ${marker}`,
        description: `Controlled public-search fixture ${marker}.`,
        monthly_rent: fixture.monthly_rent,
        deposit_amount: fixture.monthly_rent,
        available_from: fixture.available_from,
        minimum_lease_months: 6,
        maximum_occupants: Math.max(1, fixture.bedrooms + 1),
        pets_allowed: fixture.pets_allowed,
        status: fixture.status,
        published_at: fixture.published_at,
        closed_at:
          fixture.status === 'CLOSED' ? '2026-08-21T12:00:00.000Z' : null,
      });
      assert.equal(listing.error, null);
    }

    await uploadImage(
      landlordToken,
      propertyIds[0],
      '#28614b',
      'public-cover.jpg',
    );
    await uploadImage(
      landlordToken,
      propertyIds[0],
      '#7d9f91',
      'public-second.jpg',
    );
    await uploadImage(
      landlordToken,
      propertyIds[1],
      '#7a5638',
      'public-house.jpg',
    );

    await check(
      'anonymous search returns only ACTIVE non-archived listings',
      async () => {
        const response = await api(`/listings?neighbourhood=Helvetia`);
        assert.equal(response.status, 200);
        assert.deepEqual(
          response.body.data.map((listing) => listing.id),
          [listingIds.get('active_moka')],
        );
        assertPrivateFieldsAbsent(response.body.data);
      },
    );

    await check(
      'hosted structured filters use documented semantics',
      async () => {
        const response = await api(
          '/listings?district=moka&locality=saint%20pierre&property_type=APARTMENT&min_rent=17000&max_rent=19000&bedrooms=2&bathrooms=1.5&furnished=true&pets_allowed=true&available_from=2026-10-01',
        );
        assert.equal(response.status, 200);
        assert.deepEqual(
          response.body.data.map((listing) => listing.id),
          [listingIds.get('active_moka')],
        );
      },
    );

    await check('hosted sorting is allowlisted and deterministic', async () => {
      const low = await api('/listings?sort=rent_low&limit=100');
      const high = await api('/listings?sort=rent_high&limit=100');
      const soon = await api('/listings?sort=available_soon&limit=100');
      const newest = await api('/listings?sort=newest&limit=100');
      const fixtureOrder = (response) =>
        response.body.data
          .map((item) => item.id)
          .filter((id) =>
            [
              listingIds.get('active_moka'),
              listingIds.get('active_flacq'),
            ].includes(id),
          );
      assert.deepEqual(fixtureOrder(low), [
        listingIds.get('active_moka'),
        listingIds.get('active_flacq'),
      ]);
      assert.deepEqual(fixtureOrder(high), [
        listingIds.get('active_flacq'),
        listingIds.get('active_moka'),
      ]);
      assert.deepEqual(fixtureOrder(soon), [
        listingIds.get('active_flacq'),
        listingIds.get('active_moka'),
      ]);
      assert.deepEqual(fixtureOrder(newest), [
        listingIds.get('active_flacq'),
        listingIds.get('active_moka'),
      ]);
      const invalid = await api('/listings?sort=landlord_id');
      assert.equal(invalid.status, 422);
    });

    await check('hosted pagination returns exact stable metadata', async () => {
      const complete = await api('/listings?sort=rent_low&limit=100');
      const first = await api('/listings?sort=rent_low&page=1&limit=1');
      const second = await api('/listings?sort=rent_low&page=2&limit=1');
      assert.deepEqual(first.body.meta, {
        page: 1,
        limit: 1,
        total: complete.body.meta.total,
        total_pages: complete.body.meta.total,
      });
      assert.equal(first.body.data[0].id, complete.body.data[0].id);
      assert.equal(second.body.data[0].id, complete.body.data[1].id);
    });

    await check(
      'public detail is private-safe with working signed images',
      async () => {
        const response = await api(
          `/listings/${listingIds.get('active_moka')}`,
        );
        assert.equal(response.status, 200);
        assert.equal(response.body.data.images.length, 2);
        assert.equal(response.body.data.images[0].is_cover, true);
        assertPrivateFieldsAbsent(response.body.data);
        for (const image of response.body.data.images) {
          const downloaded = await globalThis.fetch(image.url);
          assert.equal(downloaded.ok, true);
        }
      },
    );

    await check('non-public and archived public detail is hidden', async () => {
      for (const key of [
        'pending_review',
        'paused',
        'closed',
        'archived_active',
      ]) {
        const response = await api(`/listings/${listingIds.get(key)}`);
        assert.equal(response.status, 404);
        assert.equal(response.body.error.code, 'LISTING_NOT_FOUND');
      }
    });

    await check(
      'logged-in users receive the same public visibility',
      async () => {
        const anonymous = await api('/listings?limit=100');
        const tenant = await api(
          '/listings?limit=100',
          tenantIdentity.session.access_token,
        );
        const landlord = await api('/listings?limit=100', landlordToken);
        const ids = (response) =>
          response.body.data.map((listing) => listing.id);
        assert.deepEqual(ids(tenant), ids(anonymous));
        assert.deepEqual(ids(landlord), ids(anonymous));
        for (const response of [anonymous, tenant, landlord]) {
          assert.equal(response.body.meta.total, anonymous.body.meta.total);
          assert.equal(
            response.body.data
              .filter((listing) =>
                [
                  listingIds.get('active_moka'),
                  listingIds.get('active_flacq'),
                ].includes(listing.id),
              )
              .every((listing) =>
                listing.cover_image_url?.startsWith('https://'),
              ),
            true,
          );
          assertPrivateFieldsAbsent(response.body.data);
        }
      },
    );

    await check(
      'private Storage and direct table access remain denied',
      async () => {
        const unsigned = `${process.env.SUPABASE_URL}/storage/v1/object/property-images/${storagePaths[0]}`;
        assert.equal((await globalThis.fetch(unsigned)).ok, false);
        const anonymous = browserClient();
        const directListings = await anonymous.from('listings').select('id');
        const directProperties = await anonymous
          .from('properties')
          .select('id');
        const directImages = await anonymous
          .from('property_images')
          .select('id');
        assert.equal(directListings.error, null);
        assert.equal(directProperties.error, null);
        assert.equal(directImages.error, null);
        assert.equal(directListings.data.length, 0);
        assert.equal(directProperties.data.length, 0);
        assert.equal(directImages.data.length, 0);
      },
    );

    await check('public responses never persist signed URLs', async () => {
      const rows = await privileged
        .from('property_images')
        .select('storage_path')
        .in('property_id', propertyIds);
      assert.equal(rows.error, null);
      assert.equal(rows.data.length, 3);
      assert.equal(
        rows.data.some((row) => row.storage_path.includes('?')),
        false,
      );
      assert.equal(
        rows.data.some((row) => row.storage_path.includes('token')),
        false,
      );
    });
  } finally {
    if (propertyIds.length) {
      await privileged.from('listings').delete().in('property_id', propertyIds);
      await privileged
        .from('property_images')
        .delete()
        .in('property_id', propertyIds);
      if (storagePaths.length) {
        await privileged.storage.from('property-images').remove(storagePaths);
      }
      await privileged.from('properties').delete().in('id', propertyIds);
    }
    await new Promise((resolve) => listener.close(resolve));
  }

  console.log(
    `Hosted public-search verification passed: ${passed.length}/${passed.length} checks.`,
  );
  for (const name of passed) console.log(`  PASS ${name}`);
}
