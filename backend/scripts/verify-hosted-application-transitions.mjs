import assert from 'node:assert/strict';
import console from 'node:console';
import { randomBytes, randomUUID } from 'node:crypto';
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
    `Hosted application-transition verification requires: ${missing.join(', ')}.`,
  );
  process.exitCode = 1;
} else {
  await run();
}

function supabaseClient(key) {
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
  const apiBaseUrl = `http://127.0.0.1:${server.address().port}/api/v1`;
  const privileged = supabaseClient(process.env.SUPABASE_SECRET_KEY);
  const anonymous = supabaseClient(process.env.SUPABASE_PUBLISHABLE_KEY);
  const applicationIds = [];
  const listingIds = [];
  const propertyIds = [];
  const temporaryUserIds = [];
  const temporaryLandlordProfileIds = [];
  const passed = [];

  async function check(name, callback) {
    await callback();
    passed.push(name);
  }

  async function signIn(email, password, label) {
    const browser = supabaseClient(process.env.SUPABASE_PUBLISHABLE_KEY);
    const { data, error } = await browser.auth.signInWithPassword({
      email,
      password,
    });
    if (error || !data.session?.access_token)
      throw new Error(`${label} integration sign-in failed.`);
    return data;
  }

  async function api(path, token, { method = 'GET', body } = {}) {
    const headers = { Accept: 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await globalThis.fetch(`${apiBaseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null };
  }

  async function history(applicationId) {
    const result = await privileged
      .from('application_status_history')
      .select('from_status,to_status,changed_by_user_id,created_at')
      .eq('application_id', applicationId)
      .order('created_at');
    assert.equal(result.error, null);
    return result.data;
  }

  try {
    const tenant = await signIn(
      process.env.SUPABASE_TEST_TENANT_EMAIL,
      process.env.SUPABASE_TEST_TENANT_PASSWORD,
      'controlled TENANT',
    );
    const landlord = await signIn(
      process.env.SUPABASE_TEST_LANDLORD_EMAIL,
      process.env.SUPABASE_TEST_LANDLORD_PASSWORD,
      'controlled LANDLORD',
    );
    const tenantRole = await privileged
      .from('tenant_profiles')
      .select('id')
      .eq('user_id', tenant.user.id)
      .single();
    const landlordRole = await privileged
      .from('landlord_profiles')
      .select('id')
      .eq('user_id', landlord.user.id)
      .single();
    assert.equal(tenantRole.error, null);
    assert.equal(landlordRole.error, null);
    const tenantToken = tenant.session.access_token;
    const landlordToken = landlord.session.access_token;

    const otherAuth = await privileged.auth.admin.createUser({
      email: `task015-landlord-${randomUUID()}@example.com`,
      password: randomBytes(32).toString('base64url'),
      email_confirm: true,
    });
    assert.equal(otherAuth.error, null);
    temporaryUserIds.push(otherAuth.data.user.id);
    assert.equal(
      (
        await privileged.from('profiles').insert({
          id: otherAuth.data.user.id,
          role: 'LANDLORD',
          first_name: 'TASK015',
          last_name: 'Other landlord',
        })
      ).error,
      null,
    );
    const otherRoleId = randomUUID();
    temporaryLandlordProfileIds.push(otherRoleId);
    assert.equal(
      (
        await privileged.from('landlord_profiles').insert({
          id: otherRoleId,
          user_id: otherAuth.data.user.id,
        })
      ).error,
      null,
    );

    async function fixture(
      initialStatus = 'SUBMITTED',
      owner = landlordRole.data.id,
    ) {
      const propertyId = randomUUID();
      const listingId = randomUUID();
      const applicationId = randomUUID();
      propertyIds.push(propertyId);
      listingIds.push(listingId);
      applicationIds.push(applicationId);
      assert.equal(
        (
          await privileged.from('properties').insert({
            id: propertyId,
            landlord_id: owner,
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
          await privileged.from('listings').insert({
            id: listingId,
            property_id: propertyId,
            title: 'TASK015 historical workflow fixture',
            description: 'Trusted application transition integration fixture.',
            monthly_rent: 20000,
            available_from: '2026-12-01',
            status: 'CLOSED',
          })
        ).error,
        null,
      );
      assert.equal(
        (
          await privileged.from('applications').insert({
            id: applicationId,
            listing_id: listingId,
            tenant_id: tenantRole.data.id,
            move_in_date: '2026-12-15',
            requested_lease_duration_months: 12,
            number_of_occupants: 1,
            status: initialStatus,
            submitted_at:
              initialStatus === 'DRAFT' ? null : new Date().toISOString(),
          })
        ).error,
        null,
      );
      if (initialStatus !== 'DRAFT') {
        const rows = [
          {
            application_id: applicationId,
            from_status: 'DRAFT',
            to_status: 'SUBMITTED',
            changed_by_user_id: tenant.user.id,
          },
        ];
        if (['UNDER_REVIEW', 'SHORTLISTED'].includes(initialStatus))
          rows.push({
            application_id: applicationId,
            from_status: 'SUBMITTED',
            to_status: 'UNDER_REVIEW',
            changed_by_user_id: landlord.user.id,
          });
        if (initialStatus === 'SHORTLISTED')
          rows.push({
            application_id: applicationId,
            from_status: 'UNDER_REVIEW',
            to_status: 'SHORTLISTED',
            changed_by_user_id: landlord.user.id,
          });
        assert.equal(
          (await privileged.from('application_status_history').insert(rows))
            .error,
          null,
        );
      }
      return { applicationId, listingId };
    }

    const path = (id, action) => `/landlord/applications/${id}/${action}`;
    const withdraw = (id) => `/applications/${id}/withdraw`;

    await check(
      'all landlord transitions and identical retries are atomic',
      async () => {
        const record = await fixture();
        for (const [action, target] of [
          ['review', 'UNDER_REVIEW'],
          ['shortlist', 'SHORTLISTED'],
          ['reject', 'REJECTED'],
        ]) {
          const first = await api(
            path(record.applicationId, action),
            landlordToken,
            {
              method: 'POST',
              body: { status: 'ACCEPTED', changed_by_user_id: tenant.user.id },
            },
          );
          const repeated = await api(
            path(record.applicationId, action),
            landlordToken,
            { method: 'POST' },
          );
          assert.equal(first.status, 200);
          assert.equal(first.body.data.status, target);
          assert.equal(first.body.meta.transitioned_now, true);
          assert.equal(repeated.status, 200);
          assert.equal(repeated.body.meta.transitioned_now, false);
        }
        const events = await history(record.applicationId);
        assert.deepEqual(
          events
            .slice(1)
            .map(({ from_status, to_status }) => [from_status, to_status]),
          [
            ['SUBMITTED', 'UNDER_REVIEW'],
            ['UNDER_REVIEW', 'SHORTLISTED'],
            ['SHORTLISTED', 'REJECTED'],
          ],
        );
        assert.ok(
          events
            .slice(1)
            .every(
              ({ changed_by_user_id }) =>
                changed_by_user_id === landlord.user.id,
            ),
        );
      },
    );

    await check('direct rejection from SUBMITTED is supported', async () => {
      const record = await fixture();
      const response = await api(
        path(record.applicationId, 'reject'),
        landlordToken,
        { method: 'POST' },
      );
      assert.equal(response.status, 200);
      assert.equal(response.body.data.status, 'REJECTED');
    });

    await check(
      'tenant withdrawal works from every approved source',
      async () => {
        for (const initialStatus of [
          'SUBMITTED',
          'UNDER_REVIEW',
          'SHORTLISTED',
        ]) {
          const record = await fixture(initialStatus);
          const first = await api(withdraw(record.applicationId), tenantToken, {
            method: 'POST',
            body: { status: 'ACCEPTED', tenant_id: randomUUID() },
          });
          const repeated = await api(
            withdraw(record.applicationId),
            tenantToken,
            { method: 'POST' },
          );
          assert.equal(first.status, 200);
          assert.equal(first.body.data.status, 'WITHDRAWN');
          assert.equal(repeated.body.meta.transitioned_now, false);
          const events = await history(record.applicationId);
          const withdrawalEvents = events.filter(
            ({ to_status }) => to_status === 'WITHDRAWN',
          );
          assert.equal(withdrawalEvents.length, 1);
          assert.equal(withdrawalEvents[0].changed_by_user_id, tenant.user.id);
        }
      },
    );

    await check(
      'DRAFT privacy, ownership, roles, and invalid edges hold',
      async () => {
        const draft = await fixture('DRAFT');
        assert.equal(
          (
            await api(path(draft.applicationId, 'review'), landlordToken, {
              method: 'POST',
            })
          ).status,
          404,
        );
        const otherOwned = await fixture('SUBMITTED', otherRoleId);
        assert.equal(
          (
            await api(path(otherOwned.applicationId, 'reject'), landlordToken, {
              method: 'POST',
            })
          ).status,
          404,
        );
        const invalid = await fixture();
        const invalidResponse = await api(
          path(invalid.applicationId, 'shortlist'),
          landlordToken,
          { method: 'POST' },
        );
        assert.equal(invalidResponse.status, 409);
        assert.equal(
          invalidResponse.body.error.code,
          'INVALID_APPLICATION_TRANSITION',
        );
        assert.equal(
          (
            await api(path(invalid.applicationId, 'review'), tenantToken, {
              method: 'POST',
            })
          ).status,
          403,
        );
        assert.equal(
          (
            await api(withdraw(invalid.applicationId), landlordToken, {
              method: 'POST',
            })
          ).status,
          403,
        );
      },
    );

    await check(
      'generic and legacy viewing action routes do not exist',
      async () => {
        const record = await fixture();
        for (const [route, token, method] of [
          [
            `/applications/${record.applicationId}/status`,
            tenantToken,
            'PATCH',
          ],
          [`/applications/${record.applicationId}/accept`, tenantToken, 'POST'],
          [
            `/landlord/applications/${record.applicationId}/invite-viewing`,
            landlordToken,
            'POST',
          ],
        ])
          assert.equal((await api(route, token, { method })).status, 404);
      },
    );

    async function race(initialStatus, landlordAction) {
      const record = await fixture(initialStatus);
      const before = (await history(record.applicationId)).length;
      const results = await Promise.all([
        api(path(record.applicationId, landlordAction), landlordToken, {
          method: 'POST',
        }),
        api(withdraw(record.applicationId), tenantToken, { method: 'POST' }),
      ]);
      assert.deepEqual(results.map(({ status }) => status).sort(), [200, 409]);
      assert.equal((await history(record.applicationId)).length, before + 1);
      assert.ok(
        results.every(({ body }) =>
          [undefined, 'INVALID_APPLICATION_TRANSITION'].includes(
            body.error?.code,
          ),
        ),
      );
    }

    await check('review versus withdraw race has one winner', () =>
      race('SUBMITTED', 'review'),
    );
    await check('reject versus withdraw race has one winner', () =>
      race('SUBMITTED', 'reject'),
    );
    await check('shortlist versus reject race has one winner', async () => {
      const record = await fixture('UNDER_REVIEW');
      const before = (await history(record.applicationId)).length;
      const results = await Promise.all([
        api(path(record.applicationId, 'shortlist'), landlordToken, {
          method: 'POST',
        }),
        api(path(record.applicationId, 'reject'), landlordToken, {
          method: 'POST',
        }),
      ]);
      assert.deepEqual(results.map(({ status }) => status).sort(), [200, 409]);
      assert.equal((await history(record.applicationId)).length, before + 1);
    });

    await check(
      'publishable-key database and RPC mutation remain blocked',
      async () => {
        const record = await fixture();
        const direct = await anonymous
          .from('applications')
          .update({ status: 'REJECTED' })
          .eq('id', record.applicationId)
          .select('id');
        assert.equal(direct.error, null);
        assert.deepEqual(direct.data, []);
        const rpc = await anonymous.rpc(
          'transition_application_status_transaction',
          {
            p_application_id: record.applicationId,
            p_actor_user_id: tenant.user.id,
            p_actor_role: 'TENANT',
            p_expected_status: 'SUBMITTED',
            p_target_status: 'WITHDRAWN',
          },
        );
        assert.notEqual(rpc.error, null);
        const stored = await privileged
          .from('applications')
          .select('status')
          .eq('id', record.applicationId)
          .single();
        assert.equal(stored.data.status, 'SUBMITTED');
      },
    );

    console.log(
      `Hosted application-transition verification passed: ${passed.length} checks.`,
    );
    for (const name of passed) console.log(`  PASS ${name}`);
  } finally {
    if (applicationIds.length)
      await privileged
        .from('application_status_history')
        .delete()
        .in('application_id', applicationIds);
    if (applicationIds.length)
      await privileged.from('applications').delete().in('id', applicationIds);
    if (listingIds.length)
      await privileged.from('listings').delete().in('id', listingIds);
    if (propertyIds.length)
      await privileged.from('properties').delete().in('id', propertyIds);
    if (temporaryLandlordProfileIds.length)
      await privileged
        .from('landlord_profiles')
        .delete()
        .in('id', temporaryLandlordProfileIds);
    for (const userId of temporaryUserIds)
      await privileged.auth.admin.deleteUser(userId);
    await new Promise((resolve) => server.close(resolve));
  }
}
