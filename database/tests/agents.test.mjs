import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const db = new PGlite();
let checks = 0;
const test = async (name, fn) => {
  await fn();
  checks++;
  console.log(`PASS ${name}`);
};
const id = (n) => `32000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
try {
  await db.exec(
    'create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email text unique);',
  );
  const migrations = (await readdir('database/migrations'))
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const f of migrations.filter((f) => f < '202609230001'))
    await db.exec(await readFile(`database/migrations/${f}`, 'utf8'));
  await db.query("insert into auth.users values($1,'legacy@example.test');", [
    id(1),
  ]);
  await db.query(
    "insert into profiles(id,role,first_name,last_name) values($1,'LANDLORD','Legacy','Owner')",
    [id(1)],
  );
  await db.query('insert into landlord_profiles(id,user_id) values($1,$2)', [
    id(11),
    id(1),
  ]);
  await db.query(
    "insert into properties(id,landlord_id,property_type,district,locality,bedrooms,bathrooms) values($1,$2,'HOUSE','Moka','Moka',2,1)",
    [id(21), id(11)],
  );
  for (const f of migrations.filter((f) => f >= '202609230001'))
    await db.exec(await readFile(`database/migrations/${f}`, 'utf8'));
  await test('migration preserves legacy owner and backfills identical manager ID', async () => {
    const { rows } = await db.query(
      'select landlord_id,property_manager_id,managed_owner_id from properties where id=$1',
      [id(21)],
    );
    assert.deepEqual(rows[0], {
      landlord_id: id(11),
      property_manager_id: id(11),
      managed_owner_id: null,
    });
  });
  for (const [n, role] of [
    [2, 'AGENT'],
    [3, 'AGENT'],
    [4, 'TENANT'],
    [5, 'ADMIN'],
  ]) {
    await db.query('insert into auth.users values($1,$2)', [
      id(n),
      `agent${n}@example.test`,
    ]);
    await db.query(
      "insert into profiles(id,role,first_name,last_name) values($1,$2,'Test','Actor')",
      [id(n), role],
    );
    await db.query(
      'insert into property_manager_profiles(id,user_id) values($1,$2)',
      [id(n + 10), id(n)],
    );
  }
  for (const n of [2, 3])
    await db.query(
      "insert into managed_property_owners(id,property_manager_id,name,email,notes) values($1,$2,'Recorded owner','private@example.test','Private client notes')",
      [id(n + 30), id(n + 10)],
    );
  const property = (n, manager, owner) =>
    db.query(
      "insert into properties(id,property_manager_id,managed_owner_id,property_type,district,locality,bedrooms,bathrooms) values($1,$2,$3,'HOUSE','Moka','Moka',2,1)",
      [id(n), id(manager), owner ? id(owner) : null],
    );
  await test('agents require recorded owners and cannot attach another manager client', async () => {
    await assert.rejects(property(22, 12, null), /MANAGED_OWNER_REQUIRED/);
    await assert.rejects(property(22, 12, 33), /OWNER_NOT_FOUND/);
    await property(22, 12, 32);
    await property(23, 13, 33);
  });
  await test('client records do not create auth users or landlord profiles', async () => {
    assert.equal(
      (await db.query('select count(*)::int n from auth.users')).rows[0].n,
      5,
    );
    assert.equal(
      (await db.query('select count(*)::int n from landlord_profiles')).rows[0]
        .n,
      1,
    );
  });
  await test('tenant/admin/landlord cannot acquire agent owner records', async () => {
    for (const manager of [11, 14, 15])
      await assert.rejects(
        db.query(
          "insert into managed_property_owners(property_manager_id,name) values($1,'Invalid')",
          [id(manager)],
        ),
        /OWNER_NOT_FOUND/,
      );
  });
  await test('property and recorded owner transfers are immutable', async () => {
    await assert.rejects(
      db.query('update properties set managed_owner_id=$1 where id=$2', [
        id(33),
        id(22),
      ]),
      /IMMUTABLE/,
    );
    await assert.rejects(
      db.query('update properties set property_manager_id=$1 where id=$2', [
        id(13),
        id(22),
      ]),
      /IMMUTABLE/,
    );
    await assert.rejects(
      db.query(
        'update managed_property_owners set property_manager_id=$1 where id=$2',
        [id(13), id(32)],
      ),
      /IMMUTABLE/,
    );
  });
  const summary = async (user, owner = null) =>
    (
      await db.query(
        'select owner_operations_summary($1,null,current_date,current_date,1,20,null,null,$2) d',
        [id(user), owner ? id(owner) : null],
      )
    ).rows[0].d;
  await test('shared summary is isolated across agent A/B and legacy landlord', async () => {
    for (const [user, p] of [
      [1, 21],
      [2, 22],
      [3, 23],
    ])
      assert.deepEqual(
        (await summary(user)).portfolio.map((x) => x.id),
        [id(p)],
      );
    assert.equal((await summary(2, 33)).total_properties, 0);
    for (const u of [4, 5]) await assert.rejects(summary(u), /NOT_FOUND/);
  });
  await test('owner directory only aggregates its manager and has private owner context', async () => {
    for (const n of [2, 3]) {
      const d = (
        await db.query('select managed_owner_directory($1) d', [id(n + 10)])
      ).rows[0].d;
      assert.equal(d.total, 1);
      assert.equal(d.items[0].id, id(n + 30));
      assert.equal(d.items[0].property_count, 1);
      assert.equal(d.items[0].vacant, 1);
    }
  });
  await test('agent operations are useful for already occupied properties without listings', async () => {
    await db.query(
      "insert into tenancies(id,property_id,tenant_name,tenant_user_id,start_date,status,monthly_rent) values($1,$2,'Existing tenant',$3,current_date-10,'ACTIVE',18000)",
      [id(42), id(22), id(4)],
    );
    for (const sql of [
      "insert into property_tasks(property_id,title,due_date) values($1,'Check inventory',current_date)",
      "insert into property_financial_records(property_id,kind,category,amount,record_date,description) values($1,'EXPENSE','OTHER',500,current_date,'Repair materials')",
    ])
      await db.query(sql, [id(22)]);
    const s = await summary(2);
    assert.equal(s.portfolio[0].occupancy, 'OCCUPIED');
    assert.equal(s.finances.expenses, 500);
    assert.equal(
      (await db.query('select count(*)::int n from listings')).rows[0].n,
      0,
    );
  });
  await test('agent authority verification does not confer landlord identity', async () => {
    assert.equal(
      (
        await db.query(
          "select * from create_verification_transaction($1,'LANDLORD_IDENTITY',null)",
          [id(2)],
        )
      ).rows[0].outcome,
      'INVALID',
    );
    assert.equal(
      (
        await db.query(
          "select * from create_verification_transaction($1,'PROPERTY_AUTHORITY',$2)",
          [id(2), id(23)],
        )
      ).rows[0].outcome,
      'NOT_FOUND',
    );
  });
  await test('archival retains managed property history and blocks new attachments', async () => {
    await db.query(
      'update managed_property_owners set archived_at=now() where id=$1',
      [id(32)],
    );
    assert.equal((await summary(2)).portfolio[0].managed_owner_id, id(32));
    await assert.rejects(property(24, 12, 32), /OWNER_NOT_FOUND/);
    await assert.rejects(
      db.query(
        "update managed_property_owners set name='Rewrite' where id=$1",
        [id(32)],
      ),
      /OWNER_ARCHIVED/,
    );
    assert.equal(
      (
        await db.query(
          'select version from managed_property_owners where id=$1',
          [id(32)],
        )
      ).rows[0].version,
      2,
    );
  });
  await test('owner and manager tables deny browser reads and writes', async () => {
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`);
      for (const table of [
        'managed_property_owners',
        'property_manager_profiles',
      ]) {
        await assert.rejects(
          db.exec(`select * from ${table}`),
          /permission denied/,
        );
        await assert.rejects(
          db.exec(`delete from ${table}`),
          /permission denied/,
        );
      }
      await assert.rejects(
        db.query('select managed_owner_directory($1)', [id(12)]),
        /permission denied/,
      );
      await db.exec('reset role');
    }
  });

  await test('agent leasing uses shared applications, viewings, messages and acceptance', async () => {
    await db.query('insert into tenant_profiles(id,user_id) values($1,$2)', [
      id(44),
      id(4),
    ]);
    await db.query(
      "insert into listings(id,property_id,title,description,monthly_rent,available_from,status) values($1,$2,'Agent rental','Managed property',18000,current_date,'ACTIVE')",
      [id(50), id(23)],
    );
    await db.query(
      "insert into applications(id,listing_id,tenant_id,status,submitted_at) values($1,$2,$3,'SUBMITTED',now())",
      [id(51), id(50), id(44)],
    );
    await db.query(
      "insert into application_status_history(application_id,from_status,to_status,changed_by_user_id) values($1,'DRAFT','SUBMITTED',$2)",
      [id(51), id(4)],
    );
    const transition = async (user, role, from, to) =>
      (
        await db.query(
          'select * from transition_application_status_transaction($1,$2,$3,$4,$5)',
          [id(51), id(user), role, from, to],
        )
      ).rows[0];
    assert.equal(
      (await transition(2, 'AGENT', 'SUBMITTED', 'UNDER_REVIEW')).outcome,
      'NOT_FOUND',
    );
    assert.equal(
      (await transition(3, 'LANDLORD', 'SUBMITTED', 'UNDER_REVIEW')).outcome,
      'NOT_FOUND',
    );
    assert.equal(
      (await transition(3, 'AGENT', 'SUBMITTED', 'UNDER_REVIEW')).outcome,
      'TRANSITIONED',
    );
    assert.equal(
      (await transition(3, 'AGENT', 'UNDER_REVIEW', 'SHORTLISTED')).outcome,
      'TRANSITIONED',
    );
    const v = (
      await db.query(
        "select * from propose_viewing_transaction($1,$2,'SHORTLISTED',now()+interval '1 day',null,null)",
        [id(51), id(3)],
      )
    ).rows[0];
    assert.equal(v.outcome, 'CREATED');
    const action = async (user, role, status, act) =>
      (
        await db.query(
          'select * from transition_viewing_transaction($1,$2,$3,$4,$5)',
          [v.viewing_id, id(user), role, status, act],
        )
      ).rows[0];
    assert.equal(
      (await action(4, 'TENANT', 'PROPOSED', 'CONFIRM')).outcome,
      'TRANSITIONED',
    );
    await db.query(
      "update viewings set start_time=now()-interval '1 hour' where id=$1",
      [v.viewing_id],
    );
    assert.equal(
      (await action(2, 'AGENT', 'CONFIRMED', 'COMPLETE')).outcome,
      'NOT_FOUND',
    );
    assert.equal(
      (await action(3, 'AGENT', 'CONFIRMED', 'COMPLETE')).outcome,
      'TRANSITIONED',
    );
    const c = (
      await db.query('select * from create_conversation_transaction($1,$2)', [
        id(50),
        id(4),
      ])
    ).rows[0];
    const record = (
      await db.query(
        'select landlord_user_id,tenant_user_id from conversations where id=$1',
        [c.conversation_id],
      )
    ).rows[0];
    assert.equal(record.landlord_user_id, id(3));
    await db.query(
      "insert into messages(conversation_id,sender_user_id,content) values($1,$2,'Viewing confirmed')",
      [c.conversation_id, id(3)],
    );
    assert.equal(
      (
        await db.query('select * from accept_application_transaction($1,$2)', [
          id(2),
          id(51),
        ])
      ).rows[0].outcome,
      'NOT_FOUND',
    );
    assert.equal(
      (
        await db.query('select * from accept_application_transaction($1,$2)', [
          id(3),
          id(51),
        ])
      ).rows[0].current_status,
      'ACCEPTED',
    );
    assert.ok(
      (
        await db.query(
          'select count(*)::int n from notifications where user_id=$1',
          [id(3)],
        )
      ).rows[0].n > 0,
    );
  });
  console.log(`Agent database verification: ${checks} checks passed.`);
} finally {
  await db.close();
}
