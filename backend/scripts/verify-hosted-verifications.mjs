import assert from 'node:assert/strict';
import console from 'node:console';
import process from 'node:process';
import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
process.loadEnvFile('backend/.env');
if (existsSync('backend/.env.integration'))
  process.loadEnvFile('backend/.env.integration');
const required = [
  'SUPABASE_URL',
  'SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SECRET_KEY',
  'SUPABASE_TEST_LANDLORD_EMAIL',
  'SUPABASE_TEST_LANDLORD_PASSWORD',
];
const missing = required.filter((x) => !process.env[x]);
if (missing.length) {
  console.error(
    `Hosted verification verification requires: ${missing.join(', ')}.`,
  );
  process.exitCode = 1;
} else await run();
function c(key) {
  return createClient(process.env.SUPABASE_URL, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
async function run() {
  const { createApp } = await import('../src/app.js');
  const server = await new Promise((resolve, reject) => {
    const l = createApp().listen(0, '127.0.0.1', () => resolve(l));
    l.once('error', reject);
  });
  const base = `http://127.0.0.1:${server.address().port}/api/v1`,
    db = c(process.env.SUPABASE_SECRET_KEY),
    browser = c(process.env.SUPABASE_PUBLISHABLE_KEY);
  const ids = {
    property: randomUUID(),
    listing: randomUUID(),
    verification: null,
    admin: null,
  };
  const api = async (path, token, method = 'GET', body) => {
    const r = await globalThis.fetch(`${base}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ...(body && !(body instanceof globalThis.FormData)
          ? { 'Content-Type': 'application/json' }
          : {}),
      },
      body:
        body instanceof globalThis.FormData
          ? body
          : body === undefined
            ? undefined
            : JSON.stringify(body),
    });
    return { status: r.status, body: await r.json() };
  };
  try {
    const li = await browser.auth.signInWithPassword({
      email: process.env.SUPABASE_TEST_LANDLORD_EMAIL,
      password: process.env.SUPABASE_TEST_LANDLORD_PASSWORD,
    });
    assert.equal(li.error, null);
    const lp = await db
      .from('landlord_profiles')
      .select('id')
      .eq('user_id', li.data.user.id)
      .single();
    assert.equal(lp.error, null);
    const adminEmail = `task021-${randomUUID()}@example.invalid`,
      adminPassword = `T021-${randomUUID()}!aA`;
    const au = await db.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
    });
    assert.equal(au.error, null);
    ids.admin = au.data.user.id;
    assert.equal(
      (
        await db.from('profiles').insert({
          id: ids.admin,
          role: 'ADMIN',
          first_name: 'Task',
          last_name: 'Admin',
        })
      ).error,
      null,
    );
    const ai = await browser.auth.signInWithPassword({
      email: adminEmail,
      password: adminPassword,
    });
    assert.equal(ai.error, null);
    for (const [table, row] of [
      [
        'properties',
        {
          id: ids.property,
          landlord_id: lp.data.id,
          property_type: 'APARTMENT',
          district: 'Moka',
          locality: 'Moka',
          bedrooms: 2,
          bathrooms: 1,
        },
      ],
      [
        'listings',
        {
          id: ids.listing,
          property_id: ids.property,
          title: 'TASK021 fixture',
          description: 'fixture',
          monthly_rent: 20000,
          available_from: '2099-01-01',
          status: 'ACTIVE',
        },
      ],
    ])
      assert.equal((await db.from(table).insert(row)).error, null);
    const created = await api(
      '/landlord/verifications',
      li.data.session.access_token,
      'POST',
      { type: 'PROPERTY_AUTHORITY', property_id: ids.property },
    );
    assert.equal(created.status, 201);
    ids.verification = created.body.data.id;
    const repeated = await api(
      '/landlord/verifications',
      li.data.session.access_token,
      'POST',
      { type: 'PROPERTY_AUTHORITY', property_id: ids.property },
    );
    assert.equal(repeated.status, 201);
    assert.equal(repeated.body.data.id, ids.verification);
    const form = new globalThis.FormData();
    form.append(
      'evidence',
      new globalThis.Blob([Buffer.from('%PDF-1.4 TASK021')], {
        type: 'application/pdf',
      }),
      'evidence.pdf',
    );
    assert.equal(
      (
        await api(
          `/landlord/verifications/${ids.verification}/evidence`,
          li.data.session.access_token,
          'POST',
          form,
        )
      ).status,
      201,
    );
    assert.equal(
      (await api('/admin/verifications', ai.data.session.access_token)).status,
      200,
    );
    assert.equal(
      (
        await api(
          `/admin/verifications/${ids.verification}/approve`,
          ai.data.session.access_token,
          'POST',
          {},
        )
      ).status,
      200,
    );
    const publicListing = await (
      await globalThis.fetch(`${base}/listings/${ids.listing}`)
    ).json();
    assert.equal(publicListing.success, true);
    assert.equal(publicListing.data.property_authority_verified, true);
    console.log(
      'Hosted TASK-021 verification passed: landlord ownership, duplicate reuse, private evidence upload, ADMIN approval, and public trust indicator.',
    );
  } finally {
    if (ids.verification) {
      await db
        .from('admin_audit_logs')
        .delete()
        .eq('target_id', ids.verification);
      await db.from('verification_records').delete().eq('id', ids.verification);
    }
    await db.from('listings').delete().eq('id', ids.listing);
    await db.from('properties').delete().eq('id', ids.property);
    if (ids.admin) {
      await db.from('profiles').delete().eq('id', ids.admin);
      await db.auth.admin.deleteUser(ids.admin);
    }
    server.close();
  }
}
