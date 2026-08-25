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
6. `202608220001_add_application_submission_transactions.sql`
7. `202608220002_add_application_state_transition_transaction.sql`
8. `202608220003_add_viewing_transactions.sql`
9. `202608220004_add_conversation_transaction.sql`
10. `202608240001_fix_conversation_transaction_ambiguity.sql`
11. `202608250001_add_message_transactions.sql`
12. `202608260001_add_notification_events.sql`
13. `202608260002_add_reports_moderation.sql`
14. `202608270001_add_verification_workflow.sql`
15. `202608280001_add_admin_tools.sql`
16. `202608290001_add_application_acceptance.sql`
17. `202608290002_restore_application_notifications.sql`
18. `202608300001_require_active_listing_for_acceptance.sql`
19. `202608300002_fix_admin_account_state_ambiguity.sql`

The first migration expects Supabase's `auth.users` table to exist. It links
`profiles.id` to `auth.users.id` with `ON DELETE RESTRICT`, preserving rental
history if an auth identity is deleted accidentally. Core historical foreign
keys also restrict deletion. Two narrowly structural relationships cascade:
question options are removed with their question, and conversation participant
rows are removed with their conversation. Messages still prevent deletion of a
conversation that has history.

Once a migration has been applied to a shared environment, do not edit it. Put
every later schema change in a new, ordered migration.

`202608220001_add_application_submission_transactions.sql` adds the TASK-012
integrity boundary: an idempotent application-submission transaction, an
atomic landlord question-mutation transaction sharing its per-listing lock, a
post-DRAFT answer-mutation trigger, and a unique partial submission-history
index. Its RPC entry points are executable only by the backend role; anonymous
and authenticated browser roles are explicitly revoked.

`202608220002_add_application_state_transition_transaction.sql` adds the
TASK-015 application state transaction. It row-locks the application, rechecks
the actor's profile role and ownership at commit time, rejects stale competing
targets, atomically writes one approved state change and its history row, and
keeps identical retries idempotent. The function is backend-only; browser roles
are explicitly revoked and RLS remains deny-by-default.

`202608220003_add_viewing_transactions.sql` adds the TASK-016 one-open-viewing
partial unique index and the backend-only proposal/transition functions. They
row-lock the workflow records, recheck ACTIVE actor ownership, make identical
actions idempotent, and atomically couple the two viewing-related application
state/history changes. Browser roles cannot execute either function.

The two TASK-025 forward-only regression migrations preserve those security
boundaries. `202608300001_require_active_listing_for_acceptance.sql` prevents
acceptance unless the locked listing is ACTIVE. `202608300002_fix_admin_account_state_ambiguity.sql`
qualifies the profile column used by the suspension transaction so suspension,
listing pausing, audit logging, and reactivation remain atomic. Neither migration
adds browser-role function grants or relaxes RLS.

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

## Private property image storage

Property images use the private `property-images` Supabase Storage bucket. The
local bucket declaration lives in `supabase/config.toml`; configure the hosted
development bucket idempotently from ignored backend environment settings with:

```bash
npm run storage:setup:hosted
```

The bucket accepts only JPEG, PNG, and WebP objects up to 10 MiB. It has no
publishable-key upload, update, read, or delete policies. The trusted Node API
performs authentication, active-account, LANDLORD-role, and property-ownership
checks before using its backend-only privileged client. Application code stores
generated object paths in `property_images`; it never persists signed URLs.

## Schema representation

The `schema/` directory documents snapshot policy only. A duplicate hand-edited
schema is not maintained because it would drift from the ordered migrations.
