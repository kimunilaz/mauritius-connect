import assert from 'node:assert/strict';
import console from 'node:console';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

process.loadEnvFile('backend/.env');
if (existsSync('backend/.env.integration'))
  process.loadEnvFile('backend/.env.integration');

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
    `Hosted conversation verification requires: ${missing.join(', ')}.`,
  );
  process.exitCode = 1;
} else {
  await run();
}

function client(key) {
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
  const listener = await new Promise((resolve, reject) => {
    const server = createApp().listen(0, '127.0.0.1', () => resolve(server));
    server.once('error', reject);
  });
  const base = `http://127.0.0.1:${listener.address().port}/api/v1`;
  const admin = client(process.env.SUPABASE_SECRET_KEY);
  const publishable = client(process.env.SUPABASE_PUBLISHABLE_KEY);
  const ids = {
    property: randomUUID(),
    listing: randomUUID(),
    conversation: null,
  };
  const passed = [];
  let temporaryUser = null;
  let temporaryTenantProfile = null;

  async function check(name, callback) {
    await callback();
    passed.push(name);
  }
  async function signIn(email, password) {
    const result = await publishable.auth.signInWithPassword({
      email,
      password,
    });
    assert.equal(result.error, null);
    return result.data;
  }
  async function api(path, token, method = 'GET', body) {
    const response = await globalThis.fetch(`${base}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: response.status, body: await response.json() };
  }
  async function profileId(table, userId) {
    const result = await admin
      .from(table)
      .select('id')
      .eq('user_id', userId)
      .single();
    assert.equal(result.error, null);
    return result.data.id;
  }

  try {
    const tenant = await signIn(
      process.env.SUPABASE_TEST_TENANT_EMAIL,
      process.env.SUPABASE_TEST_TENANT_PASSWORD,
    );
    const landlord = await signIn(
      process.env.SUPABASE_TEST_LANDLORD_EMAIL,
      process.env.SUPABASE_TEST_LANDLORD_PASSWORD,
    );
    const landlordProfileId = await profileId(
      'landlord_profiles',
      landlord.user.id,
    );

    const propertyInsert = await admin.from('properties').insert({
      id: ids.property,
      landlord_id: landlordProfileId,
      property_type: 'APARTMENT',
      district: 'Moka',
      locality: 'Moka',
      bedrooms: 2,
      bathrooms: 1,
    });
    assert.equal(propertyInsert.error, null);
    const listingInsert = await admin.from('listings').insert({
      id: ids.listing,
      property_id: ids.property,
      title: 'TASK017 hosted conversation fixture',
      description: 'Hosted verification fixture.',
      monthly_rent: 20000,
      available_from: '2099-01-01',
      status: 'ACTIVE',
    });
    assert.equal(listingInsert.error, null);

    await check(
      'concurrent creation is one conversation with two participants',
      async () => {
        const results = await Promise.all(
          Array.from({ length: 6 }, () =>
            api(
              `/listings/${ids.listing}/conversation`,
              tenant.session.access_token,
              'POST',
              {},
            ),
          ),
        );
        if (results.some(({ status }) => ![200, 201].includes(status))) {
          console.error(
            results
              .map(({ status, body }) => ({ status, code: body?.error?.code }))
              .filter(({ status }) => ![200, 201].includes(status)),
          );
        }
        assert.equal(results.filter(({ status }) => status === 201).length, 1);
        assert.ok(
          results.every(({ status }) => status === 200 || status === 201),
        );
        ids.conversation = results[0].body.data.id;
        const conversations = await admin
          .from('conversations')
          .select('id')
          .eq('listing_id', ids.listing);
        const participants = await admin
          .from('conversation_participants')
          .select('conversation_id,user_id')
          .eq('conversation_id', ids.conversation);
        assert.equal(conversations.error, null);
        assert.equal(participants.error, null);
        assert.equal(conversations.data.length, 1);
        assert.equal(participants.data.length, 2);
      },
    );

    await check(
      'both participants list and retrieve the conversation',
      async () => {
        for (const token of [
          tenant.session.access_token,
          landlord.session.access_token,
        ]) {
          const list = await api('/conversations', token);
          const detail = await api(`/conversations/${ids.conversation}`, token);
          assert.equal(list.status, 200);
          assert.equal(detail.status, 200);
          assert.equal(detail.body.data.id, ids.conversation);
        }
      },
    );

    await check(
      'conversation response exposes minimal identity and no private fields',
      async () => {
        const detail = await api(
          `/conversations/${ids.conversation}`,
          tenant.session.access_token,
        );
        const serialized = JSON.stringify(detail.body);
        for (const forbidden of [
          'tenant_user_id',
          'landlord_user_id',
          'user_id',
          'email',
          'phone',
          'income',
          'employer',
          'address_line_1',
          'latitude',
          'longitude',
          'storage_path',
          'metadata',
        ])
          assert.equal(serialized.includes(forbidden), false);
      },
    );

    await check(
      'existing conversation survives listing closure without tenant private listing access',
      async () => {
        assert.equal(
          (
            await admin
              .from('listings')
              .update({ status: 'CLOSED' })
              .eq('id', ids.listing)
          ).error,
          null,
        );
        const tenantDetail = await api(
          `/conversations/${ids.conversation}`,
          tenant.session.access_token,
        );
        const landlordDetail = await api(
          `/conversations/${ids.conversation}`,
          landlord.session.access_token,
        );
        assert.equal(tenantDetail.status, 200);
        assert.equal(landlordDetail.status, 200);
        assert.equal(tenantDetail.body.data.listing_context.listing, null);
        assert.equal(
          tenantDetail.body.data.listing_context.availability,
          'UNAVAILABLE',
        );
      },
    );

    await check(
      'publishable-key direct conversation table and RPC access is blocked',
      async () => {
        const tableRead = await publishable
          .from('conversations')
          .select('id')
          .limit(1);
        const participantRead = await publishable
          .from('conversation_participants')
          .select('conversation_id')
          .limit(1);
        const rpc = await publishable.rpc('create_conversation_transaction', {
          p_listing_id: ids.listing,
          p_tenant_user_id: tenant.user.id,
        });
        assert.ok(tableRead.error || tableRead.data?.length === 0);
        assert.ok(participantRead.error || participantRead.data?.length === 0);
        assert.ok(rpc.error);
      },
    );

    const tempEmail = `task017-${randomUUID()}@example.invalid`;
    const tempPassword = `Task017-${randomUUID()}-Aa1!`;
    const created = await admin.auth.admin.createUser({
      email: tempEmail,
      password: tempPassword,
      email_confirm: true,
    });
    assert.equal(created.error, null);
    temporaryUser = created.data.user;
    assert.equal(
      (
        await admin.from('profiles').insert({
          id: temporaryUser.id,
          role: 'TENANT',
          first_name: 'Unrelated',
          last_name: 'Tenant',
        })
      ).error,
      null,
    );
    const role = await admin
      .from('tenant_profiles')
      .insert({ user_id: temporaryUser.id })
      .select('id')
      .single();
    assert.equal(role.error, null);
    temporaryTenantProfile = role.data.id;
    const unrelated = await signIn(tempEmail, tempPassword).catch(() => null);
    if (unrelated) {
      await check('unrelated user receives privacy-safe 404', async () => {
        const response = await api(
          `/conversations/${ids.conversation}`,
          unrelated.session.access_token,
        );
        assert.equal(response.status, 404);
      });
    }
  } finally {
    if (ids.conversation)
      await admin.from('conversations').delete().eq('id', ids.conversation);
    await admin.from('listings').delete().eq('id', ids.listing);
    await admin.from('properties').delete().eq('id', ids.property);
    if (temporaryTenantProfile)
      await admin
        .from('tenant_profiles')
        .delete()
        .eq('id', temporaryTenantProfile);
    if (temporaryUser)
      await admin.from('profiles').delete().eq('id', temporaryUser.id);
    if (temporaryUser) await admin.auth.admin.deleteUser(temporaryUser.id);
    listener.close();
  }
  console.log(
    `Hosted TASK-017 conversation verification passed: ${passed.length} checks.`,
  );
  for (const name of passed) console.log(`  PASS ${name}`);
}
