import assert from 'node:assert/strict';
import console from 'node:console';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

process.loadEnvFile('backend/.env');
if (existsSync('backend/.env.integration'))
  process.loadEnvFile('backend/.env.integration');

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
  const server = await new Promise((resolve) => {
    const listener = createApp().listen(0, '127.0.0.1', () =>
      resolve(listener),
    );
  });
  const base = `http://127.0.0.1:${server.address().port}/api/v1`;
  const admin = client(process.env.SUPABASE_SECRET_KEY);
  const anon = client(process.env.SUPABASE_PUBLISHABLE_KEY);
  const ids = { properties: [], listings: [], applications: [] };
  const passed = [];
  async function signIn(email, password) {
    const result = await client(
      process.env.SUPABASE_PUBLISHABLE_KEY,
    ).auth.signInWithPassword({ email, password });
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
  async function check(name, fn) {
    await fn();
    passed.push(name);
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
    const tenantRole = await admin
      .from('tenant_profiles')
      .select('id')
      .eq('user_id', tenant.user.id)
      .single();
    const landlordRole = await admin
      .from('landlord_profiles')
      .select('id')
      .eq('user_id', landlord.user.id)
      .single();
    async function fixture(status = 'SHORTLISTED') {
      const propertyId = randomUUID();
      const listingId = randomUUID();
      const applicationId = randomUUID();
      ids.properties.push(propertyId);
      ids.listings.push(listingId);
      ids.applications.push(applicationId);
      assert.equal(
        (
          await admin.from('properties').insert({
            id: propertyId,
            landlord_id: landlordRole.data.id,
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
            id: listingId,
            property_id: propertyId,
            title: 'TASK016 fixture',
            description: 'Trusted viewing fixture.',
            monthly_rent: 20000,
            available_from: '2026-12-01',
            status: 'CLOSED',
          })
        ).error,
        null,
      );
      assert.equal(
        (
          await admin.from('applications').insert({
            id: applicationId,
            listing_id: listingId,
            tenant_id: tenantRole.data.id,
            status,
            submitted_at: new Date().toISOString(),
          })
        ).error,
        null,
      );
      return applicationId;
    }
    const proposal = {
      start_time: '2099-09-12T10:00:00.000Z',
      end_time: '2099-09-12T11:00:00.000Z',
      notes: 'Hosted viewing.',
    };

    async function transition(viewingId, actor, role, expected, action) {
      const result = await admin.rpc('transition_viewing_transaction', {
        p_viewing_id: viewingId,
        p_actor_user_id: actor,
        p_actor_role: role,
        p_expected_viewing_status: expected,
        p_action: action,
      });
      assert.equal(result.error, null);
      return result.data[0];
    }

    await check(
      'first proposal is atomic and one-open invariant holds',
      async () => {
        const id = await fixture();
        const results = await Promise.all([
          api(
            `/landlord/applications/${id}/viewings`,
            landlord.session.access_token,
            'POST',
            proposal,
          ),
          api(
            `/landlord/applications/${id}/viewings`,
            landlord.session.access_token,
            'POST',
            proposal,
          ),
        ]);
        assert.deepEqual(
          results.map(({ status }) => status).sort(),
          [201, 409],
        );
        const app = await admin
          .from('applications')
          .select('status')
          .eq('id', id)
          .single();
        const history = await admin
          .from('application_status_history')
          .select('id')
          .eq('application_id', id)
          .eq('to_status', 'VIEWING_INVITED');
        assert.equal(app.data.status, 'VIEWING_INVITED');
        assert.equal(history.data.length, 1);
      },
    );

    await check(
      'tenant confirms and landlord completes atomically',
      async () => {
        const id = await fixture();
        const proposed = await api(
          `/landlord/applications/${id}/viewings`,
          landlord.session.access_token,
          'POST',
          proposal,
        );
        const viewingId = proposed.body.data.id;
        assert.equal(
          (
            await api(
              `/viewings/${viewingId}/confirm`,
              tenant.session.access_token,
              'POST',
            )
          ).status,
          200,
        );
        await admin
          .from('viewings')
          .update({ start_time: '2020-09-12T10:00:00Z' })
          .eq('id', viewingId);
        const completed = await api(
          `/viewings/${viewingId}/complete`,
          landlord.session.access_token,
          'POST',
        );
        const repeated = await api(
          `/viewings/${viewingId}/complete`,
          landlord.session.access_token,
          'POST',
        );
        assert.equal(completed.status, 200);
        assert.equal(repeated.body.meta.transitioned_now, false);
        const app = await admin
          .from('applications')
          .select('status')
          .eq('id', id)
          .single();
        assert.equal(app.data.status, 'VIEWING_COMPLETED');
      },
    );

    await check(
      'decline cancel and no-show preserve viewing stage and allow another',
      async () => {
        for (const [action, actor] of [
          ['decline', 'tenant'],
          ['cancel', 'tenant'],
          ['cancel', 'landlord'],
          ['no-show', 'landlord'],
        ]) {
          const id = await fixture('VIEWING_INVITED');
          const proposed = await api(
            `/landlord/applications/${id}/viewings`,
            landlord.session.access_token,
            'POST',
            proposal,
          );
          const viewingId = proposed.body.data.id;
          if (action === 'no-show') {
            await api(
              `/viewings/${viewingId}/confirm`,
              tenant.session.access_token,
              'POST',
            );
            await admin
              .from('viewings')
              .update({ start_time: '2020-09-12T10:00:00Z' })
              .eq('id', viewingId);
          }
          const token =
            actor === 'tenant'
              ? tenant.session.access_token
              : landlord.session.access_token;
          assert.equal(
            (await api(`/viewings/${viewingId}/${action}`, token, 'POST'))
              .status,
            200,
          );
          assert.equal(
            (
              await api(
                `/landlord/applications/${id}/viewings`,
                landlord.session.access_token,
                'POST',
                proposal,
              )
            ).status,
            201,
          );
        }
      },
    );

    await check('participant isolation and role boundaries hold', async () => {
      const id = await fixture();
      const proposed = await api(
        `/landlord/applications/${id}/viewings`,
        landlord.session.access_token,
        'POST',
        proposal,
      );
      assert.equal(
        (
          await api(
            `/landlord/applications/${id}/viewings`,
            tenant.session.access_token,
            'POST',
            proposal,
          )
        ).status,
        403,
      );
      assert.equal(
        (
          await api(
            `/viewings/${proposed.body.data.id}/complete`,
            tenant.session.access_token,
            'POST',
          )
        ).status,
        403,
      );
    });

    await check(
      'competing viewing transitions have one database winner',
      async () => {
        for (const [initial, firstAction, secondAction, role, actor] of [
          ['PROPOSED', 'CONFIRM', 'DECLINE', 'TENANT', tenant.user.id],
          ['PROPOSED', 'CONFIRM', 'CANCEL', 'TENANT', tenant.user.id],
          ['CONFIRMED', 'COMPLETE', 'CANCEL', 'LANDLORD', landlord.user.id],
        ]) {
          const id = await fixture('VIEWING_INVITED');
          const proposed = await api(
            `/landlord/applications/${id}/viewings`,
            landlord.session.access_token,
            'POST',
            proposal,
          );
          const viewingId = proposed.body.data.id;
          if (initial === 'CONFIRMED') {
            assert.equal(
              (
                await transition(
                  viewingId,
                  tenant.user.id,
                  'TENANT',
                  'PROPOSED',
                  'CONFIRM',
                )
              ).outcome,
              'TRANSITIONED',
            );
            assert.equal(
              (
                await admin
                  .from('viewings')
                  .update({ start_time: '2020-09-12T10:00:00Z' })
                  .eq('id', viewingId)
              ).error,
              null,
            );
          }
          const results = await Promise.all([
            transition(viewingId, actor, role, initial, firstAction),
            transition(viewingId, actor, role, initial, secondAction),
          ]);
          assert.deepEqual(results.map(({ outcome }) => outcome).sort(), [
            'INVALID_TRANSITION',
            'TRANSITIONED',
          ]);
        }
      },
    );

    await check(
      'publishable-key direct viewing mutation and RPC are blocked',
      async () => {
        const direct = await anon
          .from('viewings')
          .update({ status: 'COMPLETED' })
          .eq('id', randomUUID())
          .select();
        assert.deepEqual(direct.data, []);
        const rpc = await anon.rpc('transition_viewing_transaction', {
          p_viewing_id: randomUUID(),
          p_actor_user_id: tenant.user.id,
          p_actor_role: 'TENANT',
          p_expected_viewing_status: 'PROPOSED',
          p_action: 'CONFIRM',
        });
        assert.notEqual(rpc.error, null);
      },
    );
    console.log(`Hosted viewing verification passed: ${passed.length} checks.`);
    for (const name of passed) console.log(`  PASS ${name}`);
  } finally {
    if (ids.applications.length)
      await admin
        .from('application_status_history')
        .delete()
        .in('application_id', ids.applications);
    if (ids.applications.length)
      await admin
        .from('viewings')
        .delete()
        .in('application_id', ids.applications);
    if (ids.applications.length)
      await admin.from('applications').delete().in('id', ids.applications);
    if (ids.listings.length)
      await admin.from('listings').delete().in('id', ids.listings);
    if (ids.properties.length)
      await admin.from('properties').delete().in('id', ids.properties);
    await new Promise((resolve) => server.close(resolve));
  }
}

await run();
