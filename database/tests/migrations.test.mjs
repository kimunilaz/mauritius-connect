import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const migrationsDirectory = fileURLToPath(
  new URL('../migrations/', import.meta.url),
);
const seedPath = fileURLToPath(
  new URL('../seeds/development_seed.sql', import.meta.url),
);

const expectedTables = [
  'profiles',
  'tenant_profiles',
  'tenant_preferred_locations',
  'landlord_profiles',
  'properties',
  'property_images',
  'listings',
  'saved_listings',
  'application_questions',
  'application_question_options',
  'applications',
  'application_answers',
  'application_status_history',
  'viewings',
  'conversations',
  'conversation_participants',
  'messages',
  'notifications',
  'reports',
  'verification_records',
  'admin_audit_logs',
];

const db = new PGlite();
const passedTests = [];

async function test(name, callback) {
  await callback();
  passedTests.push(name);
}

async function expectConstraintFailure(name, sql, constraintName) {
  await test(name, async () => {
    await assert.rejects(db.exec(sql), new RegExp(constraintName, 'i'));
  });
}

try {
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    create schema auth;
    create table auth.users (
      id uuid primary key,
      email text unique
    );
  `);

  const migrationNames = (await readdir(migrationsDirectory))
    .filter((name) => name.endsWith('.sql'))
    .sort();

  for (const name of migrationNames) {
    await db.exec(await readFile(`${migrationsDirectory}${name}`, 'utf8'));
  }

  await test('creates every TASK-001 table', async () => {
    const result = await db.query(`
      select tablename
      from pg_tables
      where schemaname = 'public'
      order by tablename
    `);
    assert.deepEqual(
      result.rows.map(({ tablename }) => tablename),
      [...expectedTables].sort(),
    );
  });

  await test('creates every documented primary key and foreign key', async () => {
    const result = await db.query(`
      select
        count(*) filter (where constraint_type = 'PRIMARY KEY')::integer
          as primary_keys,
        count(*) filter (where constraint_type = 'FOREIGN KEY')::integer
          as foreign_keys
      from information_schema.table_constraints
      where table_schema = 'public'
    `);
    assert.deepEqual(result.rows[0], {
      primary_keys: 21,
      foreign_keys: 33,
    });
  });

  await test('enables RLS with no policies on every application table', async () => {
    const tables = await db.query(`
      select tablename, rowsecurity
      from pg_tables
      where schemaname = 'public'
      order by tablename
    `);
    assert.equal(tables.rows.length, expectedTables.length);
    assert.ok(tables.rows.every(({ rowsecurity }) => rowsecurity));

    const policies = await db.query(`
      select count(*)::integer as count
      from pg_policies
      where schemaname = 'public'
    `);
    assert.equal(policies.rows[0].count, 0);
  });

  await db.exec(`
    insert into auth.users (id, email) values
      ('00000000-0000-0000-0000-000000000001', 'fixture-tenant-1@example.test'),
      ('00000000-0000-0000-0000-000000000002', 'fixture-tenant-2@example.test'),
      ('00000000-0000-0000-0000-000000000003', 'fixture-tenant-3@example.test'),
      ('00000000-0000-0000-0000-000000000004', 'fixture-landlord@example.test');

    insert into public.profiles (id, role, first_name, last_name) values
      ('00000000-0000-0000-0000-000000000001', 'TENANT', 'Fixture', 'Tenant One'),
      ('00000000-0000-0000-0000-000000000002', 'TENANT', 'Fixture', 'Tenant Two'),
      ('00000000-0000-0000-0000-000000000003', 'TENANT', 'Fixture', 'Tenant Three'),
      ('00000000-0000-0000-0000-000000000004', 'LANDLORD', 'Fixture', 'Landlord');

    insert into public.tenant_profiles (id, user_id) values
      ('01000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001'),
      ('01000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002'),
      ('01000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003');

    insert into public.landlord_profiles (id, user_id) values
      ('02000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004');

    insert into public.properties (
      id,
      landlord_id,
      property_type,
      district,
      locality,
      bedrooms,
      bathrooms
    ) values (
      '03000000-0000-0000-0000-000000000001',
      '02000000-0000-0000-0000-000000000001',
      'APARTMENT',
      'Moka',
      'Moka',
      2,
      1.5
    );

    insert into public.property_images (
      id,
      property_id,
      storage_path,
      is_cover
    ) values (
      '03100000-0000-0000-0000-000000000001',
      '03000000-0000-0000-0000-000000000001',
      'fixture/cover-a.jpg',
      true
    );

    insert into public.listings (
      id,
      property_id,
      title,
      description,
      monthly_rent,
      available_from,
      status
    ) values (
      '04000000-0000-0000-0000-000000000001',
      '03000000-0000-0000-0000-000000000001',
      'Fixture listing',
      'Fixture listing for database verification.',
      25000.00,
      current_date,
      'ACTIVE'
    );

    insert into public.applications (
      id,
      listing_id,
      tenant_id,
      number_of_occupants,
      status,
      submitted_at
    ) values (
      '05000000-0000-0000-0000-000000000001',
      '04000000-0000-0000-0000-000000000001',
      '01000000-0000-0000-0000-000000000001',
      1,
      'ACCEPTED',
      now()
    );
  `);

  await expectConstraintFailure(
    'rejects a second cover image for one property',
    `
      insert into public.property_images (
        property_id,
        storage_path,
        is_cover
      ) values (
        '03000000-0000-0000-0000-000000000001',
        'fixture/cover-b.jpg',
        true
      )
    `,
    'property_images_one_cover_per_property_idx',
  );

  await expectConstraintFailure(
    'rejects a second live listing for one property',
    `
      insert into public.listings (
        property_id,
        title,
        description,
        monthly_rent,
        available_from,
        status
      ) values (
        '03000000-0000-0000-0000-000000000001',
        'Second live listing',
        'Must fail.',
        26000.00,
        current_date,
        'PAUSED'
      )
    `,
    'listings_one_live_per_property_idx',
  );

  await expectConstraintFailure(
    'rejects a second application by a tenant for one listing',
    `
      insert into public.applications (listing_id, tenant_id)
      values (
        '04000000-0000-0000-0000-000000000001',
        '01000000-0000-0000-0000-000000000001'
      )
    `,
    'applications_listing_tenant_key',
  );

  await expectConstraintFailure(
    'rejects a second accepted application for one listing',
    `
      insert into public.applications (
        listing_id,
        tenant_id,
        status,
        submitted_at
      ) values (
        '04000000-0000-0000-0000-000000000001',
        '01000000-0000-0000-0000-000000000002',
        'ACCEPTED',
        now()
      )
    `,
    'applications_one_accepted_per_listing_idx',
  );

  await expectConstraintFailure(
    'rejects negative rent',
    `
      insert into public.listings (
        property_id,
        title,
        description,
        monthly_rent,
        available_from
      ) values (
        '03000000-0000-0000-0000-000000000001',
        'Negative rent',
        'Must fail.',
        -1.00,
        current_date
      )
    `,
    'listings_monthly_rent_check',
  );

  await expectConstraintFailure(
    'rejects invalid applicant occupants',
    `
      insert into public.applications (
        listing_id,
        tenant_id,
        number_of_occupants
      ) values (
        '04000000-0000-0000-0000-000000000001',
        '01000000-0000-0000-0000-000000000003',
        0
      )
    `,
    'applications_number_of_occupants_check',
  );

  await expectConstraintFailure(
    'rejects invalid listing status',
    `
      insert into public.listings (
        property_id,
        title,
        description,
        monthly_rent,
        available_from,
        status
      ) values (
        '03000000-0000-0000-0000-000000000001',
        'Invalid status',
        'Must fail.',
        100.00,
        current_date,
        'NOT_A_STATUS'
      )
    `,
    'listings_status_check',
  );

  await expectConstraintFailure(
    'requires submitted_at for non-draft applications',
    `
      insert into public.applications (
        listing_id,
        tenant_id,
        status
      ) values (
        '04000000-0000-0000-0000-000000000001',
        '01000000-0000-0000-0000-000000000002',
        'SUBMITTED'
      )
    `,
    'applications_submitted_at_check',
  );

  await expectConstraintFailure(
    'requires a report target',
    `
      insert into public.reports (reporter_user_id, reason)
      values (
        '00000000-0000-0000-0000-000000000001',
        'OTHER'
      )
    `,
    'reports_target_check',
  );

  await expectConstraintFailure(
    'requires viewing end time to follow start time',
    `
      insert into public.viewings (
        application_id,
        proposed_by_user_id,
        start_time,
        end_time
      ) values (
        '05000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000004',
        '2026-08-20T10:00:00+04:00',
        '2026-08-20T09:00:00+04:00'
      )
    `,
    'viewings_time_order_check',
  );

  await test('updates updated_at automatically', async () => {
    await db.exec(`
      update public.profiles
      set first_name = 'Updated', updated_at = '2000-01-01T00:00:00Z'
      where id = '00000000-0000-0000-0000-000000000001'
    `);
    const result = await db.query(`
      select updated_at > '2020-01-01T00:00:00Z'::timestamptz as updated
      from public.profiles
      where id = '00000000-0000-0000-0000-000000000001'
    `);
    assert.equal(result.rows[0].updated, true);
  });

  await db.exec(`
    insert into public.application_questions (
      id, listing_id, question_text, question_type, is_required
    ) values (
      '06000000-0000-0000-0000-000000000001',
      '04000000-0000-0000-0000-000000000001',
      'Why is this home suitable?',
      'TEXT',
      true
    );

    insert into public.applications (
      id,
      listing_id,
      tenant_id,
      move_in_date,
      requested_lease_duration_months,
      number_of_occupants
    ) values (
      '05000000-0000-0000-0000-000000000002',
      '04000000-0000-0000-0000-000000000001',
      '01000000-0000-0000-0000-000000000002',
      current_date + 30,
      12,
      2
    ), (
      '05000000-0000-0000-0000-000000000003',
      '04000000-0000-0000-0000-000000000001',
      '01000000-0000-0000-0000-000000000003',
      current_date + 45,
      12,
      1
    );

    insert into public.application_answers (
      application_id, question_id, answer_text
    ) values (
      '05000000-0000-0000-0000-000000000002',
      '06000000-0000-0000-0000-000000000001',
      'It is suitable for my household.'
    );
  `);

  await test('submits once and records exactly one attributed transition', async () => {
    const first = await db.query(`
      select * from public.submit_application_transaction(
        '05000000-0000-0000-0000-000000000002',
        '01000000-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-000000000002'
      )
    `);
    const repeated = await db.query(`
      select * from public.submit_application_transaction(
        '05000000-0000-0000-0000-000000000002',
        '01000000-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-000000000002'
      )
    `);
    assert.equal(first.rows[0].outcome, 'SUBMITTED');
    assert.equal(repeated.rows[0].outcome, 'ALREADY_SUBMITTED');
    const state = await db.query(`
      select
        applications.status,
        applications.submitted_at is not null as has_submitted_at,
        count(application_status_history.id)::integer as history_count,
        min(application_status_history.changed_by_user_id::text) as actor
      from public.applications
      left join public.application_status_history
        on application_status_history.application_id = applications.id
       and application_status_history.from_status = 'DRAFT'
       and application_status_history.to_status = 'SUBMITTED'
      where applications.id = '05000000-0000-0000-0000-000000000002'
      group by applications.id
    `);
    assert.deepEqual(state.rows[0], {
      status: 'SUBMITTED',
      has_submitted_at: true,
      history_count: 1,
      actor: '00000000-0000-0000-0000-000000000002',
    });
  });

  await test('serializes landlord state transitions with idempotent history', async () => {
    const reviewed = await db.query(`
      select * from public.transition_application_status_transaction(
        '05000000-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-000000000004',
        'LANDLORD',
        'SUBMITTED',
        'UNDER_REVIEW'
      )
    `);
    const repeated = await db.query(`
      select * from public.transition_application_status_transaction(
        '05000000-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-000000000004',
        'LANDLORD',
        'UNDER_REVIEW',
        'UNDER_REVIEW'
      )
    `);
    const staleReject = await db.query(`
      select * from public.transition_application_status_transaction(
        '05000000-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-000000000004',
        'LANDLORD',
        'SUBMITTED',
        'REJECTED'
      )
    `);
    assert.equal(reviewed.rows[0].outcome, 'TRANSITIONED');
    assert.equal(repeated.rows[0].outcome, 'ALREADY_TARGET');
    assert.equal(staleReject.rows[0].outcome, 'INVALID_TRANSITION');
    const state = await db.query(`
      select applications.status, count(history.id)::integer as history_count
      from public.applications
      left join public.application_status_history history
        on history.application_id = applications.id
       and history.from_status = 'SUBMITTED'
       and history.to_status = 'UNDER_REVIEW'
      where applications.id = '05000000-0000-0000-0000-000000000002'
      group by applications.id
    `);
    assert.deepEqual(state.rows[0], {
      status: 'UNDER_REVIEW',
      history_count: 1,
    });
  });

  await test('supports shortlist and rejection only through approved edges', async () => {
    const shortlisted = await db.query(`
      select * from public.transition_application_status_transaction(
        '05000000-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-000000000004',
        'LANDLORD',
        'UNDER_REVIEW',
        'SHORTLISTED'
      )
    `);
    const rejected = await db.query(`
      select * from public.transition_application_status_transaction(
        '05000000-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-000000000004',
        'LANDLORD',
        'SHORTLISTED',
        'REJECTED'
      )
    `);
    const terminal = await db.query(`
      select * from public.transition_application_status_transaction(
        '05000000-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-000000000002',
        'TENANT',
        'REJECTED',
        'WITHDRAWN'
      )
    `);
    assert.equal(shortlisted.rows[0].outcome, 'TRANSITIONED');
    assert.equal(rejected.rows[0].outcome, 'TRANSITIONED');
    assert.equal(terminal.rows[0].outcome, 'INVALID_TRANSITION');
  });

  await test('keeps DRAFT transitions invisible to landlord actors', async () => {
    const result = await db.query(`
      select * from public.transition_application_status_transaction(
        '05000000-0000-0000-0000-000000000003',
        '00000000-0000-0000-0000-000000000004',
        'LANDLORD',
        'DRAFT',
        'UNDER_REVIEW'
      )
    `);
    assert.equal(result.rows[0].outcome, 'NOT_FOUND');
  });

  await db.exec(`
    insert into public.listings (
      id, property_id, title, description, monthly_rent, available_from, status
    ) values (
      '04000000-0000-0000-0000-000000000002',
      '03000000-0000-0000-0000-000000000001',
      'Viewing fixture', 'Historical viewing fixture.', 24000, current_date, 'CLOSED'
    );
    insert into public.applications (
      id, listing_id, tenant_id, status, submitted_at
    ) values (
      '05000000-0000-0000-0000-000000000004',
      '04000000-0000-0000-0000-000000000002',
      '01000000-0000-0000-0000-000000000001', 'SHORTLISTED', now()
    );
  `);

  await test('proposes and completes a viewing with atomic application history', async () => {
    const proposed = await db.query(`
      select * from public.propose_viewing_transaction(
        '05000000-0000-0000-0000-000000000004',
        '00000000-0000-0000-0000-000000000004',
        'SHORTLISTED', now() + interval '2 days', null, 'Fixture'
      )
    `);
    const duplicate = await db.query(`
      select * from public.propose_viewing_transaction(
        '05000000-0000-0000-0000-000000000004',
        '00000000-0000-0000-0000-000000000004',
        'VIEWING_INVITED', now() + interval '3 days', null, null
      )
    `);
    assert.equal(proposed.rows[0].outcome, 'CREATED');
    assert.equal(duplicate.rows[0].outcome, 'OPEN_VIEWING_EXISTS');
    const id = proposed.rows[0].viewing_id;
    await db.query(`select * from public.transition_viewing_transaction(
      '${id}', '00000000-0000-0000-0000-000000000001',
      'TENANT', 'PROPOSED', 'CONFIRM'
    )`);
    await db.exec(
      `update public.viewings set start_time = now() - interval '1 hour' where id = '${id}'`,
    );
    const completed =
      await db.query(`select * from public.transition_viewing_transaction(
      '${id}', '00000000-0000-0000-0000-000000000004',
      'LANDLORD', 'CONFIRMED', 'COMPLETE'
    )`);
    const repeated =
      await db.query(`select * from public.transition_viewing_transaction(
      '${id}', '00000000-0000-0000-0000-000000000004',
      'LANDLORD', 'COMPLETED', 'COMPLETE'
    )`);
    assert.equal(completed.rows[0].outcome, 'TRANSITIONED');
    assert.equal(repeated.rows[0].outcome, 'ALREADY_TARGET');
    const state = await db.query(`
      select applications.status,
        count(history.id) filter (where history.to_status = 'VIEWING_INVITED')::integer as invited,
        count(history.id) filter (where history.to_status = 'VIEWING_COMPLETED')::integer as completed
      from public.applications
      left join public.application_status_history history
        on history.application_id = applications.id
      where applications.id = '05000000-0000-0000-0000-000000000004'
      group by applications.id
    `);
    assert.deepEqual(state.rows[0], {
      status: 'VIEWING_COMPLETED',
      invited: 1,
      completed: 1,
    });
  });

  await test('partial unique index rejects a second open viewing', async () => {
    await db.exec(
      `update public.applications set status = 'VIEWING_INVITED' where id = '05000000-0000-0000-0000-000000000004'`,
    );
    await db.exec(`insert into public.viewings (
      application_id, proposed_by_user_id, start_time, status
    ) values (
      '05000000-0000-0000-0000-000000000004',
      '00000000-0000-0000-0000-000000000004', now() + interval '2 days', 'PROPOSED'
    )`);
    await assert.rejects(
      db.exec(`insert into public.viewings (
      application_id, proposed_by_user_id, start_time, status
    ) values (
      '05000000-0000-0000-0000-000000000004',
      '00000000-0000-0000-0000-000000000004', now() + interval '3 days', 'CONFIRMED'
    )`),
      /viewings_one_open_per_application_idx/i,
    );
  });

  await test('leaves an incomplete application draft with no history', async () => {
    const result = await db.query(`
      select * from public.submit_application_transaction(
        '05000000-0000-0000-0000-000000000003',
        '01000000-0000-0000-0000-000000000003',
        '00000000-0000-0000-0000-000000000003'
      )
    `);
    assert.equal(result.rows[0].outcome, 'INCOMPLETE');
    assert.deepEqual(result.rows[0].missing_question_ids, [
      '06000000-0000-0000-0000-000000000001',
    ]);
    const state = await db.query(`
      select
        applications.status,
        applications.submitted_at,
        count(application_status_history.id)::integer as history_count
      from public.applications
      left join public.application_status_history
        on application_status_history.application_id = applications.id
      where applications.id = '05000000-0000-0000-0000-000000000003'
      group by applications.id
    `);
    assert.deepEqual(state.rows[0], {
      status: 'DRAFT',
      submitted_at: null,
      history_count: 0,
    });
  });

  await test('blocks answer mutation after submission', async () => {
    await assert.rejects(
      db.exec(`
        update public.application_answers
        set answer_text = 'Too late'
        where application_id = '05000000-0000-0000-0000-000000000002'
      `),
      /APPLICATION_NOT_EDITABLE/i,
    );
  });

  await test('question mutation rechecks the submitted lock transactionally', async () => {
    const result = await db.query(`
      select * from public.mutate_application_question_transaction(
        'UPDATE',
        '04000000-0000-0000-0000-000000000001',
        '06000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000004',
        '{"question_text":"Must not change"}'::jsonb
      )
    `);
    assert.equal(result.rows[0].outcome, 'LOCKED');
    const question = await db.query(`
      select question_text
      from public.application_questions
      where id = '06000000-0000-0000-0000-000000000001'
    `);
    assert.equal(question.rows[0].question_text, 'Why is this home suitable?');
  });

  await db.exec(`
    insert into auth.users (id, email) values
      ('a0000000-0000-0000-0000-000000000001', 'tenant.a@example.test'),
      ('a0000000-0000-0000-0000-000000000002', 'tenant.b@example.test'),
      ('a0000000-0000-0000-0000-000000000003', 'landlord.a@example.test'),
      ('a0000000-0000-0000-0000-000000000004', 'landlord.b@example.test'),
      ('a0000000-0000-0000-0000-000000000005', 'admin.a@example.test');
  `);

  const seedSql = await readFile(seedPath, 'utf8');
  await db.exec(seedSql);
  await db.exec(seedSql);

  await test('development seed is relationally valid and repeatable', async () => {
    const result = await db.query(`
      select
        (select count(*)::integer from public.profiles p
          join auth.users u on u.id = p.id
          where u.email like '%.a@example.test'
             or u.email = 'tenant.b@example.test'
             or u.email = 'landlord.b@example.test') as personas,
        (select count(*)::integer from public.properties
          where id::text like '30000000-%') as properties,
        (select count(*)::integer from public.listings
          where id::text like '40000000-%') as listings,
        (select count(*)::integer from public.applications
          where id::text like '50000000-%') as applications,
        (select count(*)::integer from public.viewings
          where id::text like '70000000-%') as viewings,
        (select count(*)::integer from public.conversations
          where id::text like '80000000-%') as conversations,
        (select count(*)::integer from public.messages
          where id::text like '81000000-%') as messages,
        (select count(*)::integer from public.notifications
          where id::text like '90000000-%') as notifications
    `);

    assert.deepEqual(result.rows[0], {
      personas: 5,
      properties: 2,
      listings: 2,
      applications: 3,
      viewings: 1,
      conversations: 1,
      messages: 2,
      notifications: 2,
    });
  });

  console.log(
    `Embedded PostgreSQL verification passed: ${migrationNames.length} migrations and ${passedTests.length} runtime checks.`,
  );
  for (const name of passedTests) {
    console.log(`  PASS ${name}`);
  }
} finally {
  await db.close();
}
