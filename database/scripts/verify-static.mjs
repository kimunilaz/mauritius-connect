import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const databaseDirectory = fileURLToPath(new URL('..', import.meta.url));
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

const updatedAtTables = [
  'profiles',
  'tenant_profiles',
  'landlord_profiles',
  'properties',
  'listings',
  'application_questions',
  'applications',
  'application_answers',
  'viewings',
  'conversations',
];

function normalize(sql) {
  return sql.toLowerCase().replaceAll(/\s+/g, ' ').trim();
}

function requireSql(sql, fragment, description) {
  assert.ok(
    sql.includes(normalize(fragment)),
    `Missing database invariant: ${description}`,
  );
}

const migrationNames = (await readdir(migrationsDirectory))
  .filter((name) => name.endsWith('.sql'))
  .sort();

assert.ok(migrationNames.length > 1, 'Expected multiple logical migrations.');
assert.equal(
  new Set(migrationNames).size,
  migrationNames.length,
  'Migration filenames must be unique.',
);

for (const name of migrationNames) {
  assert.match(
    name,
    /^\d{12}_[a-z0-9_]+\.sql$/,
    `Migration filename is not deterministically ordered: ${name}`,
  );
}

const migrationSql = normalize(
  (
    await Promise.all(
      migrationNames.map((name) =>
        readFile(`${migrationsDirectory}${name}`, 'utf8'),
      ),
    )
  ).join('\n'),
);

const createdTables = [
  ...migrationSql.matchAll(/create table public\.([a-z_]+)\s*\(/g),
].map((match) => match[1]);

assert.deepEqual(
  [...createdTables].sort(),
  [...expectedTables].sort(),
  'The migration table set must exactly match the TASK-001 scope.',
);

for (const table of expectedTables) {
  requireSql(
    migrationSql,
    `alter table public.${table} enable row level security`,
    `RLS enabled on ${table}`,
  );
}

assert.doesNotMatch(
  migrationSql,
  /create\s+policy/,
  'TASK-001 must not create client RLS policies.',
);
assert.doesNotMatch(
  migrationSql,
  /using\s*\(\s*true\s*\)|with\s+check\s*\(\s*true\s*\)/,
  'Blanket permissive RLS expressions are forbidden.',
);

requireSql(
  migrationSql,
  'foreign key (id) references auth.users (id) on delete restrict',
  'profiles references auth.users without cascading history deletion',
);
requireSql(
  migrationSql,
  "check (role in ('TENANT', 'LANDLORD', 'ADMIN'))",
  'profile role allowlist',
);
requireSql(
  migrationSql,
  "check (account_status in ('ACTIVE', 'SUSPENDED', 'DELETED'))",
  'account status allowlist',
);
requireSql(
  migrationSql,
  "property_type in ( 'APARTMENT', 'HOUSE', 'STUDIO', 'ROOM', 'TOWNHOUSE', 'VILLA', 'OTHER' )",
  'property type allowlist',
);
requireSql(
  migrationSql,
  "check (verification_status in ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED'))",
  'profile and property verification status allowlist',
);
requireSql(
  migrationSql,
  "check (question_type in ('TEXT', 'NUMBER', 'BOOLEAN', 'DATE', 'SELECT'))",
  'application question type allowlist',
);
requireSql(
  migrationSql,
  "status in ( 'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'SHORTLISTED', 'VIEWING_INVITED', 'VIEWING_COMPLETED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN' )",
  'application status allowlist',
);
requireSql(
  migrationSql,
  "check (status in ('PROPOSED', 'CONFIRMED', 'DECLINED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'))",
  'viewing status allowlist',
);
requireSql(
  migrationSql,
  "check (status in ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED'))",
  'report status allowlist',
);
requireSql(
  migrationSql,
  "reason in ( 'FAKE_LISTING', 'INCORRECT_INFORMATION', 'PROPERTY_UNAVAILABLE', 'DUPLICATE_LISTING', 'SUSPICIOUS_LANDLORD', 'SUSPICIOUS_TENANT', 'HARASSMENT', 'OTHER' )",
  'report reason allowlist',
);
requireSql(
  migrationSql,
  "check (subject_type in ('USER', 'PROPERTY'))",
  'verification subject allowlist',
);
requireSql(
  migrationSql,
  "verification_type in ( 'EMAIL', 'PHONE', 'LANDLORD_IDENTITY', 'PROPERTY_INFORMATION', 'PROPERTY_AUTHORITY' )",
  'verification type allowlist',
);
requireSql(
  migrationSql,
  "check (status in ('PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED'))",
  'verification record status allowlist',
);
requireSql(
  migrationSql,
  'monthly_rent numeric(12, 2)',
  'fixed-precision monthly rent',
);
requireSql(
  migrationSql,
  'deposit_amount numeric(12, 2)',
  'fixed-precision deposit amount',
);
requireSql(
  migrationSql,
  'where is_cover = true',
  'one cover image partial unique index',
);
requireSql(
  migrationSql,
  "where status in ('PENDING_REVIEW', 'ACTIVE', 'PAUSED')",
  'one live listing partial unique index',
);
requireSql(
  migrationSql,
  'unique (listing_id, tenant_id)',
  'one application per tenant and listing',
);
requireSql(
  migrationSql,
  "where status = 'ACCEPTED'",
  'one accepted application partial unique index',
);
requireSql(
  migrationSql,
  "check (status = 'DRAFT' or submitted_at is not null)",
  'submitted_at integrity',
);
requireSql(
  migrationSql,
  'check (end_time is null or end_time > start_time)',
  'viewing time ordering',
);
requireSql(
  migrationSql,
  'check (reported_user_id is not null or listing_id is not null)',
  'report target integrity',
);
requireSql(
  migrationSql,
  'check (latitude is null or latitude between -90 and 90)',
  'latitude range',
);
requireSql(
  migrationSql,
  'check (longitude is null or longitude between -180 and 180)',
  'longitude range',
);

for (const table of updatedAtTables) {
  requireSql(
    migrationSql,
    `create trigger ${table}_set_updated_at before update on public.${table}`,
    `automatic updated_at trigger on ${table}`,
  );
}

const requiredIndexes = [
  'profiles_role_idx',
  'properties_landlord_id_idx',
  'properties_district_locality_idx',
  'listings_status_idx',
  'listings_available_from_idx',
  'listings_monthly_rent_idx',
  'applications_listing_id_idx',
  'applications_tenant_id_idx',
  'applications_listing_id_status_idx',
  'messages_conversation_id_created_at_idx',
  'notifications_user_id_created_at_idx',
  'notifications_user_id_unread_idx',
  'property_images_property_id_idx',
  'saved_listings_listing_id_idx',
  'application_questions_listing_id_idx',
  'application_status_history_application_id_idx',
  'viewings_application_id_idx',
  'conversation_participants_user_id_idx',
  'reports_listing_id_idx',
];

for (const index of requiredIndexes) {
  assert.match(
    migrationSql,
    new RegExp(`create (?:unique )?index ${index}\\b`),
    `Required index is missing: ${index}`,
  );
}

assert.doesNotMatch(
  migrationSql,
  /\b(password|tenant_score|match_score|ranking|recommendation_score|priority_score|risk_score)\b/,
  'Migrations contain a forbidden credential or applicant-scoring field.',
);
assert.doesNotMatch(
  migrationSql,
  /supabase_secret_key|service_role|database_url/i,
  'Migrations must not contain privileged credentials or connection values.',
);
assert.doesNotMatch(
  migrationSql,
  /timestamp\s+without\s+time\s+zone/,
  'Event timestamps must be timezone-aware.',
);

const seedSql = normalize(await readFile(seedPath, 'utf8'));
assert.match(seedSql, /development \/ test only/);
assert.match(seedSql, /from auth\.users/);
assert.doesNotMatch(seedSql, /(?:^|;)\s*insert\s+into\s+auth\.users/);
assert.match(seedSql, /raise exception/);

console.log(
  `Static database verification passed: ${migrationNames.length} migrations, ${expectedTables.length} tables, RLS and critical invariants inspected.`,
);
console.log(`Database source: ${databaseDirectory}`);
