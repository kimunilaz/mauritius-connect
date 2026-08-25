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
  console.error(`Hosted message verification requires: ${missing.join(', ')}.`);
  process.exitCode = 1;
} else await run();

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
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
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
    const landlordProfile = await admin
      .from('landlord_profiles')
      .select('id')
      .eq('user_id', landlord.user.id)
      .single();
    assert.equal(landlordProfile.error, null);
    assert.equal(
      (
        await admin.from('properties').insert({
          id: ids.property,
          landlord_id: landlordProfile.data.id,
          property_type: 'APARTMENT',
          district: 'Moka',
          locality: 'Moka',
          bedrooms: 2,
          bathrooms: 1,
        })
      ).error,
      null,
    );
    assert.equal(
      (
        await admin.from('listings').insert({
          id: ids.listing,
          property_id: ids.property,
          title: 'TASK018 hosted message fixture',
          description: 'Hosted message fixture.',
          monthly_rent: 20000,
          available_from: '2099-01-01',
          status: 'ACTIVE',
        })
      ).error,
      null,
    );
    const created = await api(
      `/listings/${ids.listing}/conversation`,
      tenant.session.access_token,
      'POST',
      {},
    );
    assert.equal(created.status, 201);
    ids.conversation = created.body.data.id;

    await check(
      'participants send and read one safe text history',
      async () => {
        const one = await api(
          `/conversations/${ids.conversation}/messages`,
          tenant.session.access_token,
          'POST',
          { body: '  Tenant hello  ' },
        );
        const two = await api(
          `/conversations/${ids.conversation}/messages`,
          landlord.session.access_token,
          'POST',
          { body: 'Landlord reply' },
        );
        assert.equal(one.status, 201);
        assert.equal(two.status, 201);
        assert.equal(one.body.data.body, 'Tenant hello');
        assert.equal(one.body.data.sender.is_me, true);
        const history = await api(
          `/conversations/${ids.conversation}/messages?limit=50`,
          tenant.session.access_token,
        );
        assert.equal(history.status, 200);
        assert.equal(history.body.data.length, 2);
        assert.equal(history.body.data[0].sender.is_me, true);
        assert.equal(history.body.data[1].sender.is_me, false);
        assert.equal(
          JSON.stringify(history.body).includes('sender_user_id'),
          false,
        );
      },
    );

    await check(
      'validation rejects blank, oversized, unknown, and spoofed fields',
      async () => {
        for (const body of [
          { body: '   ' },
          { body: 'x'.repeat(4001) },
          { body: 'ok', sender_user_id: landlord.user.id },
          { body: '<script>alert(1)</script>' },
        ]) {
          const response = await api(
            `/conversations/${ids.conversation}/messages`,
            tenant.session.access_token,
            'POST',
            body,
          );
          if (body.body.startsWith('<')) assert.equal(response.status, 201);
          else assert.equal(response.status, 422);
        }
      },
    );

    await check(
      'unread counts and read state follow counterparty semantics',
      async () => {
        const landlordList = await api(
          '/conversations',
          landlord.session.access_token,
        );
        const tenantList = await api(
          '/conversations',
          tenant.session.access_token,
        );
        const landlordRow = landlordList.body.data.find(
          ({ id }) => id === ids.conversation,
        );
        const tenantRow = tenantList.body.data.find(
          ({ id }) => id === ids.conversation,
        );
        assert.equal(landlordRow.unread_count, 2);
        assert.equal(tenantRow.unread_count, 1);
        assert.equal(
          (
            await api(
              `/conversations/${ids.conversation}/read`,
              landlord.session.access_token,
              'POST',
              {},
            )
          ).status,
          200,
        );
        const cleared = await api(
          '/conversations',
          landlord.session.access_token,
        );
        assert.equal(
          cleared.body.data.find(({ id }) => id === ids.conversation)
            .unread_count,
          0,
        );
        await api(
          `/conversations/${ids.conversation}/messages`,
          tenant.session.access_token,
          'POST',
          { body: 'New tenant message' },
        );
        const newUnread = await api(
          '/conversations',
          landlord.session.access_token,
        );
        assert.equal(
          newUnread.body.data.find(({ id }) => id === ids.conversation)
            .unread_count,
          1,
        );
      },
    );

    await check(
      'pagination and activity ordering are deterministic and bounded',
      async () => {
        const before = (
          await admin
            .from('conversations')
            .select('updated_at')
            .eq('id', ids.conversation)
            .single()
        ).data.updated_at;
        await Promise.all(
          Array.from({ length: 6 }, (_, index) =>
            api(
              `/conversations/${ids.conversation}/messages`,
              tenant.session.access_token,
              'POST',
              { body: `Concurrent ${index}` },
            ),
          ),
        );
        const after = (
          await admin
            .from('conversations')
            .select('updated_at')
            .eq('id', ids.conversation)
            .single()
        ).data.updated_at;
        assert.ok(new Date(after) >= new Date(before));
        const first = await api(
          `/conversations/${ids.conversation}/messages?page=1&limit=2`,
          tenant.session.access_token,
        );
        const second = await api(
          `/conversations/${ids.conversation}/messages?page=2&limit=2`,
          tenant.session.access_token,
        );
        assert.equal(first.status, 200);
        assert.equal(second.status, 200);
        assert.equal(first.body.meta.limit, 2);
        assert.equal(
          new Set([...first.body.data, ...second.body.data].map(({ id }) => id))
            .size,
          4,
        );
      },
    );

    await check(
      'unavailable listing preserves conversation message access and privacy',
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
        const history = await api(
          `/conversations/${ids.conversation}/messages`,
          tenant.session.access_token,
        );
        const detail = await api(
          `/conversations/${ids.conversation}`,
          tenant.session.access_token,
        );
        assert.equal(history.status, 200);
        assert.equal(detail.status, 200);
        assert.equal(detail.body.data.listing_context.listing, null);
        assert.equal(
          JSON.stringify(history.body).includes('address_line_1'),
          false,
        );
      },
    );

    await check(
      'publishable-key direct message and read-state access is blocked',
      async () => {
        const read = await publishable.from('messages').select('id').limit(1);
        const write = await publishable.from('messages').insert({
          conversation_id: ids.conversation,
          sender_user_id: tenant.user.id,
          content: 'bypass',
        });
        const beforeMember = await admin
          .from('conversation_participants')
          .select('last_read_at')
          .eq('conversation_id', ids.conversation)
          .eq('user_id', tenant.user.id)
          .single();
        const memberWrite = await publishable
          .from('conversation_participants')
          .update({ last_read_at: new Date().toISOString() })
          .eq('conversation_id', ids.conversation)
          .eq('user_id', tenant.user.id);
        assert.ok(read.error || read.data?.length === 0);
        assert.ok(write.error);
        const afterMember = await admin
          .from('conversation_participants')
          .select('last_read_at')
          .eq('conversation_id', ids.conversation)
          .eq('user_id', tenant.user.id)
          .single();
        assert.equal(memberWrite.error, null);
        assert.equal(
          afterMember.data.last_read_at,
          beforeMember.data.last_read_at,
        );
      },
    );
  } finally {
    if (ids.conversation)
      await admin.from('conversations').delete().eq('id', ids.conversation);
    await admin.from('listings').delete().eq('id', ids.listing);
    await admin.from('properties').delete().eq('id', ids.property);
    listener.close();
  }
  console.log(
    `Hosted TASK-018 message verification passed: ${passed.length} checks.`,
  );
  for (const name of passed) console.log(`  PASS ${name}`);
}
