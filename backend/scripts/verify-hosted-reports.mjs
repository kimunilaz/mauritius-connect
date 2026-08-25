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
  console.error(`Hosted report verification requires: ${missing.join(', ')}.`);
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
  const server = await new Promise((resolve, reject) => {
    const listener = createApp().listen(0, '127.0.0.1', () =>
      resolve(listener),
    );
    listener.once('error', reject);
  });
  const base = `http://127.0.0.1:${server.address().port}/api/v1`;
  const adminDb = client(process.env.SUPABASE_SECRET_KEY);
  const browser = client(process.env.SUPABASE_PUBLISHABLE_KEY);
  const ids = {
    property: randomUUID(),
    listing: randomUUID(),
    conversation: randomUUID(),
    message: randomUUID(),
    reports: [],
    admin: null,
  };
  const passed = [];
  const api = async (path, token, method = 'GET', body) => {
    const response = await globalThis.fetch(`${base}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  };
  const signIn = async (email, password) => {
    const result = await browser.auth.signInWithPassword({ email, password });
    assert.equal(result.error, null);
    return result.data;
  };
  const check = async (name, fn) => {
    await fn();
    passed.push(name);
  };
  try {
    const tenant = await signIn(
      process.env.SUPABASE_TEST_TENANT_EMAIL,
      process.env.SUPABASE_TEST_TENANT_PASSWORD,
    );
    const landlord = await signIn(
      process.env.SUPABASE_TEST_LANDLORD_EMAIL,
      process.env.SUPABASE_TEST_LANDLORD_PASSWORD,
    );
    const tenantProfile = await adminDb
      .from('tenant_profiles')
      .select('id')
      .eq('user_id', tenant.user.id)
      .single();
    const landlordProfile = await adminDb
      .from('landlord_profiles')
      .select('id')
      .eq('user_id', landlord.user.id)
      .single();
    assert.equal(tenantProfile.error, null);
    assert.equal(landlordProfile.error, null);
    const adminEmail = `task020-admin-${randomUUID()}@example.invalid`;
    const adminPassword = `T020-${randomUUID()}!aA9`;
    const created = await adminDb.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
    });
    assert.equal(created.error, null);
    ids.admin = created.data.user.id;
    assert.equal(
      (
        await adminDb.from('profiles').insert({
          id: ids.admin,
          role: 'ADMIN',
          first_name: 'Task',
          last_name: 'Admin',
        })
      ).error,
      null,
    );
    const admin = await signIn(adminEmail, adminPassword);
    for (const [table, row] of [
      [
        'properties',
        {
          id: ids.property,
          landlord_id: landlordProfile.data.id,
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
          title: 'TASK020 report fixture',
          description: 'fixture',
          monthly_rent: 20000,
          available_from: '2099-01-01',
          status: 'ACTIVE',
        },
      ],
      [
        'conversations',
        {
          id: ids.conversation,
          listing_id: ids.listing,
          tenant_user_id: tenant.user.id,
          landlord_user_id: landlord.user.id,
        },
      ],
      [
        'conversation_participants',
        { conversation_id: ids.conversation, user_id: tenant.user.id },
      ],
      [
        'conversation_participants',
        { conversation_id: ids.conversation, user_id: landlord.user.id },
      ],
      [
        'messages',
        {
          id: ids.message,
          conversation_id: ids.conversation,
          sender_user_id: landlord.user.id,
          content: 'TASK020 report message',
        },
      ],
    ]) {
      assert.equal((await adminDb.from(table).insert(row)).error, null);
    }
    await check(
      'listing and message reports are accepted with backend-derived reporter',
      async () => {
        const listing = await api(
          '/reports',
          tenant.session.access_token,
          'POST',
          {
            target_type: 'LISTING',
            target_id: ids.listing,
            reason: 'OTHER',
            details: '  fixture  ',
          },
        );
        assert.equal(listing.status, 201);
        ids.reports.push(listing.body.data.id);
        const message = await api(
          '/reports',
          tenant.session.access_token,
          'POST',
          {
            target_type: 'MESSAGE',
            target_id: ids.message,
            reason: 'HARASSMENT',
          },
        );
        assert.equal(message.status, 201);
        ids.reports.push(message.body.data.id);
      },
    );
    await check(
      'duplicate sequential and concurrent reports reuse one active report',
      async () => {
        const one = await api('/reports', tenant.session.access_token, 'POST', {
          target_type: 'LISTING',
          target_id: ids.listing,
          reason: 'OTHER',
        });
        assert.equal(one.status, 200);
        assert.equal(one.body.data.created, false);
        assert.equal(one.body.data.id, ids.reports[0]);
        const results = await Promise.all(
          Array.from({ length: 5 }, () =>
            api('/reports', landlord.session.access_token, 'POST', {
              target_type: 'LISTING',
              target_id: ids.listing,
              reason: 'DUPLICATE',
            }),
          ),
        );
        assert.ok(
          results.every((item) => item.status === 201 || item.status === 200),
        );
        const rows = await adminDb
          .from('reports')
          .select('id')
          .eq('reporter_user_id', landlord.user.id)
          .eq('target_id', ids.listing)
          .in('status', ['OPEN', 'UNDER_REVIEW']);
        assert.equal(rows.error, null);
        assert.equal(rows.data.length, 1);
        ids.reports.push(rows.data[0].id);
      },
    );
    await check(
      'message privacy and admin queue/detail/actions are enforced',
      async () => {
        const unrelated = await api(
          '/reports',
          landlord.session.access_token,
          'POST',
          { target_type: 'MESSAGE', target_id: ids.message, reason: 'SPAM' },
        );
        assert.equal(unrelated.status, 201); // landlord is also a participant in the fixture
        const forbidden = await api(
          '/admin/reports',
          tenant.session.access_token,
        );
        assert.equal(forbidden.status, 403);
        const queue = await api('/admin/reports', admin.session.access_token);
        assert.equal(queue.status, 200);
        assert.ok(queue.body.data.length >= 3);
        const reportId = ids.reports[0];
        const detail = await api(
          `/admin/reports/${reportId}`,
          admin.session.access_token,
        );
        assert.equal(detail.status, 200);
        assert.equal(detail.body.data.target.type, 'LISTING');
        assert.equal(
          (
            await api(
              `/admin/reports/${reportId}/review`,
              admin.session.access_token,
              'POST',
              { reason: 'Review started' },
            )
          ).status,
          200,
        );
        assert.equal(
          (
            await api(
              `/admin/reports/${reportId}/resolve`,
              admin.session.access_token,
              'POST',
              { reason: 'Resolved' },
            )
          ).status,
          200,
        );
        assert.equal(
          (
            await api(
              `/admin/reports/${reportId}/dismiss`,
              admin.session.access_token,
              'POST',
              {},
            )
          ).status,
          409,
        );
        const audit = await adminDb
          .from('admin_audit_logs')
          .select('id')
          .eq('target_type', 'REPORT')
          .eq('target_id', reportId)
          .in('action', ['REPORT_REVIEWED', 'REPORT_RESOLVED']);
        assert.equal(audit.error, null);
        assert.equal(audit.data.length, 2);
      },
    );
    console.log(
      `Hosted TASK-020 report verification passed: ${passed.length} checks.`,
    );
    for (const name of passed) console.log(`  PASS ${name}`);
  } finally {
    await adminDb
      .from('admin_audit_logs')
      .delete()
      .eq('target_type', 'REPORT')
      .in('target_id', ids.reports);
    await adminDb.from('reports').delete().in('id', ids.reports);
    await adminDb.from('messages').delete().eq('id', ids.message);
    await adminDb
      .from('conversation_participants')
      .delete()
      .eq('conversation_id', ids.conversation);
    await adminDb.from('conversations').delete().eq('id', ids.conversation);
    await adminDb.from('listings').delete().eq('id', ids.listing);
    await adminDb.from('properties').delete().eq('id', ids.property);
    if (ids.admin) {
      await adminDb.from('profiles').delete().eq('id', ids.admin);
      await adminDb.auth.admin.deleteUser(ids.admin);
    }
    server.close();
  }
}
