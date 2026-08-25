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
    `Hosted notification verification requires: ${missing.join(', ')}.`,
  );
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
  const admin = client(process.env.SUPABASE_SECRET_KEY);
  const publishable = client(process.env.SUPABASE_PUBLISHABLE_KEY);
  const ids = {
    properties: [],
    listings: [],
    applications: [],
    viewings: [],
    conversations: [],
  };
  const passed = [];
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
  async function check(name, callback) {
    await callback();
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
    const tenantProfile = await admin
      .from('tenant_profiles')
      .select('id,user_id')
      .eq('user_id', tenant.user.id)
      .single();
    const landlordProfile = await admin
      .from('landlord_profiles')
      .select('id')
      .eq('user_id', landlord.user.id)
      .single();
    assert.equal(tenantProfile.error, null);
    assert.equal(landlordProfile.error, null);

    async function fixture(status = 'DRAFT') {
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
            id: listingId,
            property_id: propertyId,
            title: 'TASK019 notification fixture',
            description: 'Notification fixture.',
            monthly_rent: 20000,
            available_from: '2099-01-01',
            status: 'ACTIVE',
          })
        ).error,
        null,
      );
      assert.equal(
        (
          await admin.from('applications').insert({
            id: applicationId,
            listing_id: listingId,
            tenant_id: tenantProfile.data.id,
            move_in_date: '2099-02-01',
            requested_lease_duration_months: 12,
            number_of_occupants: 1,
            status,
            submitted_at: status === 'DRAFT' ? null : new Date().toISOString(),
          })
        ).error,
        null,
      );
      return { propertyId, listingId, applicationId };
    }
    async function notifications(token, query = '') {
      return api(`/notifications${query}`, token);
    }
    async function count(token) {
      const result = await api('/notifications/unread-count', token);
      assert.equal(result.status, 200);
      return result.body.data.unread_count;
    }

    const application = await fixture();
    await check(
      'application submission, review, shortlist, reject, and withdrawal events',
      async () => {
        const submitted = await api(
          `/applications/${application.applicationId}/submit`,
          tenant.session.access_token,
          'POST',
          {},
        );
        assert.equal(submitted.status, 200);
        let landlordList = await notifications(
          landlord.session.access_token,
          '?limit=100',
        );
        assert.equal(landlordList.status, 200);
        assert.equal(
          landlordList.body.data.filter(
            (item) =>
              item.type === 'APPLICATION_SUBMITTED' &&
              item.target?.endsWith(application.applicationId),
          ).length,
          1,
        );
        assert.equal(
          (
            await api(
              `/landlord/applications/${application.applicationId}/review`,
              landlord.session.access_token,
              'POST',
              {},
            )
          ).status,
          200,
        );
        assert.equal(
          (
            await api(
              `/landlord/applications/${application.applicationId}/shortlist`,
              landlord.session.access_token,
              'POST',
              {},
            )
          ).status,
          200,
        );
        assert.equal(
          (
            await api(
              `/landlord/applications/${application.applicationId}/reject`,
              landlord.session.access_token,
              'POST',
              {},
            )
          ).status,
          200,
        );
        const tenantList = await notifications(
          tenant.session.access_token,
          '?limit=100',
        );
        const types = tenantList.body.data
          .filter((item) => item.target?.endsWith(application.applicationId))
          .map((item) => item.type);
        for (const type of [
          'APPLICATION_UNDER_REVIEW',
          'APPLICATION_SHORTLISTED',
          'APPLICATION_REJECTED',
        ])
          assert.equal(types.includes(type), true);
        const withdrawn = await fixture('SUBMITTED');
        assert.equal(
          (
            await api(
              `/applications/${withdrawn.applicationId}/withdraw`,
              tenant.session.access_token,
              'POST',
              {},
            )
          ).status,
          200,
        );
        landlordList = await notifications(
          landlord.session.access_token,
          '?limit=100',
        );
        assert.equal(
          landlordList.body.data.some(
            (item) =>
              item.type === 'APPLICATION_WITHDRAWN' &&
              item.target?.endsWith(withdrawn.applicationId),
          ),
          true,
        );
      },
    );

    await check(
      'idempotent application retries and concurrent loser emit no duplicate event',
      async () => {
        const before = (
          await notifications(tenant.session.access_token, '?limit=100')
        ).body.data.filter(
          (item) => item.type === 'APPLICATION_REJECTED',
        ).length;
        const retry = await api(
          `/landlord/applications/${application.applicationId}/reject`,
          landlord.session.access_token,
          'POST',
          {},
        );
        assert.equal(retry.status, 200);
        const after = (
          await notifications(tenant.session.access_token, '?limit=100')
        ).body.data.filter(
          (item) => item.type === 'APPLICATION_REJECTED',
        ).length;
        assert.equal(after, before);
        const race = await fixture('SUBMITTED');
        const results = await Promise.all([
          api(
            `/landlord/applications/${race.applicationId}/review`,
            landlord.session.access_token,
            'POST',
            {},
          ),
          api(
            `/landlord/applications/${race.applicationId}/reject`,
            landlord.session.access_token,
            'POST',
            {},
          ),
        ]);
        assert.equal(
          results.some((result) => result.status === 200),
          true,
        );
        const raceNotifications = (
          await notifications(tenant.session.access_token, '?limit=100')
        ).body.data.filter((item) => item.target?.endsWith(race.applicationId));
        assert.equal(raceNotifications.length, 1);
      },
    );

    await check(
      'viewing proposal, confirm, decline, cancel, complete, and no-show events',
      async () => {
        const proposal = await fixture('SHORTLISTED');
        const proposed = await api(
          `/landlord/applications/${proposal.applicationId}/viewings`,
          landlord.session.access_token,
          'POST',
          {
            start_time: '2099-03-01T10:00:00.000Z',
            end_time: '2099-03-01T11:00:00.000Z',
            notes: 'fixture',
          },
        );
        assert.equal(proposed.status, 201);
        ids.viewings.push(proposed.body.data.id);
        assert.equal(
          (
            await api(
              `/viewings/${proposed.body.data.id}/confirm`,
              tenant.session.access_token,
              'POST',
              {},
            )
          ).status,
          200,
        );
        const declinedApp = await fixture('SHORTLISTED');
        const declined = await api(
          `/landlord/applications/${declinedApp.applicationId}/viewings`,
          landlord.session.access_token,
          'POST',
          {
            start_time: '2099-03-02T10:00:00.000Z',
            end_time: '2099-03-02T11:00:00.000Z',
          },
        );
        ids.viewings.push(declined.body.data.id);
        assert.equal(
          (
            await api(
              `/viewings/${declined.body.data.id}/decline`,
              tenant.session.access_token,
              'POST',
              {},
            )
          ).status,
          200,
        );
        const cancelledApp = await fixture('SHORTLISTED');
        const cancelled = await api(
          `/landlord/applications/${cancelledApp.applicationId}/viewings`,
          landlord.session.access_token,
          'POST',
          {
            start_time: '2099-03-03T10:00:00.000Z',
            end_time: '2099-03-03T11:00:00.000Z',
          },
        );
        ids.viewings.push(cancelled.body.data.id);
        assert.equal(
          (
            await api(
              `/viewings/${cancelled.body.data.id}/cancel`,
              landlord.session.access_token,
              'POST',
              {},
            )
          ).status,
          200,
        );
        const completedApp = await fixture('SHORTLISTED');
        const completed = await api(
          `/landlord/applications/${completedApp.applicationId}/viewings`,
          landlord.session.access_token,
          'POST',
          {
            start_time: '2099-03-04T10:00:00.000Z',
            end_time: '2099-03-04T11:00:00.000Z',
          },
        );
        ids.viewings.push(completed.body.data.id);
        assert.equal(
          (
            await admin
              .from('viewings')
              .update({
                start_time: '2020-03-04T10:00:00.000Z',
                end_time: '2020-03-04T11:00:00.000Z',
              })
              .eq('id', completed.body.data.id)
          ).error,
          null,
        );
        await api(
          `/viewings/${completed.body.data.id}/confirm`,
          tenant.session.access_token,
          'POST',
          {},
        );
        assert.equal(
          (
            await api(
              `/viewings/${completed.body.data.id}/complete`,
              landlord.session.access_token,
              'POST',
              {},
            )
          ).status,
          200,
        );
        const noShowApp = await fixture('SHORTLISTED');
        const noShow = await api(
          `/landlord/applications/${noShowApp.applicationId}/viewings`,
          landlord.session.access_token,
          'POST',
          {
            start_time: '2099-03-05T10:00:00.000Z',
            end_time: '2099-03-05T11:00:00.000Z',
          },
        );
        ids.viewings.push(noShow.body.data.id);
        assert.equal(
          (
            await admin
              .from('viewings')
              .update({
                start_time: '2020-03-05T10:00:00.000Z',
                end_time: '2020-03-05T11:00:00.000Z',
              })
              .eq('id', noShow.body.data.id)
          ).error,
          null,
        );
        await api(
          `/viewings/${noShow.body.data.id}/confirm`,
          tenant.session.access_token,
          'POST',
          {},
        );
        assert.equal(
          (
            await api(
              `/viewings/${noShow.body.data.id}/no-show`,
              landlord.session.access_token,
              'POST',
              {},
            )
          ).status,
          200,
        );
        const tenantNotifications = (
          await notifications(tenant.session.access_token, '?limit=100')
        ).body.data;
        const landlordNotifications = (
          await notifications(landlord.session.access_token, '?limit=100')
        ).body.data;
        for (const [type, applicationId] of [
          ['VIEWING_PROPOSED', proposal.applicationId],
          ['VIEWING_CANCELLED', cancelledApp.applicationId],
          ['VIEWING_COMPLETED', completedApp.applicationId],
          ['VIEWING_NO_SHOW', noShowApp.applicationId],
        ]) {
          assert.equal(
            tenantNotifications.some(
              (item) =>
                item.type === type && item.target?.endsWith(applicationId),
            ),
            true,
          );
        }
        for (const [type, applicationId] of [
          ['VIEWING_CONFIRMED', proposal.applicationId],
          ['VIEWING_DECLINED', declinedApp.applicationId],
        ]) {
          assert.equal(
            landlordNotifications.some(
              (item) =>
                item.type === type && item.target?.endsWith(applicationId),
            ),
            true,
          );
        }
      },
    );

    await check(
      'new message notifies only the counterparty without body leakage',
      async () => {
        const conversation = await fixture('SUBMITTED');
        const created = await api(
          `/listings/${conversation.listingId}/conversation`,
          tenant.session.access_token,
          'POST',
          {},
        );
        assert.equal(created.status, 201);
        ids.conversations.push(created.body.data.id);
        const before = await count(tenant.session.access_token);
        assert.equal(
          (
            await api(
              `/conversations/${created.body.data.id}/messages`,
              tenant.session.access_token,
              'POST',
              { body: 'private body must not be in notification' },
            )
          ).status,
          201,
        );
        const landlordList = await notifications(
          landlord.session.access_token,
          '?limit=100',
        );
        const message = landlordList.body.data.find(
          (item) =>
            item.type === 'MESSAGE_RECEIVED' &&
            item.target?.includes(created.body.data.id),
        );
        assert.ok(message);
        assert.equal(message.message.includes('private body'), false);
        assert.equal(
          (await count(tenant.session.access_token)) >= before,
          true,
        );
        assert.equal(
          (
            await notifications(tenant.session.access_token, '?limit=100')
          ).body.data.some(
            (item) =>
              item.type === 'MESSAGE_RECEIVED' &&
              item.target?.includes(created.body.data.id),
          ),
          false,
        );
      },
    );

    await check(
      'notification pagination, unread/read state, own-only access, and safe serialization',
      async () => {
        const list = await notifications(
          landlord.session.access_token,
          '?page=1&limit=2&unread_only=true',
        );
        assert.equal(list.status, 200);
        assert.ok(list.body.meta.limit === 2);
        assert.equal(JSON.stringify(list.body).includes('user_id'), false);
        assert.equal(JSON.stringify(list.body).includes('actor'), false);
        assert.equal(JSON.stringify(list.body).includes('private body'), false);
        const item = list.body.data[0];
        if (item) {
          assert.equal(
            (
              await api(
                `/notifications/${item.id}/read`,
                tenant.session.access_token,
                'POST',
                {},
              )
            ).status,
            404,
          );
          assert.equal(
            (
              await api(
                `/notifications/${item.id}/read`,
                landlord.session.access_token,
                'POST',
                {},
              )
            ).status,
            200,
          );
          assert.equal(
            (
              await api(
                `/notifications/${item.id}/read`,
                landlord.session.access_token,
                'POST',
                {},
              )
            ).status,
            200,
          );
        }
        assert.equal(
          (
            await api(
              '/notifications/read-all',
              landlord.session.access_token,
              'POST',
              {},
            )
          ).status,
          200,
        );
        assert.equal(await count(landlord.session.access_token), 0);
      },
    );

    await check(
      'publishable-key notification access and writes remain blocked',
      async () => {
        const directRead = await publishable
          .from('notifications')
          .select('*')
          .limit(1);
        assert.equal(
          directRead.error === null && (directRead.data?.length ?? 0) === 0,
          true,
        );
        const directWrite = await publishable
          .from('notifications')
          .insert({ type: 'MESSAGE_RECEIVED', title: 'x', message: 'x' });
        assert.ok(directWrite.error);
      },
    );
  } finally {
    if (ids.applications.length)
      await admin
        .from('notifications')
        .delete()
        .in('entity_id', ids.applications);
    if (ids.conversations.length)
      await admin
        .from('notifications')
        .delete()
        .in('entity_id', ids.conversations);
    if (ids.conversations.length)
      await admin.from('conversations').delete().in('id', ids.conversations);
    if (ids.viewings.length)
      await admin.from('viewings').delete().in('id', ids.viewings);
    if (ids.applications.length)
      await admin
        .from('application_status_history')
        .delete()
        .in('application_id', ids.applications);
    if (ids.applications.length)
      await admin.from('applications').delete().in('id', ids.applications);
    if (ids.listings.length)
      await admin.from('listings').delete().in('id', ids.listings);
    if (ids.properties.length)
      await admin.from('properties').delete().in('id', ids.properties);
    await server.close();
  }
  console.log(
    `Hosted notification verification passed: ${passed.length} checks.`,
  );
  for (const name of passed) console.log(`  PASS ${name}`);
}
