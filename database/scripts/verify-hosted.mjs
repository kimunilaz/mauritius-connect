import assert from 'node:assert/strict';
import process from 'node:process';
import { Client } from 'pg';

process.loadEnvFile('backend/.env');

assert.ok(
  process.env.DATABASE_URL,
  'DATABASE_URL is required in backend/.env for hosted verification.',
);

const expectedTables = [
  'admin_audit_logs',
  'application_answers',
  'application_question_options',
  'application_questions',
  'application_status_history',
  'applications',
  'conversation_participants',
  'conversations',
  'landlord_profiles',
  'listings',
  'messages',
  'notifications',
  'profiles',
  'properties',
  'property_images',
  'reports',
  'saved_listings',
  'tenant_preferred_locations',
  'tenant_profiles',
  'verification_records',
  'viewings',
];

const requiredIndexes = [
  'admin_audit_logs_admin_user_id_created_at_idx',
  'application_answers_application_question_key',
  'application_answers_question_id_idx',
  'application_question_options_question_id_idx',
  'application_questions_listing_id_idx',
  'application_status_history_application_id_idx',
  'application_status_history_one_submission_idx',
  'applications_listing_id_idx',
  'applications_listing_id_status_idx',
  'applications_listing_tenant_key',
  'applications_one_accepted_per_listing_idx',
  'applications_tenant_id_idx',
  'conversation_participants_user_id_idx',
  'conversations_landlord_user_id_idx',
  'conversations_listing_parties_key',
  'conversations_tenant_user_id_idx',
  'landlord_profiles_user_id_key',
  'listings_available_from_idx',
  'listings_monthly_rent_idx',
  'listings_one_live_per_property_idx',
  'listings_property_id_idx',
  'listings_status_idx',
  'messages_conversation_id_created_at_idx',
  'messages_sender_user_id_idx',
  'notifications_user_id_created_at_idx',
  'notifications_user_id_unread_idx',
  'profiles_role_idx',
  'properties_district_locality_idx',
  'properties_landlord_id_idx',
  'property_images_one_cover_per_property_idx',
  'property_images_property_id_idx',
  'reports_listing_id_idx',
  'reports_reported_user_id_idx',
  'reports_reporter_user_id_idx',
  'saved_listings_listing_id_idx',
  'tenant_preferred_locations_tenant_profile_id_idx',
  'tenant_profiles_user_id_key',
  'verification_records_reviewed_by_user_id_idx',
  'verification_records_subject_idx',
  'viewings_application_id_idx',
  'viewings_one_open_per_application_idx',
];

const expectedTriggers = [
  'application_answers_require_draft',
  'application_answers_set_updated_at',
  'application_questions_set_updated_at',
  'applications_set_updated_at',
  'conversations_set_updated_at',
  'landlord_profiles_set_updated_at',
  'listings_set_updated_at',
  'profiles_set_updated_at',
  'properties_set_updated_at',
  'tenant_profiles_set_updated_at',
  'viewings_set_updated_at',
];

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 15_000,
  keepAlive: true,
  // The shared Supavisor pooler chain is not trusted by this Windows runtime.
  // This matches libpq sslmode=require: traffic is encrypted, but a project CA
  // should be supplied before reusing this connection pattern in production.
  ssl: { rejectUnauthorized: false },
});

const passed = [];
let activeCheck = 'database connection';

async function check(name, callback) {
  activeCheck = name;
  await callback();
  passed.push(name);
}

try {
  await client.connect();

  await check(
    'migration history contains the foundation and transaction migrations',
    async () => {
      const { rows } = await client.query(`
      select version
      from supabase_migrations.schema_migrations
      where version = any(array[
        '202608190001',
        '202608190002',
        '202608190003',
        '202608190004',
        '202608190005',
        '202608220001',
        '202608220002',
        '202608220003'
      ])
      order by version
    `);
      assert.deepEqual(
        rows.map(({ version }) => version),
        [
          '202608190001',
          '202608190002',
          '202608190003',
          '202608190004',
          '202608190005',
          '202608220001',
          '202608220002',
          '202608220003',
        ],
      );
    },
  );

  await check('all 21 application tables exist', async () => {
    const { rows } = await client.query(
      `
      select tablename
      from pg_tables
      where schemaname = 'public'
        and tablename = any($1::text[])
      order by tablename
    `,
      [expectedTables],
    );
    assert.deepEqual(
      rows.map(({ tablename }) => tablename),
      expectedTables,
    );
  });

  await check('primary keys and foreign keys match the contract', async () => {
    const { rows } = await client.query(
      `
      select
        count(*) filter (where constraint_type = 'PRIMARY KEY')::integer
          as primary_keys,
        count(*) filter (where constraint_type = 'FOREIGN KEY')::integer
          as foreign_keys
      from information_schema.table_constraints
      where table_schema = 'public'
        and table_name = any($1::text[])
    `,
      [expectedTables],
    );
    assert.deepEqual(rows[0], { primary_keys: 21, foreign_keys: 33 });
  });

  await check(
    'profiles.id references auth.users.id with delete restriction',
    async () => {
      const { rows } = await client.query(`
      select
        referenced_namespace.nspname as referenced_schema,
        referenced_table.relname as referenced_table,
        constraint_record.confdeltype as delete_action
      from pg_constraint constraint_record
      join pg_class source_table
        on source_table.oid = constraint_record.conrelid
      join pg_namespace source_namespace
        on source_namespace.oid = source_table.relnamespace
      join pg_class referenced_table
        on referenced_table.oid = constraint_record.confrelid
      join pg_namespace referenced_namespace
        on referenced_namespace.oid = referenced_table.relnamespace
      where constraint_record.conname = 'profiles_auth_user_fk'
        and source_namespace.nspname = 'public'
        and source_table.relname = 'profiles'
    `);
      assert.deepEqual(rows, [
        {
          referenced_schema: 'auth',
          referenced_table: 'users',
          delete_action: 'r',
        },
      ]);
    },
  );

  await check('RLS is enabled with no application-table policies', async () => {
    const tables = await client.query(
      `
      select relname as table_name, relrowsecurity as enabled
      from pg_class
      join pg_namespace on pg_namespace.oid = pg_class.relnamespace
      where pg_namespace.nspname = 'public'
        and pg_class.relkind = 'r'
        and relname = any($1::text[])
      order by relname
    `,
      [expectedTables],
    );
    assert.equal(tables.rows.length, expectedTables.length);
    assert.ok(tables.rows.every(({ enabled }) => enabled));

    const policies = await client.query(
      `
      select count(*)::integer as count
      from pg_policies
      where schemaname = 'public'
        and tablename = any($1::text[])
    `,
      [expectedTables],
    );
    assert.equal(policies.rows[0].count, 0);
  });

  await check('required indexes exist and are valid', async () => {
    const { rows } = await client.query(
      `
      select indexrelid::regclass::text as index_name, indisvalid
      from pg_index
      join pg_class source_table on source_table.oid = pg_index.indrelid
      join pg_namespace source_namespace
        on source_namespace.oid = source_table.relnamespace
      where source_namespace.nspname = 'public'
        and indexrelid::regclass::text = any($1::text[])
      order by index_name
    `,
      [requiredIndexes],
    );
    assert.deepEqual(
      rows.map(({ index_name: indexName }) => indexName),
      [...requiredIndexes].sort(),
    );
    assert.ok(rows.every(({ indisvalid }) => indisvalid));
  });

  await check(
    'partial unique indexes enforce critical invariants',
    async () => {
      const { rows } = await client.query(
        `
      select
        indexname,
        indexdef,
        pg_get_expr(pg_index.indpred, pg_index.indrelid) as predicate
      from pg_indexes
      join pg_class index_table on index_table.relname = pg_indexes.indexname
      join pg_index on pg_index.indexrelid = index_table.oid
      where schemaname = 'public'
        and indexname = any($1::text[])
      order by indexname
    `,
        [
          [
            'applications_one_accepted_per_listing_idx',
            'application_status_history_one_submission_idx',
            'listings_one_live_per_property_idx',
            'notifications_user_id_unread_idx',
            'property_images_one_cover_per_property_idx',
          ],
        ],
      );
      assert.equal(rows.length, 5);
      assert.ok(
        rows.every(
          ({ indexdef, predicate }) =>
            /create unique index/i.test(indexdef) ||
            (/notifications_user_id_unread_idx/i.test(indexdef) && predicate),
        ),
      );
      assert.match(
        rows.find(
          ({ indexname }) =>
            indexname === 'property_images_one_cover_per_property_idx',
        ).predicate,
        /is_cover = true/i,
      );
      assert.match(
        rows.find(
          ({ indexname }) => indexname === 'listings_one_live_per_property_idx',
        ).predicate,
        /pending_review.*active.*paused/i,
      );
      assert.match(
        rows.find(
          ({ indexname }) =>
            indexname === 'applications_one_accepted_per_listing_idx',
        ).predicate,
        /accepted/i,
      );
      assert.match(
        rows.find(
          ({ indexname }) =>
            indexname === 'application_status_history_one_submission_idx',
        ).predicate,
        /draft.*submitted/i,
      );
    },
  );

  await check('one application per tenant and listing is unique', async () => {
    const { rows } = await client.query(`
      select constraint_type
      from information_schema.table_constraints
      where table_schema = 'public'
        and table_name = 'applications'
        and constraint_name = 'applications_listing_tenant_key'
    `);
    assert.deepEqual(rows, [{ constraint_type: 'UNIQUE' }]);
  });

  await check('updated_at triggers exist and are enabled', async () => {
    const { rows } = await client.query(
      `
      select trigger_name
      from information_schema.triggers
      where event_object_schema = 'public'
        and trigger_name = any($1::text[])
      group by trigger_name
      order by trigger_name
    `,
      [expectedTriggers],
    );
    assert.deepEqual(
      rows.map(({ trigger_name: triggerName }) => triggerName),
      expectedTriggers,
    );
  });

  await check(
    'transaction functions are backend-only and search-path hardened',
    async () => {
      const { rows } = await client.query(`
      select
        routine.proname as function_name,
        routine.prosecdef as security_definer,
        routine.proconfig,
        has_function_privilege(
          'anon', routine.oid, 'EXECUTE'
        ) as anon_execute,
        has_function_privilege(
          'authenticated', routine.oid, 'EXECUTE'
        ) as authenticated_execute,
        has_function_privilege(
          'service_role', routine.oid, 'EXECUTE'
        ) as service_execute
      from pg_proc routine
      join pg_namespace namespace on namespace.oid = routine.pronamespace
      where namespace.nspname = 'public'
        and routine.proname in (
          'mutate_application_question_transaction',
          'submit_application_transaction',
          'transition_application_status_transaction',
          'propose_viewing_transaction',
          'transition_viewing_transaction'
        )
      order by routine.proname
    `);
      assert.equal(rows.length, 5);
      assert.ok(
        rows.every(({ security_definer: value }) => value),
        'transaction functions must be SECURITY DEFINER',
      );
      assert.ok(
        rows.every(({ proconfig }) =>
          proconfig.some((value) => value.startsWith('search_path=')),
        ),
        'transaction functions must pin search_path',
      );
      assert.ok(
        rows.every(({ anon_execute: value }) => !value),
        'anon must not execute transaction functions',
      );
      assert.ok(
        rows.every(({ authenticated_execute: value }) => !value),
        'authenticated must not execute transaction functions',
      );
      assert.ok(
        rows.every(({ service_execute: value }) => value),
        'service role must execute transaction functions',
      );
    },
  );

  console.log(
    `Hosted Supabase verification passed: ${passed.length} read-only catalog checks.`,
  );
  for (const name of passed) {
    console.log(`  PASS ${name}`);
  }
} catch (error) {
  const safeReason =
    error instanceof assert.AssertionError
      ? error.message
      : (error.code ?? error.name ?? 'UNKNOWN_ERROR');
  console.error(`Hosted Supabase verification failed: ${safeReason}`);
  console.error(`Failed check: ${activeCheck}.`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
