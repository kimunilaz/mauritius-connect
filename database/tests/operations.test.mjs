const agentMode = process.argv.includes('--agent');
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const db = new PGlite();
let count = 0;
const test = async (name, fn) => {
  await fn();
  count++;
  console.log(`PASS ${name}`);
};
try {
  await db.exec(
    `create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email text unique);`,
  );
  for (const f of (await readdir('database/migrations'))
    .filter((f) => f.endsWith('.sql'))
    .sort())
    await db.exec(await readFile(`database/migrations/${f}`, 'utf8'));
  const uid = (n) => `31000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  for (const [n, role] of [
    [1, agentMode ? 'AGENT' : 'LANDLORD'],
    [2, agentMode ? 'AGENT' : 'LANDLORD'],
    [3, 'TENANT'],
    [4, 'TENANT'],
  ]) {
    await db.query(`insert into auth.users(id,email) values($1,$2)`, [
      uid(n),
      `ops${n}@example.test`,
    ]);
    await db.query(
      `insert into profiles(id,role,first_name,last_name) values($1,$2,'Test','Operations')`,
      [uid(n), role],
    );
  }
  for (const n of [1, 2]) {
    await db.query(
      `insert into ${agentMode ? 'property_manager_profiles' : 'landlord_profiles'}(id,user_id) values($1,$2)`,
      [uid(n + 10), uid(n)],
    );
    if (agentMode)
      await db.query(
        `insert into managed_property_owners(id,property_manager_id,name) values($1,$2,'Recorded owner')`,
        [uid(n + 100), uid(n + 10)],
      );
    await db.query(
      `insert into properties(id,${agentMode ? 'property_manager_id,managed_owner_id' : 'landlord_id'},property_type,district,locality,bedrooms,bathrooms) values($1,$2,${agentMode ? '$3,' : ''}'HOUSE','Moka','Moka',2,1)`,
      [uid(n + 20), uid(n + 10), ...(agentMode ? [uid(n + 100)] : [])],
    );
  }
  const p = uid(21),
    other = uid(22),
    t = uid(31);
  await test('existing occupied property needs no listing or application', async () => {
    await db.query(
      `insert into tenancies(id,property_id,tenant_name,tenant_user_id,start_date,monthly_rent,status) values($1,$2,'Existing tenant',$3,current_date-30,15000,'ACTIVE')`,
      [t, p, uid(3)],
    );
    assert.equal(
      (await db.query('select count(*)::int n from listings')).rows[0].n,
      0,
    );
  });
  await test('competing current tenancies cannot both commit', async () => {
    const results = await Promise.allSettled(
      [1, 2].map(() =>
        db.query(
          `insert into tenancies(property_id,tenant_name,start_date,monthly_rent,status) values($1,'Conflict',current_date,1,'ACTIVE')`,
          [p],
        ),
      ),
    );
    assert.equal(results.filter((r) => r.status === 'rejected').length, 2);
  });
  await test('tenant-linked resources cannot cross properties', async () => {
    await assert.rejects(
      db.query(
        `insert into property_tasks(property_id,tenancy_id,title,due_date) values($1,$2,'Bad',current_date)`,
        [other, t],
      ),
      /foreign key/i,
    );
  });
  await test('occupied properties cannot be archived', async () => {
    await assert.rejects(
      db.query('update properties set archived_at=now() where id=$1', [p]),
      /PROPERTY_HAS_TENANCY/,
    );
  });
  await db.query(
    `insert into rent_ledger_entries(id,property_id,tenancy_id,period,due_date,amount_due) values($1,$2,$3,date_trunc('month',current_date)::date,current_date-1,15000)`,
    [uid(41), p, t],
  );
  await test('offline receipt retries are idempotent', async () => {
    for (let i = 0; i < 2; i++)
      await db.query(
        `select record_rent_receipt($1,$2,5000,current_date,'cash',$3)`,
        [uid(1), uid(41), uid(51)],
      );
    assert.equal(
      (await db.query('select count(*)::int n from rent_receipts')).rows[0].n,
      1,
    );
  });
  await test('receipt actor must own the property', async () => {
    await assert.rejects(
      db.query(`select record_rent_receipt($1,$2,100,current_date,null,$3)`, [
        uid(2),
        uid(41),
        uid(52),
      ]),
      /NOT_FOUND/,
    );
  });
  await test('concurrent receipts cannot over-record rent', async () => {
    const r = await Promise.allSettled(
      [53, 54].map((n) =>
        db.query(
          `select record_rent_receipt($1,$2,10000,current_date,null,$3)`,
          [uid(1), uid(41), uid(n)],
        ),
      ),
    );
    assert.equal(r.filter((x) => x.status === 'fulfilled').length, 1);
  });
  await test('paid charges cannot be rewritten or waived', async () => {
    await assert.rejects(
      db.query('update rent_ledger_entries set amount_due=1 where id=$1', [
        uid(41),
      ]),
      /RENT_ALREADY_RECORDED/,
    );
  });
  await test('maintenance rechecks the active tenant at commit', async () => {
    await assert.rejects(
      db.query(
        `insert into maintenance_requests(property_id,tenancy_id,submitted_by,title,description) values($1,$2,$3,'Leak','Tap leak')`,
        [p, t, uid(4)],
      ),
      /NOT_FOUND/,
    );
    await db.query(
      `insert into maintenance_requests(id,property_id,tenancy_id,submitted_by,title,description) values($1,$2,$3,$4,'Leak','Tap leak')`,
      [uid(61), p, t, uid(3)],
    );
  });
  await test('maintenance history and notifications share the commit', async () => {
    await db.query(
      `update maintenance_requests set status='COMPLETED',owner_update='Repaired' where id=$1`,
      [uid(61)],
    );
    assert.equal(
      (await db.query('select count(*)::int n from maintenance_updates'))
        .rows[0].n,
      2,
    );
    assert.equal(
      (
        await db.query(
          "select count(*)::int n from notifications where type like 'MAINTENANCE_%'",
        )
      ).rows[0].n,
      2,
    );
    await assert.rejects(
      db.query("update maintenance_requests set status='NEW' where id=$1", [
        uid(61),
      ]),
      /TERMINAL_MAINTENANCE/,
    );
  });
  await test('maintenance expense is linked once, not duplicated', async () => {
    const q = `insert into property_financial_records(property_id,kind,category,amount,record_date,maintenance_id) values($1,'EXPENSE','MAINTENANCE',600,current_date,$2)`;
    await db.query(q, [p, uid(61)]);
    await assert.rejects(db.query(q, [p, uid(61)]), /unique/i);
  });
  await test('inspections tasks and private notes exist without leasing', async () => {
    await db.query(
      `insert into property_inspections(property_id,tenancy_id,inspection_date,type,notes,checklist) values($1,$2,current_date,'ROUTINE','Private condition','[{"label":"Walls","condition":"GOOD"}]')`,
      [p, t],
    );
    await db.query(
      `insert into property_tasks(property_id,title,due_date) values($1,'Renew insurance',current_date+1)`,
      [p],
    );
    await db.query(
      `insert into property_operational_details(property_id,owner_notes) values($1,'Private access instructions')`,
      [p],
    );
  });
  await test('private document cannot share across properties', async () => {
    await assert.rejects(
      db.query(
        `insert into property_documents(property_id,shared_tenancy_id,category,filename,storage_path,mime_type,size_bytes,uploaded_by) values($1,$2,'LEASE','lease.pdf','private/test.pdf','application/pdf',100,$3)`,
        [other, t, uid(2)],
      ),
      /foreign key/i,
    );
  });
  await test('tenancy messaging reuses conversations and participants', async () => {
    const r = await db.query('select tenancy_conversation($1,$2) id', [
      uid(1),
      t,
    ]);
    const id = r.rows[0].id;
    assert.equal(
      (
        await db.query(
          'select count(*)::int n from conversation_participants where conversation_id=$1',
          [id],
        )
      ).rows[0].n,
      2,
    );
    assert.equal(
      (await db.query('select tenancy_conversation($1,$2) id', [uid(3), t]))
        .rows[0].id,
      id,
    );
    await assert.rejects(
      db.query('select tenancy_conversation($1,$2)', [uid(4), t]),
      /NOT_FOUND/,
    );
  });
  await test('summary is ownership-scoped and rent is counted once', async () => {
    const r = (
      await db.query(
        `select owner_operations_summary($1,null,current_date-30,current_date,1,20) s`,
        [uid(1)],
      )
    ).rows[0].s;
    assert.equal(r.totals.occupied, 1);
    assert.equal(r.finances.received, 15000);
    assert.equal(r.finances.income, 15000);
    assert.equal(r.finances.expenses, 600);
    assert.ok(r.attention.some((i) => i.title === 'Renew insurance'));
    const otherSummary = (
      await db.query(
        `select owner_operations_summary($1,null,current_date-30,current_date,1,20) s`,
        [uid(2)],
      )
    ).rows[0].s;
    assert.equal(otherSummary.finances.received, 0);
    await assert.rejects(
      db.query('select owner_operations_summary($1)', [uid(3)]),
      /NOT_FOUND/,
    );
  });
  await test('rent query filters status before pagination and scopes both roles', async () => {
    const query = `select operations_rent_records($1,null,null,null,'PAID',null,null,1,1) s`;
    const r = (await db.query(query, [uid(1)])).rows[0].s;
    assert.equal(r.total, 1);
    assert.equal(r.items[0].amount_paid, 15000);
    assert.equal(r.items[0].outstanding, 0);
    assert.equal((await db.query(query, [uid(2)])).rows[0].s.total, 0);
    assert.equal((await db.query(query, [uid(3)])).rows[0].s.total, 1);
    assert.equal((await db.query(query, [uid(4)])).rows[0].s.total, 0);
  });
  await test('portfolio filters are applied before count and pagination', async () => {
    const s = (
      await db.query(
        `select owner_operations_summary($1,null,current_date-30,current_date,1,1,'VACANT','Moka') s`,
        [uid(1)],
      )
    ).rows[0].s;
    assert.equal(s.total_properties, 0);
    assert.equal(s.portfolio.length, 0);
  });
  await test('ended tenancies preserve history and revoke maintenance access', async () => {
    await db.query(
      `update tenancies set status='ENDED',end_date=current_date where id=$1`,
      [t],
    );
    await assert.rejects(
      db.query(
        `insert into maintenance_requests(property_id,tenancy_id,submitted_by,title,description) values($1,$2,$3,'Leak','Again')`,
        [p, t, uid(3)],
      ),
      /NOT_FOUND/,
    );
    assert.equal(
      (await db.query('select count(*)::int n from rent_receipts')).rows[0].n,
      2,
    );
  });
  await test('ended tenancy cannot send messages or read rent through the tenancy RPC', async () => {
    const c = (
      await db.query('select id from conversations where tenancy_id=$1', [t])
    ).rows[0].id;
    await assert.rejects(
      db.query(`select send_message_transaction($1,$2,'late message')`, [
        c,
        uid(3),
      ]),
      /NOT_FOUND/,
    );
    await assert.rejects(
      db.query(`select send_message_transaction($1,$2,'late owner message')`, [
        c,
        uid(1),
      ]),
      /NOT_FOUND/,
    );
    assert.equal(
      (await db.query('select operations_rent_records($1) s', [uid(3)])).rows[0]
        .s.total,
      0,
    );
    assert.equal(
      (await db.query('select operations_rent_records($1) s', [uid(1)])).rows[0]
        .s.total,
      1,
    );
  });
  await test('invitation can be claimed once by an active tenant only', async () => {
    await db.query(
      `insert into tenancies(id,property_id,tenant_name,start_date,monthly_rent,status,invitation_hash) values($1,$2,'Manual',current_date+1,12000,'UPCOMING','test-hash')`,
      [uid(32), p],
    );
    await assert.rejects(
      db.query("select claim_tenancy($1,'test-hash')", [uid(1)]),
      /NOT_FOUND/,
    );
    await db.query("select claim_tenancy($1,'test-hash')", [uid(3)]);
    await assert.rejects(
      db.query("select claim_tenancy($1,'test-hash')", [uid(4)]),
      /NOT_FOUND/,
    );
  });
  await test('accepted applicant conversion derives identity and still requires explicit terms', async () => {
    await db.query(
      `insert into properties(id,${agentMode ? 'property_manager_id,managed_owner_id' : 'landlord_id'},property_type,district,locality,bedrooms,bathrooms) values($1,$2,${agentMode ? '$3,' : ''}'HOUSE','Moka','Moka',2,1)`,
      [uid(23), uid(11), ...(agentMode ? [uid(101)] : [])],
    );
    await db.query(`insert into tenant_profiles(id,user_id) values($1,$2)`, [
      uid(13),
      uid(4),
    ]);
    await db.query(
      `insert into listings(id,property_id,title,description,monthly_rent,available_from,status) values($1,$2,'Accepted property','Test listing',15000,current_date,'RENTED')`,
      [uid(71), uid(23)],
    );
    await db.query(
      `insert into applications(id,listing_id,tenant_id,status,submitted_at) values($1,$2,$3,'ACCEPTED',now())`,
      [uid(72), uid(71), uid(13)],
    );
    await assert.rejects(
      db.query(
        `insert into tenancies(property_id,application_id,tenant_name,monthly_rent,status) values($1,$2,'Selected',15000,'ACTIVE')`,
        [uid(23), uid(72)],
      ),
      /null value/,
    );
    const q = `insert into tenancies(property_id,application_id,tenant_name,start_date,monthly_rent,status) values($1,$2,'Selected',current_date,15000,'ACTIVE') returning tenant_user_id,deposit_amount`;
    await db.query(
      `update profiles set account_status='SUSPENDED' where id=$1`,
      [uid(4)],
    );
    await assert.rejects(db.query(q, [uid(23), uid(72)]), /INVALID_TENANT/);
    await db.query(`update profiles set account_status='ACTIVE' where id=$1`, [
      uid(4),
    ]);
    const { rows } = await db.query(q, [uid(23), uid(72)]);
    assert.equal(rows[0].tenant_user_id, uid(4));
    assert.equal(rows[0].deposit_amount, null);
  });
  await test('new tables deny direct browser access and RPC execution', async () => {
    await db.exec('set role authenticated');
    await assert.rejects(
      db.exec('select * from tenancies'),
      /permission denied/,
    );
    await assert.rejects(
      db.query('select owner_operations_summary($1)', [uid(1)]),
      /permission denied/,
    );
    await db.exec('reset role');
  });
  console.log(`Property operations DB verification: ${count} checks passed.`);
} finally {
  await db.close();
}
