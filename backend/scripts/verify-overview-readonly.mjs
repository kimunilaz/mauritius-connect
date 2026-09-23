import assert from 'node:assert/strict';
import process from 'node:process';
import console from 'node:console';
import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';

// No identities, fixtures, migrations, or application data are written.
process.loadEnvFile('backend/.env');
const { createOverviewRepository } =
  await import('../src/repositories/overviewRepository.js');
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async (...args) => {
        const response = await globalThis.fetch(...args);
        if (!response.ok) {
          const error = await response.clone().json();
          console.error(
            'Read-only query failed:',
            response.status,
            error.code,
            error.message,
          );
        }
        return response;
      },
    },
  },
);
const repository = createOverviewRepository(() => supabase);
const db = new Client({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000,
});
await db.connect();
try {
  await db.query('begin read only');
  const admin = await repository.admin();
  const counts = await db.query(`select
    (select count(*)::int from public.listings where status='PENDING_REVIEW') as listings,
    (select count(*)::int from public.reports where status in ('OPEN','UNDER_REVIEW')) as reports,
    (select count(*)::int from public.verification_records where status in ('PENDING','UNDER_REVIEW')) as verifications,
    (select count(*)::int from public.profiles where account_status='SUSPENDED') as users`);
  for (const key of Object.keys(admin)) {
    assert.equal(admin[key].total, counts.rows[0][key]);
    assert.ok(admin[key].items.length <= 3);
  }
  assert.doesNotMatch(
    JSON.stringify(admin),
    /evidence_path|content|introductory_message|resolution_notes/,
  );
  const landlords =
    await db.query(`select lp.user_id from public.landlord_profiles lp
    join public.profiles p on p.id=lp.user_id and p.role='LANDLORD'
    left join public.properties pr on pr.landlord_id=lp.id
    left join public.listings l on l.property_id=pr.id
    left join public.applications a on a.listing_id=l.id
    group by lp.user_id order by count(a.id) desc, lp.user_id limit 3`);
  for (const { user_id: owner } of landlords.rows) {
    const summary = await repository.landlord(owner);
    const expected = await db.query(
      `select count(*)::int as total,
      count(*) filter (where a.status in ('SUBMITTED','UNDER_REVIEW'))::int as waiting
      from public.applications a join public.listings l on l.id=a.listing_id
      join public.properties p on p.id=l.property_id
      join public.landlord_profiles lp on lp.id=p.landlord_id
      where lp.user_id=$1 and a.status<>'DRAFT' and a.submitted_at is not null`,
      [owner],
    );
    assert.equal(summary.applications.total, expected.rows[0].total);
    assert.equal(summary.applications.waiting, expected.rows[0].waiting);
    assert.ok(summary.applications.items.length <= 3);
    assert.ok(summary.viewings.items.length <= 3);
    for (const item of [
      ...summary.applications.items,
      ...summary.viewings.items,
    ]) {
      const applicationId = item.application_id ?? item.id;
      const allowed = await db.query(
        `select a.status from public.applications a
        join public.listings l on l.id=a.listing_id join public.properties p on p.id=l.property_id
        join public.landlord_profiles lp on lp.id=p.landlord_id
        where a.id=$1 and lp.user_id=$2 and a.status<>'DRAFT' and a.submitted_at is not null`,
        [applicationId, owner],
      );
      assert.equal(allowed.rowCount, 1);
    }
  }
  const unrelated = await repository.landlord(
    '00000000-0000-4000-8000-000000000000',
  );
  assert.equal(unrelated.applications.total, 0);
  assert.equal(unrelated.viewings.total, 0);
  console.log(
    `Read-only overview verification passed: admin totals, ${landlords.rowCount} landlord scopes, bounded previews, unrelated-owner isolation.`,
  );
} finally {
  await db.query('rollback');
  await db.end();
}
