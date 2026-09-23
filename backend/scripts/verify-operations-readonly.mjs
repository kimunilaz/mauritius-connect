import assert from 'node:assert/strict';
import process from 'node:process';
import console from 'node:console';
import { Client } from 'pg';
import { readdir } from 'node:fs/promises';
process.loadEnvFile('backend/.env');
const db = new Client({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 15000,
});
await db.connect();
try {
  await db.query('begin read only');
  const { rows } = await db.query(
    'select version from supabase_migrations.schema_migrations order by version',
  );
  const local = (await readdir('database/migrations'))
    .filter((n) => n.endsWith('.sql'))
    .sort();
  const pending = local.filter(
    (n) => !rows.some((r) => n.startsWith(r.version + '_')),
  );
  console.log(`Hosted migration ledger: ${rows.length} applied.`);
  console.log('Pending forward migrations:', pending.join(', ') || 'none');
  const bucket = await db.query(
    "select public, file_size_limit, allowed_mime_types from storage.buckets where id='property-operations'",
  );
  console.log(
    'Operations private bucket:',
    bucket.rows.length
      ? bucket.rows[0].public
        ? 'UNSAFE PUBLIC'
        : 'present/private'
      : 'not configured',
  );
  if (!pending.length) {
    const { rows: tables } = await db.query(
      "select relname,relrowsecurity from pg_class join pg_namespace ns on ns.oid=relnamespace where ns.nspname='public' and relname=any($1)",
      [
        [
          'property_operational_details',
          'tenancies',
          'rent_ledger_entries',
          'rent_receipts',
          'maintenance_requests',
          'maintenance_updates',
          'property_inspections',
          'property_documents',
          'property_financial_records',
          'property_tasks',
          'property_manager_profiles',
          'managed_property_owners',
        ],
      ],
    );
    assert.equal(tables.length, 12);
    assert.ok(tables.every((t) => t.relrowsecurity));
    assert.equal(bucket.rows[0]?.public, false);
    assert.equal(Number(bucket.rows[0]?.file_size_limit), 10485760);
    const { rows: grants } = await db.query(
      "select routine_name from information_schema.routine_privileges where specific_schema='public' and routine_name in ('owner_operations_summary','operations_rent_records','record_rent_receipt','claim_tenancy','tenancy_conversation','managed_owner_directory') and grantee in ('PUBLIC','anon','authenticated')",
    );
    assert.equal(grants.length, 0);
    console.log('Operations RLS, private bucket and RPC grants verified.');
  } else
    console.log(
      'Hosted operations verification pending migration authorization; no changes made.',
    );
  await db.query('rollback');
} finally {
  await db.end();
}
