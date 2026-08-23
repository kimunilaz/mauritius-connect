import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
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
    `Hosted property-image verification requires: ${missing.join(', ')}.`,
  );
  process.exitCode = 1;
} else {
  await run();
}

function client(key) {
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
  const baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`;
  const privileged = client(process.env.SUPABASE_SECRET_KEY);
  const landlordClient = client(process.env.SUPABASE_PUBLISHABLE_KEY);
  const tenantClient = client(process.env.SUPABASE_PUBLISHABLE_KEY);
  const anonymousClient = client(process.env.SUPABASE_PUBLISHABLE_KEY);
  const propertyIds = new Set();
  const extraStoragePaths = new Set();
  const passed = [];
  let temporaryLandlordProfileId;
  let createdTemporaryLandlordProfile = false;
  let landlordIdentity;
  let tenantIdentity;

  async function check(name, callback) {
    await callback();
    passed.push(name);
  }

  async function signIn(publicClient, email, password, label) {
    const { data, error } = await publicClient.auth.signInWithPassword({
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
    const response = await globalThis.fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined || multipart ? body : JSON.stringify(body),
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null };
  }

  async function upload(propertyId, token, buffer, filename, mimeType) {
    const form = new globalThis.FormData();
    form.append(
      'image',
      new globalThis.Blob([buffer], { type: mimeType }),
      filename,
    );
    return api(`/properties/${propertyId}/images`, token, {
      method: 'POST',
      body: form,
    });
  }

  try {
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
    const marker = `TASK005 ${randomUUID().slice(0, 8)}`;
    let property;
    let uploaded = [];

    await check('private bucket configuration is exact', async () => {
      const { data, error } =
        await privileged.storage.getBucket('property-images');
      assert.equal(error, null);
      assert.equal(data.public, false);
      assert.equal(Number(data.file_size_limit), 10 * 1024 * 1024);
      assert.deepEqual(
        [...data.allowed_mime_types].sort(),
        ['image/jpeg', 'image/png', 'image/webp'].sort(),
      );
    });

    await check(
      'owned property is created through the verified API',
      async () => {
        const response = await api('/properties', landlordToken, {
          method: 'POST',
          body: {
            property_type: 'APARTMENT',
            address_line_1: marker,
            district: 'Moka',
            locality: 'Moka',
            bedrooms: 2,
            bathrooms: 1,
          },
        });
        assert.equal(response.status, 201);
        property = response.body.data;
        propertyIds.add(property.id);
      },
    );

    await check(
      'real JPEG, PNG, and WebP uploads are sanitized and privately stored',
      async () => {
        const base = sharp({
          create: {
            width: 12,
            height: 8,
            channels: 3,
            background: '#4f866d',
          },
        });
        const sources = [
          {
            buffer: await base
              .clone()
              .jpeg()
              .withMetadata({ orientation: 6 })
              .toBuffer(),
            filename: '../../forged.exe',
            mime: 'application/octet-stream',
          },
          {
            buffer: await base.clone().png().toBuffer(),
            filename: 'photo.png',
            mime: 'image/png',
          },
          {
            buffer: await base.clone().webp().toBuffer(),
            filename: 'photo.webp',
            mime: 'image/webp',
          },
        ];
        for (const source of sources) {
          const response = await upload(
            property.id,
            landlordToken,
            source.buffer,
            source.filename,
            source.mime,
          );
          assert.equal(response.status, 201);
          uploaded.push(response.body.data);
        }
        assert.deepEqual(
          uploaded.map((image) => image.display_order),
          [0, 1, 2],
        );
        assert.deepEqual(
          uploaded.map((image) => image.is_cover),
          [true, false, false],
        );

        const rows = await privileged
          .from('property_images')
          .select('id,storage_path,display_order,is_cover')
          .eq('property_id', property.id)
          .order('display_order');
        assert.equal(rows.error, null);
        assert.equal(rows.data.length, 3);
        for (const row of rows.data) {
          assert.match(
            row.storage_path,
            new RegExp(
              `^${landlordIdentity.user.id}/${property.id}/[a-f0-9-]+\\.(jpg|png|webp)$`,
            ),
          );
          assert.equal(row.storage_path.includes('forged'), false);
        }
        const jpegRow = rows.data.find((row) =>
          row.storage_path.endsWith('.jpg'),
        );
        const downloaded = await privileged.storage
          .from('property-images')
          .download(jpegRow.storage_path);
        assert.equal(downloaded.error, null);
        const metadata = await sharp(
          Buffer.from(await downloaded.data.arrayBuffer()),
        ).metadata();
        assert.equal(metadata.exif, undefined);
        assert.equal(metadata.orientation, undefined);
      },
    );

    await check(
      'signed URLs work while unsigned private reads fail',
      async () => {
        for (const image of uploaded) {
          const response = await globalThis.fetch(image.url);
          assert.equal(response.ok, true);
        }
        const row = await privileged
          .from('property_images')
          .select('storage_path')
          .eq('id', uploaded[0].id)
          .single();
        const denied = await landlordClient.storage
          .from('property-images')
          .download(row.data.storage_path);
        assert.notEqual(denied.error, null);
      },
    );

    await check(
      'invalid and oversized payloads are rejected without rows',
      async () => {
        const before = await privileged
          .from('property_images')
          .select('id', { count: 'exact' })
          .eq('property_id', property.id);
        const invalid = await upload(
          property.id,
          landlordToken,
          Buffer.from('<html>not an image</html>'),
          'fake.jpg',
          'image/jpeg',
        );
        assert.equal(invalid.status, 422);
        const oversized = await upload(
          property.id,
          landlordToken,
          Buffer.alloc(10 * 1024 * 1024 + 1),
          'large.jpg',
          'image/jpeg',
        );
        assert.equal(oversized.status, 413);
        const after = await privileged
          .from('property_images')
          .select('id', { count: 'exact' })
          .eq('property_id', property.id);
        assert.equal(after.count, before.count);
      },
    );

    await check('cover and order mutations remain owner-scoped', async () => {
      const cover = await api(
        `/properties/${property.id}/images/${uploaded[1].id}`,
        landlordToken,
        { method: 'PATCH', body: { is_cover: true } },
      );
      assert.equal(cover.status, 200);
      assert.equal(cover.body.data.is_cover, true);
      const reordered = await api(
        `/properties/${property.id}/images/${uploaded[2].id}`,
        landlordToken,
        { method: 'PATCH', body: { display_order: 9 } },
      );
      assert.equal(reordered.status, 200);
      assert.equal(reordered.body.data.display_order, 9);
      for (const body of [
        { is_cover: false },
        { storage_path: 'attacker/path' },
        { property_id: randomUUID() },
      ]) {
        const denied = await api(
          `/properties/${property.id}/images/${uploaded[0].id}`,
          landlordToken,
          { method: 'PATCH', body },
        );
        assert.equal(denied.status, 422);
      }
      const covers = await privileged
        .from('property_images')
        .select('id')
        .eq('property_id', property.id)
        .eq('is_cover', true);
      assert.equal(covers.data.length, 1);
      assert.equal(covers.data[0].id, uploaded[1].id);
    });

    await check(
      'TENANT and SUSPENDED landlord uploads are blocked',
      async () => {
        const tiny = await sharp({
          create: { width: 2, height: 2, channels: 3, background: '#000' },
        })
          .jpeg()
          .toBuffer();
        const tenant = await upload(
          property.id,
          tenantToken,
          tiny,
          'tenant.jpg',
          'image/jpeg',
        );
        assert.equal(tenant.status, 403);

        const suspended = await privileged
          .from('profiles')
          .update({ account_status: 'SUSPENDED' })
          .eq('id', landlordIdentity.user.id);
        assert.equal(suspended.error, null);
        try {
          const blocked = await upload(
            property.id,
            landlordToken,
            tiny,
            'blocked.jpg',
            'image/jpeg',
          );
          assert.equal(blocked.status, 403);
          assert.equal(blocked.body.error.code, 'ACCOUNT_SUSPENDED');
        } finally {
          const restored = await privileged
            .from('profiles')
            .update({ account_status: 'ACTIVE' })
            .eq('id', landlordIdentity.user.id);
          assert.equal(restored.error, null);
        }
      },
    );

    await check(
      'cross-landlord image upload and mutation are hidden',
      async () => {
        const existing = await privileged
          .from('landlord_profiles')
          .select('id')
          .eq('user_id', tenantIdentity.user.id)
          .maybeSingle();
        assert.equal(existing.error, null);
        if (existing.data) {
          temporaryLandlordProfileId = existing.data.id;
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
        const created = await privileged.from('properties').insert({
          id: foreignPropertyId,
          landlord_id: temporaryLandlordProfileId,
          property_type: 'HOUSE',
          district: 'Flacq',
          locality: 'Centre de Flacq',
          bedrooms: 1,
          bathrooms: 1,
        });
        assert.equal(created.error, null);
        const foreignPath = `${tenantIdentity.user.id}/${foreignPropertyId}/${randomUUID()}.jpg`;
        extraStoragePaths.add(foreignPath);
        const foreignObject = await privileged.storage
          .from('property-images')
          .upload(foreignPath, Buffer.from('private object'), {
            contentType: 'image/jpeg',
            upsert: false,
          });
        assert.equal(foreignObject.error, null);
        const foreignImageId = randomUUID();
        const foreignRow = await privileged.from('property_images').insert({
          id: foreignImageId,
          property_id: foreignPropertyId,
          storage_path: foreignPath,
          display_order: 0,
          is_cover: true,
        });
        assert.equal(foreignRow.error, null);

        const tiny = await sharp({
          create: { width: 2, height: 2, channels: 3, background: '#fff' },
        })
          .png()
          .toBuffer();
        const deniedUpload = await upload(
          foreignPropertyId,
          landlordToken,
          tiny,
          'cross.png',
          'image/png',
        );
        assert.equal(deniedUpload.status, 404);
        for (const method of ['PATCH', 'DELETE']) {
          const denied = await api(
            `/properties/${foreignPropertyId}/images/${foreignImageId}`,
            landlordToken,
            {
              method,
              body: method === 'PATCH' ? { is_cover: true } : undefined,
            },
          );
          assert.equal(denied.status, 404);
        }
      },
    );

    await check(
      'publishable clients cannot mutate private Storage directly',
      async () => {
        const protectedRow = await privileged
          .from('property_images')
          .select('storage_path')
          .eq('id', uploaded[0].id)
          .single();
        assert.equal(protectedRow.error, null);
        for (const [label, storageClient] of [
          ['anonymous', anonymousClient],
          ['landlord', landlordClient],
          ['tenant', tenantClient],
        ]) {
          const path = `direct-denied/${label}-${randomUUID()}.jpg`;
          const direct = await storageClient.storage
            .from('property-images')
            .upload(path, Buffer.from('not allowed'), {
              contentType: 'image/jpeg',
              upsert: false,
            });
          if (!direct.error) extraStoragePaths.add(path);
          assert.notEqual(direct.error, null);
          const read = await storageClient.storage
            .from('property-images')
            .download(protectedRow.data.storage_path);
          assert.notEqual(read.error, null);
          await storageClient.storage
            .from('property-images')
            .remove([protectedRow.data.storage_path]);
          const stillPresent = await privileged.storage
            .from('property-images')
            .download(protectedRow.data.storage_path);
          assert.equal(stillPresent.error, null);
        }
      },
    );

    await check(
      'deleting a cover removes object and promotes replacement',
      async () => {
        const row = await privileged
          .from('property_images')
          .select('storage_path')
          .eq('id', uploaded[1].id)
          .single();
        const deleted = await api(
          `/properties/${property.id}/images/${uploaded[1].id}`,
          landlordToken,
          { method: 'DELETE' },
        );
        assert.equal(deleted.status, 200);
        assert.equal(deleted.body.data.length, 2);
        assert.equal(
          deleted.body.data.filter((image) => image.is_cover).length,
          1,
        );
        const missingRow = await privileged
          .from('property_images')
          .select('id')
          .eq('id', uploaded[1].id)
          .maybeSingle();
        assert.equal(missingRow.data, null);
        const missingObject = await privileged.storage
          .from('property-images')
          .download(row.data.storage_path);
        assert.notEqual(missingObject.error, null);
        uploaded = deleted.body.data;
      },
    );

    await check(
      'archived properties retain viewable images but reject uploads',
      async () => {
        const archived = await api(
          `/properties/${property.id}/archive`,
          landlordToken,
          {
            method: 'POST',
          },
        );
        assert.equal(archived.status, 200);
        const tiny = await sharp({
          create: { width: 2, height: 2, channels: 3, background: '#333' },
        })
          .webp()
          .toBuffer();
        const rejected = await upload(
          property.id,
          landlordToken,
          tiny,
          'archived.webp',
          'image/webp',
        );
        assert.equal(rejected.status, 409);
        assert.equal(rejected.body.error.code, 'PROPERTY_ARCHIVED');
        const detail = await api(`/properties/${property.id}`, landlordToken);
        assert.equal(detail.status, 200);
        assert.equal(detail.body.data.images.length, 2);
        assert.equal(
          (await globalThis.fetch(detail.body.data.images[0].url)).ok,
          true,
        );
      },
    );

    console.log(
      `Hosted property-image verification passed: ${passed.length} real integration checks.`,
    );
    for (const name of passed) console.log(`  PASS ${name}`);
  } catch (error) {
    console.error(
      `Hosted property-image verification failed: ${error.message || 'unknown safe failure'}`,
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
      const rows = await privileged
        .from('property_images')
        .select('storage_path')
        .eq('property_id', propertyId);
      const paths = rows.data?.map((row) => row.storage_path) ?? [];
      if (paths.length) {
        await privileged.storage.from('property-images').remove(paths);
      }
      await privileged
        .from('property_images')
        .delete()
        .eq('property_id', propertyId);
      await privileged.from('properties').delete().eq('id', propertyId);
    }
    if (extraStoragePaths.size) {
      await privileged.storage
        .from('property-images')
        .remove([...extraStoragePaths]);
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
    await new Promise((resolve) => server.close(resolve));
  }
}
