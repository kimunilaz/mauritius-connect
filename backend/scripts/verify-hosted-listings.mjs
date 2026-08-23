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
  console.error(`Hosted listing verification requires: ${missing.join(', ')}.`);
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
  const propertyIds = new Set();
  const storagePaths = new Set();
  let landlordIdentity;
  let tenantIdentity;
  let temporaryLandlordProfileId;
  let createdTemporaryLandlordProfile = false;

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

  async function createProperty(token, marker, locality = 'Moka') {
    const response = await api('/properties', token, {
      method: 'POST',
      body: {
        property_type: 'APARTMENT',
        address_line_1: marker,
        district: 'Moka',
        locality,
        bedrooms: 2,
        bathrooms: 1,
      },
    });
    assert.equal(response.status, 201);
    propertyIds.add(response.body.data.id);
    return response.body.data;
  }

  async function uploadCover(token, propertyId) {
    const buffer = await sharp({
      create: {
        width: 4,
        height: 3,
        channels: 3,
        background: '#3b765a',
      },
    })
      .jpeg()
      .toBuffer();
    const form = new globalThis.FormData();
    form.append(
      'image',
      new globalThis.Blob([buffer], { type: 'image/jpeg' }),
      'listing-cover.jpg',
    );
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
    storagePaths.add(row.data.storage_path);
    return response.body.data;
  }

  function listingInput(propertyId, marker) {
    return {
      property_id: propertyId,
      title: `Hosted listing ${marker}`,
      description: 'Controlled TASK-006 hosted integration listing.',
      monthly_rent: 18000,
      deposit_amount: 18000,
      available_from: '2026-10-01',
      minimum_lease_months: 6,
      maximum_occupants: 3,
      pets_allowed: false,
    };
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
    const marker = randomUUID().slice(0, 8);
    const property = await createProperty(landlordToken, `TASK006 ${marker}`);
    await uploadCover(landlordToken, property.id);
    let listing;

    await check(
      'LANDLORD creates an owned server-controlled DRAFT',
      async () => {
        const response = await api('/listings', landlordToken, {
          method: 'POST',
          body: listingInput(property.id, marker),
        });
        assert.equal(response.status, 201);
        assert.equal(response.body.data.status, 'DRAFT');
        assert.equal(response.body.data.published_at, null);
        listing = response.body.data;
        const stored = await privileged
          .from('listings')
          .select('status,property_id')
          .eq('id', listing.id)
          .single();
        assert.equal(stored.error, null);
        assert.equal(stored.data.status, 'DRAFT');
        assert.equal(stored.data.property_id, property.id);
      },
    );

    await check(
      'owned list, private detail, cover signing, and DRAFT edit work',
      async () => {
        const list = await api(
          '/landlord/listings?status=DRAFT',
          landlordToken,
        );
        assert.equal(list.status, 200);
        assert.ok(list.body.data.some((item) => item.id === listing.id));
        const listItem = list.body.data.find((item) => item.id === listing.id);
        assert.equal(listItem.cover_image.is_cover, true);
        assert.equal(
          (await globalThis.fetch(listItem.cover_image.url)).ok,
          true,
        );

        const detail = await api(
          `/landlord/listings/${listing.id}`,
          landlordToken,
        );
        assert.equal(detail.status, 200);
        assert.equal(detail.body.data.images.length, 1);
        assert.equal('landlord_id' in detail.body.data.property, false);

        const updated = await api(`/listings/${listing.id}`, landlordToken, {
          method: 'PATCH',
          body: {
            title: `Updated hosted listing ${marker}`,
            monthly_rent: 19000,
          },
        });
        assert.equal(updated.status, 200);
        assert.equal(updated.body.data.monthly_rent, 19000);
        assert.equal(updated.body.data.status, 'DRAFT');
      },
    );

    await check('ready DRAFT publishes only to PENDING_REVIEW', async () => {
      const published = await api(
        `/listings/${listing.id}/publish`,
        landlordToken,
        {
          method: 'POST',
        },
      );
      assert.equal(published.status, 200);
      assert.equal(published.body.data.status, 'PENDING_REVIEW');
      assert.notEqual(published.body.data.published_at, null);
      assert.notEqual(published.body.data.status, 'ACTIVE');
      const landlordActivation = await api(
        `/listings/${listing.id}/activate`,
        landlordToken,
        { method: 'POST' },
      );
      assert.equal(landlordActivation.status, 409);
      assert.equal(
        landlordActivation.body.error.code,
        'INVALID_LISTING_TRANSITION',
      );
    });

    await check(
      'live listing blocks duplicate publish and property archive',
      async () => {
        const duplicate = await api('/listings', landlordToken, {
          method: 'POST',
          body: {
            ...listingInput(property.id, `${marker} duplicate`),
            title: `Second draft ${marker}`,
          },
        });
        assert.equal(duplicate.status, 201);
        const conflict = await api(
          `/listings/${duplicate.body.data.id}/publish`,
          landlordToken,
          { method: 'POST' },
        );
        assert.equal(conflict.status, 409);
        assert.equal(conflict.body.error.code, 'LIVE_LISTING_ALREADY_EXISTS');

        const archive = await api(
          `/properties/${property.id}/archive`,
          landlordToken,
          {
            method: 'POST',
          },
        );
        assert.equal(archive.status, 409);
        assert.equal(archive.body.error.code, 'PROPERTY_HAS_LIVE_LISTING');
      },
    );

    await check(
      'publication readiness rejects a property without images',
      async () => {
        const propertyWithoutImage = await createProperty(
          landlordToken,
          `TASK006 no-image ${marker}`,
          'Quatre Bornes',
        );
        const draft = await api('/listings', landlordToken, {
          method: 'POST',
          body: listingInput(propertyWithoutImage.id, `${marker} no image`),
        });
        assert.equal(draft.status, 201);
        const rejected = await api(
          `/listings/${draft.body.data.id}/publish`,
          landlordToken,
          { method: 'POST' },
        );
        assert.equal(rejected.status, 409);
        assert.equal(rejected.body.error.code, 'LISTING_NOT_READY');
        assert.ok(
          rejected.body.error.fields.readiness.includes(
            'PROPERTY_IMAGE_REQUIRED',
          ),
        );
      },
    );

    await check('TENANT listing management remains forbidden', async () => {
      const list = await api('/landlord/listings', tenantToken);
      assert.equal(list.status, 403);
      const create = await api('/listings', tenantToken, {
        method: 'POST',
        body: listingInput(property.id, `${marker} tenant`),
      });
      assert.equal(create.status, 403);
    });

    await check(
      'cross-landlord listing access and actions remain hidden',
      async () => {
        const existingProfile = await privileged
          .from('landlord_profiles')
          .select('id')
          .eq('user_id', tenantIdentity.user.id)
          .maybeSingle();
        assert.equal(existingProfile.error, null);
        if (existingProfile.data) {
          temporaryLandlordProfileId = existingProfile.data.id;
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
        propertyIds.add(foreignPropertyId);
        const foreignProperty = await privileged.from('properties').insert({
          id: foreignPropertyId,
          landlord_id: temporaryLandlordProfileId,
          property_type: 'HOUSE',
          district: 'Flacq',
          locality: 'Centre de Flacq',
          bedrooms: 1,
          bathrooms: 1,
        });
        assert.equal(foreignProperty.error, null);
        const foreignListingId = randomUUID();
        const foreignListing = await privileged.from('listings').insert({
          id: foreignListingId,
          ...listingInput(foreignPropertyId, `${marker} foreign`),
        });
        assert.equal(foreignListing.error, null);

        for (const [method, suffix, body] of [
          ['GET', '', undefined],
          ['PATCH', '', { title: 'Cross-owner attempt' }],
          ['POST', '/publish', undefined],
          ['POST', '/close', undefined],
        ]) {
          const root = method === 'GET' ? '/landlord/listings' : '/listings';
          const response = await api(
            `${root}/${foreignListingId}${suffix}`,
            landlordToken,
            { method, body },
          );
          assert.equal(response.status, 404);
          assert.equal(response.body.error.code, 'LISTING_NOT_FOUND');
        }
      },
    );

    await check(
      'controlled ACTIVE fixture supports pause, edit, and activate',
      async () => {
        const closed = await api(
          `/listings/${listing.id}/close`,
          landlordToken,
          {
            method: 'POST',
          },
        );
        assert.equal(closed.status, 200);
        assert.equal(closed.body.data.status, 'CLOSED');
        const fixture = await privileged
          .from('listings')
          .update({ status: 'ACTIVE', closed_at: null })
          .eq('id', listing.id);
        assert.equal(fixture.error, null);

        const paused = await api(
          `/listings/${listing.id}/pause`,
          landlordToken,
          {
            method: 'POST',
          },
        );
        assert.equal(paused.status, 200);
        assert.equal(paused.body.data.status, 'PAUSED');
        const edited = await api(`/listings/${listing.id}`, landlordToken, {
          method: 'PATCH',
          body: { description: 'Edited safely while paused.' },
        });
        assert.equal(edited.status, 200);
        const activated = await api(
          `/listings/${listing.id}/activate`,
          landlordToken,
          { method: 'POST' },
        );
        assert.equal(activated.status, 200);
        assert.equal(activated.body.data.status, 'ACTIVE');
      },
    );

    await check(
      'close is idempotent and does not archive the property',
      async () => {
        const first = await api(
          `/listings/${listing.id}/close`,
          landlordToken,
          {
            method: 'POST',
          },
        );
        const second = await api(
          `/listings/${listing.id}/close`,
          landlordToken,
          {
            method: 'POST',
          },
        );
        assert.equal(first.status, 200);
        assert.equal(second.status, 200);
        assert.equal(second.body.data.closed_at, first.body.data.closed_at);
        const storedProperty = await privileged
          .from('properties')
          .select('archived_at')
          .eq('id', property.id)
          .single();
        assert.equal(storedProperty.data.archived_at, null);
      },
    );

    await check(
      'publishable clients cannot access listings directly',
      async () => {
        const anonymous = publicClient();
        const anonymousRead = await anonymous.from('listings').select('id');
        const landlordRead = await landlordClient.from('listings').select('id');
        const tenantRead = await tenantClient.from('listings').select('id');
        assert.equal(anonymousRead.error, null);
        assert.deepEqual(anonymousRead.data, []);
        assert.deepEqual(landlordRead.data, []);
        assert.deepEqual(tenantRead.data, []);
      },
    );

    console.log(
      `Hosted listing verification passed: ${passed.length} real integration checks.`,
    );
    for (const name of passed) console.log(`  PASS ${name}`);
  } catch (error) {
    console.error(
      `Hosted listing verification failed: ${error.message || 'unknown safe failure'}`,
    );
    process.exitCode = 1;
  } finally {
    if (landlordIdentity) {
      await privileged
        .from('profiles')
        .update({ account_status: 'ACTIVE' })
        .eq('id', landlordIdentity.user.id);
    }
    for (const propertyId of propertyIds) {
      const imageRows = await privileged
        .from('property_images')
        .select('storage_path')
        .eq('property_id', propertyId);
      for (const row of imageRows.data ?? [])
        storagePaths.add(row.storage_path);
      await privileged.from('listings').delete().eq('property_id', propertyId);
      await privileged
        .from('property_images')
        .delete()
        .eq('property_id', propertyId);
    }
    if (storagePaths.size) {
      await privileged.storage
        .from('property-images')
        .remove([...storagePaths]);
    }
    for (const propertyId of propertyIds) {
      await privileged.from('properties').delete().eq('id', propertyId);
    }
    if (
      createdTemporaryLandlordProfile &&
      temporaryLandlordProfileId &&
      tenantIdentity
    ) {
      const remaining = await privileged
        .from('properties')
        .select('id')
        .eq('landlord_id', temporaryLandlordProfileId);
      if (remaining.data?.length === 0) {
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
