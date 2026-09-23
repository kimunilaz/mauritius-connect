import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import {
  fixtures,
  fixtureId,
  seedMarketplace,
  imageManifest,
} from '../seeds/marketplace/seed.mjs';
const db = new PGlite();
try {
  await db.exec(
    `create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key,email text unique);`,
  );
  for (const name of (await readdir(new URL('../migrations/', import.meta.url)))
    .filter((n) => n.endsWith('.sql'))
    .sort())
    await db.exec(
      await readFile(new URL(`../migrations/${name}`, import.meta.url), 'utf8'),
    );
  const userId = '27000000-0000-4000-8000-000000000001';
  const landlordId = '27000000-0000-4000-8000-000000000002';
  await db.query('insert into auth.users(id,email) values($1,$2)', [
    userId,
    'marketplace@example.test',
  ]);
  await db.query(
    "insert into profiles(id,role,first_name,last_name) values($1,'LANDLORD','Fixture','Owner')",
    [userId],
  );
  await db.query('insert into landlord_profiles(id,user_id) values($1,$2)', [
    landlordId,
    userId,
  ]);
  // PGlite has no concurrent sessions/advisory locks; all remaining SQL is real.
  const adapter = {
    query: (sql, args) =>
      sql.includes('pg_advisory_xact_lock')
        ? Promise.resolve({ rows: [] })
        : db.query(sql, args),
  };
  await seedMarketplace(adapter, landlordId);
  const first = (
    await db.query('select id,published_at from listings order by id')
  ).rows;
  await seedMarketplace(adapter, landlordId);
  assert.equal(
    (await db.query('select count(*)::int as n from properties')).rows[0].n,
    20,
  );
  assert.equal(
    (await db.query('select count(*)::int as n from listings')).rows[0].n,
    20,
  );
  assert.equal(
    (await db.query('select count(*)::int as n from property_images')).rows[0]
      .n,
    60,
  );
  assert.deepEqual(
    (await db.query('select id,published_at from listings order by id')).rows,
    first,
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int as n from listings where status='ACTIVE'",
      )
    ).rows[0].n,
    20,
  );
  await db.query("update listings set status='PAUSED' where id=$1", [
    fixtureId(2, 1),
  ]);
  await seedMarketplace(adapter, landlordId);
  assert.equal(
    (
      await db.query('select status from listings where id=$1', [
        fixtureId(2, 1),
      ])
    ).rows[0].status,
    'PAUSED',
  );
  await assert.rejects(seedMarketplace(adapter, userId), /ownership mismatch/);
  await seedMarketplace(adapter, landlordId, { remove: true });
  await seedMarketplace(adapter, landlordId);
  assert.equal(
    (
      await db.query(
        'select count(*)::int as n from properties where archived_at is not null',
      )
    ).rows[0].n,
    20,
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int as n from listings where status='ACTIVE'",
      )
    ).rows[0].n,
    0,
  );
  assert.equal(fixtures.length, 20);
  for (const assignment of imageManifest.assignments) {
    assert.equal(new Set(assignment.images).size, 3);
    for (const id of assignment.images)
      assert.ok(imageManifest.sources.some((s) => s.id === id));
  }
  console.log(
    'PASS: 20 listings / 20 properties / 60 images; repeatability, timestamps, state preservation, ownership guard, recoverable removal, image coverage.',
  );
} finally {
  await db.close();
}
