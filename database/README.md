# Database foundation

The ordered SQL migrations in `migrations/` are the source of truth for the
Mauritius Rental Platform schema. They target PostgreSQL 13+ and Supabase
PostgreSQL. `gen_random_uuid()` is built into supported PostgreSQL versions, so
TASK-001 does not install an extra UUID extension.

## Migration order

Apply every `*.sql` file in lexical order:

1. `202608190001_create_profile_tables.sql`
2. `202608190002_create_property_listing_tables.sql`
3. `202608190003_create_application_viewing_tables.sql`
4. `202608190004_create_communication_moderation_tables.sql`
5. `202608190005_add_indexes_triggers_and_rls.sql`

The first migration expects Supabase's `auth.users` table to exist. It links
`profiles.id` to `auth.users.id` with `ON DELETE RESTRICT`, preserving rental
history if an auth identity is deleted accidentally. Core historical foreign
keys also restrict deletion. Two narrowly structural relationships cascade:
question options are removed with their question, and conversation participant
rows are removed with their conversation. Messages still prevent deletion of a
conversation that has history.

Once a migration has been applied to a shared environment, do not edit it. Put
every later schema change in a new, ordered migration.

## Applying migrations

The repository uses the project-local Supabase CLI while retaining
`database/migrations/` as the source of truth. Synchronize the CLI staging
directory, inspect the pending plan, apply it, and run the hosted catalog
verification from the repository root:

```bash
npm run supabase:migrations:sync
npx supabase db push --db-url "$DATABASE_URL" --include-all --dry-run
npx supabase db push --db-url "$DATABASE_URL" --include-all
npm run db:verify:hosted
```

On an IPv4-only development machine, `DATABASE_URL` must be the Supabase
Session pooler connection string (port 5432) from the dashboard Connect panel.
The direct database endpoint is IPv6 unless the project has the IPv4 add-on.
Do not put connection values on the command line, in source files, or in logs.

`supabase/migrations/` is generated and ignored. The synchronization command
copies the ordered SQL byte-for-byte and fails if unexpected migration files
would be overwritten. Do not edit the generated copies.

Apply migrations to a clean local/test database before a shared environment.
Never run a destructive reset against production. Database URLs and credentials
must come from the environment; they do not belong in SQL or source control.

## Development seed

`seeds/development_seed.sql` is **DEVELOPMENT / TEST ONLY** and is never run by
an application script. It does not fabricate rows in `auth.users`. First create
these identities with the Supabase Auth API, local dashboard, or another
officially supported Auth flow:

- `tenant.a@example.test`
- `tenant.b@example.test`
- `landlord.a@example.test`
- `landlord.b@example.test`
- `admin.a@example.test`

Then apply the seed with `psql -v ON_ERROR_STOP=1 -f
database/seeds/development_seed.sql`. It fails before writing application data
if any identity is missing. The seed is repeatable and adds the five personas,
sample properties, listings, applications, a viewing, a conversation, messages,
and notifications. Authentication credentials remain owned by Supabase Auth.

## Verification

Run from the repository root:

```bash
npm run db:verify
```

The command first performs deterministic static inspection of table coverage,
constraints, required indexes, RLS, timestamp triggers, and seed safety. It then
applies all migrations to a temporary in-memory PGlite PostgreSQL engine and
executes the critical constraint tests plus the development seed twice. PGlite
provides real PostgreSQL execution without a machine-level database install, but
it is not a substitute for final Supabase CLI verification in an environment
where the Supabase services and container runtime are available.

## RLS posture

Row Level Security is enabled on all public application tables. TASK-001 creates
no policies, intentionally leaving publishable-key browser access deny-by-default.
The database owner and backend Supabase secret-key client retain their expected
privileged behavior. Identity-aware policies belong to TASK-002 and later work.

## Schema representation

The `schema/` directory documents snapshot policy only. A duplicate hand-edited
schema is not maintained because it would drift from the ordered migrations.
