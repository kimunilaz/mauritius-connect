# TASK-001 — Database Foundation

## Status

READY

## Priority

P0 — Foundation

## Objective

Implement the approved PostgreSQL/Supabase database foundation for the Mauritius Rental Platform.

This task converts `docs/DATABASE.md` into reproducible SQL migrations containing the complete V1 relational schema, constraints, indexes, timestamp handling, and initial Row Level Security posture.

This task is database infrastructure only.

Do not implement authentication flows, API endpoints, frontend product functionality, or rental business services.

---

# 1. Required Reading

Before changing code, read:

docs/PRODUCT_SPEC.md
docs/ARCHITECTURE.md
docs/DATABASE.md
docs/API_SPEC.md
docs/SECURITY.md
docs/DEVELOPMENT_RULES.md
docs/TESTING.md
docs/ROADMAP.md
docs/UI_RULES.md
tasks/CURRENT_TASK.md

Also inspect the implementation produced by TASK-000 before making changes.

Do not silently contradict the governing documentation.

---

# 2. Scope

Create the approved database schema for:

profiles
tenant_profiles
tenant_preferred_locations
landlord_profiles

properties
property_images
listings
saved_listings

application_questions
application_question_options

applications
application_answers
application_status_history

viewings

conversations
conversation_participants
messages

notifications

reports
verification_records
admin_audit_logs

Also create:

- foreign keys
- CHECK constraints
- uniqueness rules
- required indexes
- partial unique indexes
- timestamps
- consistent updated_at handling
- initial RLS enablement
- development seed foundation
- database verification documentation/tests where practical

---

# 3. Explicit Non-Scope

Do NOT implement:

- signup
- login
- auth middleware
- role middleware
- API routes
- controllers
- services
- repositories
- React pages
- property forms
- listing forms
- applications UI
- messaging UI
- Supabase Storage buckets
- payment tables
- lease tables
- AI tables
- production deployment

Those belong to later tasks.

---

# 4. Migration Strategy

All schema changes must be implemented through SQL migrations under:

database/migrations/

Use ordered migration filenames.

Supabase-compatible timestamp naming is preferred.

Example:

202608190001_create_profile_tables.sql
202608190002_create_property_listing_tables.sql
202608190003_create_application_tables.sql

Exact timestamps/names may differ.

The important requirement is deterministic ordering.

Do not create one enormous unreadable migration if several logically grouped migrations improve maintainability.

---

# 5. Applied Migration Rule

Never rewrite a migration that has already been applied to a shared or production environment.

TASK-001 is creating the initial migration set, so the migrations may be organized cleanly now.

Later schema changes must use new migrations.

---

# 6. PostgreSQL Extensions

Confirm whether required UUID functionality is already available in Supabase PostgreSQL.

Use:

gen_random_uuid()

for application-generated UUID primary keys.

Do not add unnecessary PostgreSQL extensions.

If an extension is required, create it explicitly and safely.

---

# 7. profiles Table

Create:

profiles

Fields:

id UUID PRIMARY KEY
role TEXT NOT NULL
first_name TEXT NOT NULL
last_name TEXT NOT NULL
phone TEXT
profile_photo_url TEXT
phone_verified BOOLEAN NOT NULL DEFAULT FALSE
account_status TEXT NOT NULL DEFAULT 'ACTIVE'
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at TIMESTAMPTZ NOT NULL DEFAULT now()

Relationship:

profiles.id → auth.users.id

Use an explicit foreign key.

Approved roles:

TENANT
LANDLORD
ADMIN

Approved account statuses:

ACTIVE
SUSPENDED
DELETED

Do not store passwords.

Do not duplicate authentication credentials.

Do not add an application email column unless required by a documented requirement.

---

# 8. Auth User Deletion

Historical marketplace records must not disappear because an authenticated user is accidentally deleted.

Choose a foreign-key deletion policy consistent with the documented soft-deletion strategy.

Do not introduce broad cascading deletion from `auth.users` across rental history.

Document the chosen behavior in the migration or database README if it is non-obvious.

---

# 9. tenant_profiles Table

Create:

tenant_profiles

Fields:

id UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id UUID NOT NULL UNIQUE
occupation_type TEXT
employer_or_school TEXT
income_range TEXT
preferred_move_date DATE
preferred_lease_duration_months INTEGER
number_of_occupants INTEGER
has_pets BOOLEAN NOT NULL DEFAULT FALSE
bio TEXT
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at TIMESTAMPTZ NOT NULL DEFAULT now()

Foreign key:

user_id → profiles.id

Constraints when values are present:

preferred_lease_duration_months > 0
number_of_occupants >= 1

---

# 10. tenant_preferred_locations Table

Create:

tenant_preferred_locations

Fields:

id UUID PRIMARY KEY DEFAULT gen_random_uuid()
tenant_profile_id UUID NOT NULL
district TEXT
locality TEXT
neighbourhood TEXT
created_at TIMESTAMPTZ NOT NULL DEFAULT now()

Foreign key:

tenant_profile_id → tenant_profiles.id

Do not store preferred locations as comma-separated text.

---

# 11. landlord_profiles Table

Create:

landlord_profiles

Fields:

id UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id UUID NOT NULL UNIQUE
verification_status TEXT NOT NULL DEFAULT 'UNVERIFIED'
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at TIMESTAMPTZ NOT NULL DEFAULT now()

Foreign key:

user_id → profiles.id

Approved verification states:

UNVERIFIED
PENDING
VERIFIED
REJECTED

---

# 12. properties Table

Create:

properties

Fields:

id UUID PRIMARY KEY DEFAULT gen_random_uuid()
landlord_id UUID NOT NULL
property_type TEXT NOT NULL
address_line_1 TEXT
address_line_2 TEXT
district TEXT NOT NULL
locality TEXT NOT NULL
neighbourhood TEXT
latitude NUMERIC(9,6)
longitude NUMERIC(9,6)
bedrooms INTEGER NOT NULL
bathrooms NUMERIC(3,1) NOT NULL
furnished BOOLEAN NOT NULL DEFAULT FALSE
parking_spaces INTEGER NOT NULL DEFAULT 0
verification_status TEXT NOT NULL DEFAULT 'UNVERIFIED'
archived_at TIMESTAMPTZ
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at TIMESTAMPTZ NOT NULL DEFAULT now()

Foreign key:

landlord_id → landlord_profiles.id

Property types:

APARTMENT
HOUSE
STUDIO
ROOM
TOWNHOUSE
VILLA
OTHER

Verification states:

UNVERIFIED
PENDING
VERIFIED
REJECTED

Constraints:

bedrooms >= 0
bathrooms >= 0
parking_spaces >= 0

Latitude must be between:

-90 and 90

Longitude must be between:

-180 and 180

when values are present.

Do not expose public-address policy through the database itself; API serialization handles that later.

---

# 13. property_images Table

Create:

property_images

Fields:

id UUID PRIMARY KEY DEFAULT gen_random_uuid()
property_id UUID NOT NULL
storage_path TEXT NOT NULL
display_order INTEGER NOT NULL DEFAULT 0
is_cover BOOLEAN NOT NULL DEFAULT FALSE
created_at TIMESTAMPTZ NOT NULL DEFAULT now()

Foreign key:

property_id → properties.id

Constraint:

display_order >= 0

Unique:

UNIQUE(property_id, storage_path)

Critical partial unique index:

only one property image may have:

is_cover = TRUE

for a given property.

---

# 14. listings Table

Create:

listings

Fields:

id UUID PRIMARY KEY DEFAULT gen_random_uuid()
property_id UUID NOT NULL
title TEXT NOT NULL
description TEXT NOT NULL
monthly_rent NUMERIC(12,2) NOT NULL
deposit_amount NUMERIC(12,2)
available_from DATE NOT NULL
minimum_lease_months INTEGER
maximum_occupants INTEGER
pets_allowed BOOLEAN NOT NULL DEFAULT FALSE
status TEXT NOT NULL DEFAULT 'DRAFT'
published_at TIMESTAMPTZ
closed_at TIMESTAMPTZ
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at TIMESTAMPTZ NOT NULL DEFAULT now()

Foreign key:

property_id → properties.id

Approved states:

DRAFT
PENDING_REVIEW
ACTIVE
PAUSED
RENTED
CLOSED

Constraints:

monthly_rent >= 0

deposit_amount >= 0 when not null

minimum_lease_months > 0 when not null

maximum_occupants > 0 when not null

---

# 15. One Live Listing Per Property

Create a partial unique index preventing more than one live listing for the same property.

Live states:

PENDING_REVIEW
ACTIVE
PAUSED

Historical states:

RENTED
CLOSED

must not prevent a later rental cycle.

---

# 16. saved_listings Table

Create:

saved_listings

Fields:

tenant_id UUID NOT NULL
listing_id UUID NOT NULL
created_at TIMESTAMPTZ NOT NULL DEFAULT now()

Primary key:

(tenant_id, listing_id)

Foreign keys:

tenant_id → tenant_profiles.id
listing_id → listings.id

This composite primary key must prevent duplicate saves.

---

# 17. application_questions Table

Create:

application_questions

Fields:

id UUID PRIMARY KEY DEFAULT gen_random_uuid()
listing_id UUID NOT NULL
question_text TEXT NOT NULL
question_type TEXT NOT NULL
is_required BOOLEAN NOT NULL DEFAULT FALSE
display_order INTEGER NOT NULL DEFAULT 0
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at TIMESTAMPTZ NOT NULL DEFAULT now()

Foreign key:

listing_id → listings.id

Approved types:

TEXT
NUMBER
BOOLEAN
DATE
SELECT

Constraint:

display_order >= 0

---

# 18. application_question_options Table

Create:

application_question_options

Fields:

id UUID PRIMARY KEY DEFAULT gen_random_uuid()
question_id UUID NOT NULL
option_text TEXT NOT NULL
display_order INTEGER NOT NULL DEFAULT 0

Foreign key:

question_id → application_questions.id

Constraint:

display_order >= 0

Do not attempt to enforce all SELECT-question semantics purely through SQL.

That belongs partly to the service layer later.

---

# 19. applications Table

Create:

applications

Fields:

id UUID PRIMARY KEY DEFAULT gen_random_uuid()
listing_id UUID NOT NULL
tenant_id UUID NOT NULL
move_in_date DATE
requested_lease_duration_months INTEGER
number_of_occupants INTEGER
introductory_message TEXT
status TEXT NOT NULL DEFAULT 'DRAFT'
submitted_at TIMESTAMPTZ
withdrawn_at TIMESTAMPTZ
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at TIMESTAMPTZ NOT NULL DEFAULT now()

Foreign keys:

listing_id → listings.id
tenant_id → tenant_profiles.id

Approved statuses:

DRAFT
SUBMITTED
UNDER_REVIEW
SHORTLISTED
VIEWING_INVITED
VIEWING_COMPLETED
ACCEPTED
REJECTED
WITHDRAWN

Constraints when provided:

requested_lease_duration_months > 0
number_of_occupants > 0

---

# 20. One Application Per Tenant Per Listing

Create:

UNIQUE(listing_id, tenant_id)

V1 does not support multiple application records from the same tenant for the same listing.

---

# 21. Application Submission Integrity

Create a database constraint so that:

DRAFT

may exist without:

submitted_at

but non-draft applications require:

submitted_at IS NOT NULL

Do not attempt to enforce every workflow transition with SQL CHECK constraints.

Transition authorization belongs to the service layer later.

---

# 22. One Accepted Application Per Listing

Create a partial unique index:

one ACCEPTED application per listing.

This is a critical database integrity guarantee.

It must protect against concurrent acceptance attempts later.

---

# 23. application_answers Table

Create:

application_answers

Fields:

id UUID PRIMARY KEY DEFAULT gen_random_uuid()
application_id UUID NOT NULL
question_id UUID NOT NULL
answer_text TEXT
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at TIMESTAMPTZ NOT NULL DEFAULT now()

Foreign keys:

application_id → applications.id
question_id → application_questions.id

Unique:

UNIQUE(application_id, question_id)

Do not over-engineer typed answer columns in V1.

Type validation belongs to the backend service layer.

---

# 24. application_status_history Table

Create:

application_status_history

Fields:

id UUID PRIMARY KEY DEFAULT gen_random_uuid()
application_id UUID NOT NULL
from_status TEXT
to_status TEXT NOT NULL
changed_by_user_id UUID NOT NULL
created_at TIMESTAMPTZ NOT NULL DEFAULT now()

Foreign keys:

application_id → applications.id
changed_by_user_id → profiles.id

`from_status` may be null for an initial history record if later workflow logic requires that.

`to_status` must use an approved application status value.

If practical, constrain both status columns to the approved state set.

---

# 25. viewings Table

Create:

viewings

Fields:

id UUID PRIMARY KEY DEFAULT gen_random_uuid()
application_id UUID NOT NULL
proposed_by_user_id UUID NOT NULL
start_time TIMESTAMPTZ NOT NULL
end_time TIMESTAMPTZ
status TEXT NOT NULL DEFAULT 'PROPOSED'
notes TEXT
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at TIMESTAMPTZ NOT NULL DEFAULT now()

Foreign keys:

application_id → applications.id
proposed_by_user_id → profiles.id

Approved states:

PROPOSED
CONFIRMED
DECLINED
COMPLETED
CANCELLED
NO_SHOW

Constraint:

end_time > start_time

when end_time is provided.

Multiple viewings per application must remain supported.

Do not create a unique constraint on application_id.

---

# 26. conversations Table

Create:

conversations

Fields:

id UUID PRIMARY KEY DEFAULT gen_random_uuid()
listing_id UUID NOT NULL
tenant_user_id UUID NOT NULL
landlord_user_id UUID NOT NULL
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at TIMESTAMPTZ NOT NULL DEFAULT now()

Foreign keys:

listing_id → listings.id
tenant_user_id → profiles.id
landlord_user_id → profiles.id

Unique:

UNIQUE(listing_id, tenant_user_id, landlord_user_id)

---

# 27. conversation_participants Table

Create:

conversation_participants

Fields:

conversation_id UUID NOT NULL
user_id UUID NOT NULL
last_read_at TIMESTAMPTZ
joined_at TIMESTAMPTZ NOT NULL DEFAULT now()

Primary key:

(conversation_id, user_id)

Foreign keys:

conversation_id → conversations.id
user_id → profiles.id

---

# 28. messages Table

Create:

messages

Fields:

id UUID PRIMARY KEY DEFAULT gen_random_uuid()
conversation_id UUID NOT NULL
sender_user_id UUID NOT NULL
content TEXT NOT NULL
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
edited_at TIMESTAMPTZ
deleted_at TIMESTAMPTZ

Foreign keys:

conversation_id → conversations.id
sender_user_id → profiles.id

Do not attempt to enforce conversation membership through a plain foreign key.

Membership must later be enforced by service logic and RLS where applicable.

---

# 29. notifications Table

Create:

notifications

Fields:

id UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id UUID NOT NULL
type TEXT NOT NULL
title TEXT NOT NULL
message TEXT NOT NULL
entity_type TEXT
entity_id UUID
read_at TIMESTAMPTZ
created_at TIMESTAMPTZ NOT NULL DEFAULT now()

Foreign key:

user_id → profiles.id

`entity_id` is intentionally generic and should not have an invalid multi-table foreign key.

---

# 30. reports Table

Create:

reports

Fields:

id UUID PRIMARY KEY DEFAULT gen_random_uuid()
reporter_user_id UUID NOT NULL
reported_user_id UUID
listing_id UUID
reason TEXT NOT NULL
description TEXT
status TEXT NOT NULL DEFAULT 'OPEN'
resolved_by_user_id UUID
resolution_notes TEXT
resolved_at TIMESTAMPTZ
created_at TIMESTAMPTZ NOT NULL DEFAULT now()

Foreign keys:

reporter_user_id → profiles.id
reported_user_id → profiles.id
listing_id → listings.id
resolved_by_user_id → profiles.id

Approved states:

OPEN
UNDER_REVIEW
RESOLVED
DISMISSED

Approved reasons:

FAKE_LISTING
INCORRECT_INFORMATION
PROPERTY_UNAVAILABLE
DUPLICATE_LISTING
SUSPICIOUS_LANDLORD
SUSPICIOUS_TENANT
HARASSMENT
OTHER

Critical constraint:

at least one of:

reported_user_id
listing_id

must be non-null.

---

# 31. verification_records Table

Create:

verification_records

Fields:

id UUID PRIMARY KEY DEFAULT gen_random_uuid()
subject_type TEXT NOT NULL
subject_id UUID NOT NULL
verification_type TEXT NOT NULL
status TEXT NOT NULL DEFAULT 'PENDING'
reviewed_by_user_id UUID
notes TEXT
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
reviewed_at TIMESTAMPTZ

Approved subject types:

USER
PROPERTY

Approved verification types:

EMAIL
PHONE
LANDLORD_IDENTITY
PROPERTY_INFORMATION
PROPERTY_AUTHORITY

Approved states:

PENDING
VERIFIED
REJECTED
EXPIRED

Foreign key:

reviewed_by_user_id → profiles.id

Do NOT create a foreign key for:

subject_id

because the relationship is intentionally polymorphic.

Later service logic must validate the referenced subject.

---

# 32. admin_audit_logs Table

Create:

admin_audit_logs

Fields:

id UUID PRIMARY KEY DEFAULT gen_random_uuid()
admin_user_id UUID NOT NULL
action TEXT NOT NULL
target_type TEXT NOT NULL
target_id UUID
reason TEXT
metadata JSONB
created_at TIMESTAMPTZ NOT NULL DEFAULT now()

Foreign key:

admin_user_id → profiles.id

Do not provide mutation logic for audit history in this task.

---

# 33. updated_at Handling

Implement one consistent PostgreSQL mechanism for tables with:

updated_at

Preferred approach:

a reusable trigger function.

Example concept:

set_updated_at()

Apply it consistently to all tables containing `updated_at`.

Do not depend on every future controller remembering to update timestamps manually.

---

# 34. Required Indexes

At minimum implement indexes for:

profiles(role)

properties(landlord_id)

properties(district, locality)

listings(status)

listings(available_from)

listings(monthly_rent)

applications(listing_id)

applications(tenant_id)

applications(listing_id, status)

messages(conversation_id, created_at)

notifications(user_id, created_at DESC)

and an unread-notification partial index:

notifications(user_id)
WHERE read_at IS NULL

---

# 35. Foreign Key Index Review

PostgreSQL does not automatically create indexes for every foreign key.

Review high-traffic foreign-key columns and create useful indexes where obvious.

Examples may include:

property_images(property_id)

saved_listings(listing_id)

application_questions(listing_id)

application_answers(application_id)

application_status_history(application_id)

viewings(application_id)

conversations(listing_id)

conversation_participants(user_id)

reports(listing_id)

Do not create excessive speculative indexes.

---

# 36. Delete Behavior

Historical marketplace data should be preserved.

Do not use broad `ON DELETE CASCADE` behavior on core historical entities without explicit justification.

For dependent records that are purely structural and have no independent historical value, limited cascading may be appropriate.

Examples requiring deliberate judgment:

application_question_options → question
conversation_participants → conversation

Document non-obvious cascade decisions.

Do not let deleting a property automatically erase rental history.

---

# 37. Row Level Security

Enable Row Level Security on all application tables in the public schema.

At this stage, default to deny-by-default.

Do not add broad anonymous/authenticated policies merely to make development easier.

Core workflow will use the Node API.

TASK-002 and later tasks will introduce identity-aware access policies where required.

---

# 38. RLS Initial Posture

After TASK-001:

Direct browser access using the publishable key should not be able to freely read or write private platform tables.

This is intentional.

Do not create:

USING (true)

or:

WITH CHECK (true)

policies on private marketplace tables without a documented reason.

---

# 39. Supabase Secret Key

Do not modify TASK-000 security architecture.

The secret key remains:

backend only.

Never put:

SUPABASE_SECRET_KEY

in:

frontend/
VITE_*
SQL files
seed data
tests
documentation values

---

# 40. Development Seed Foundation

Create development seed SQL under:

database/seeds/

The seed must be clearly marked:

DEVELOPMENT / TEST ONLY

It must never be automatically run against production.

---

# 41. Supabase Auth Seed Limitation

Do not fabricate arbitrary `auth.users` rows in a way that would be unsafe or incompatible with Supabase Auth.

Because `profiles.id` references `auth.users.id`, seed logic should respect the authentication environment.

Choose one of these safe approaches:

1. provide application-data seed helpers designed to work after test auth users are created, or
2. create local-Supabase-compatible auth seed users using officially supported local development mechanisms, if the tooling is available and the approach is reliable.

Do not weaken the foreign key merely to simplify seed data.

Document the chosen approach.

---

# 42. Seed Personas

The intended development personas are:

Tenant A
Tenant B

Landlord A
Landlord B

Admin A

Eventually include sample:

properties
listings
applications
viewing
conversation
messages
notifications

However, seed implementation must remain compatible with real Supabase Auth identity requirements.

Do not create invalid relational data merely to satisfy the list.

---

# 43. Database Documentation

Update or create:

database/README.md

Explain:

- migration directory
- migration order
- how to apply migrations locally
- how seeds work
- RLS posture
- destructive-reset warning
- production migration rule

Keep it concise and practical.

---

# 44. Schema Snapshot

If useful, maintain:

database/schema/

with a generated or documented schema representation.

Do not manually maintain a duplicate SQL schema if it will predictably drift from migrations.

Migrations remain the source of truth.

If a schema snapshot is generated, document how it is regenerated.

---

# 45. Local Verification

If Supabase CLI and its required local runtime are available:

apply migrations to a clean local Supabase database.

Then verify constraints against the running database.

If the environment does not support local Supabase execution, do not install unsafe or excessive infrastructure solely to pretend verification succeeded.

Instead:

- validate SQL as far as the available environment permits
- run available checks
- report exactly what could and could not be executed

---

# 46. Supabase CLI

Do not make Supabase CLI a global machine requirement.

If the project adopts it, prefer a documented local/project-compatible workflow.

Do not change the architecture merely because Docker or local Supabase is unavailable.

---

# 47. Database Verification Tests

Where the environment permits actual PostgreSQL execution, add tests proving critical invariants.

Critical tests:

- one live listing per property
- one cover image per property
- one application per tenant/listing
- one accepted application per listing
- negative rent rejected
- invalid occupants rejected
- invalid status rejected
- report requires a target
- viewing end time must follow start time

---

# 48. Static Verification

Regardless of database runtime availability, Codex must inspect migrations and confirm that each critical invariant has an explicit database-level implementation.

Do not claim runtime database tests were executed if they were not.

---

# 49. No Business State Machine in SQL

Do not attempt to implement full application workflow authorization through database triggers.

For example, TASK-001 should not create complicated triggers controlling:

SUBMITTED → UNDER_REVIEW
UNDER_REVIEW → SHORTLISTED

Those rules belong to the Node service layer.

Database constraints should protect structural invariants.

---

# 50. No Automatic Applicant Decisions

Do not add:

tenant_score
match_score
ranking
recommendation_score
priority_score
risk_score

or any similar tenant-selection columns.

These are outside V1.

---

# 51. Money

Use:

NUMERIC(12,2)

for:

monthly_rent
deposit_amount

Do not use:

FLOAT
REAL
DOUBLE PRECISION

for money.

V1 assumes Mauritian Rupees.

Do not add currency complexity unless required.

---

# 52. Time

Use:

TIMESTAMPTZ

for event timestamps.

Do not use timezone-naive timestamps for:

created_at
updated_at
submitted_at
viewing times
message times
audit times

Dates such as:

available_from
preferred_move_date

should remain DATE.

---

# 53. Naming

Use:

snake_case

for:

tables
columns
constraints where practical
indexes

Use descriptive names.

Avoid generated names that make debugging unnecessarily difficult.

---

# 54. Migration Safety

Migrations must:

- be deterministic
- fail clearly when invalid
- not contain production credentials
- not destroy existing unrelated data
- not depend on a particular developer's filesystem
- not depend on hardcoded database URLs

---

# 55. SQL Quality

Prefer explicit SQL.

Avoid overly clever dynamic SQL.

Add comments for important non-obvious constraints such as:

- one accepted application
- one live listing
- polymorphic verification subject
- RLS deny-by-default posture

---

# 56. Dependency Changes

Do not add application runtime dependencies for this task unless genuinely required.

Database tooling may be added as a development dependency only when it clearly improves reproducibility.

Document every added dependency.

---

# 57. Documentation Consistency

If implementation reveals a genuine contradiction in:

docs/DATABASE.md

or another governing document:

do not silently choose a different schema.

Report the conflict.

For small correctness issues that clearly have one safe resolution, implement the minimal correction and update the relevant documentation.

Do not redesign product architecture.

---

# 58. Required Verification

Before completion, run from repository root:

npm run lint
npm run test
npm run build
npm run format:check

Also run all database-specific validation available in the environment.

If package scripts are added for database checks, run them.

---

# 59. Existing TASK-000 Regression Protection

TASK-001 must not break the existing bootstrap.

After database work:

- frontend tests must still pass
- backend tests must still pass
- frontend build must still pass
- health endpoint architecture must remain unchanged unless required

Do not regress TASK-000.

---

# 60. Acceptance Criteria

TASK-001 is complete only when:

- [ ] Reproducible SQL migrations exist.
- [ ] All approved V1 tables exist in migrations.
- [ ] profiles references auth.users correctly.
- [ ] No password/auth credentials are duplicated.
- [ ] All documented primary keys exist.
- [ ] Required foreign keys exist.
- [ ] Role constraints exist.
- [ ] Account status constraints exist.
- [ ] Property type constraints exist.
- [ ] Verification status constraints exist.
- [ ] Listing status constraints exist.
- [ ] Application status constraints exist.
- [ ] Viewing status constraints exist.
- [ ] Report status/reason constraints exist.
- [ ] Verification subject/type/status constraints exist.
- [ ] Money uses NUMERIC(12,2).
- [ ] Event timestamps use TIMESTAMPTZ.
- [ ] Coordinate range checks exist.
- [ ] One cover image per property enforced at database level.
- [ ] One live listing per property enforced at database level.
- [ ] One application per tenant/listing enforced at database level.
- [ ] One accepted application per listing enforced at database level.
- [ ] Application submitted_at integrity exists.
- [ ] Viewing time-order integrity exists.
- [ ] Report target integrity exists.
- [ ] Required indexes exist.
- [ ] updated_at handling is automatic and consistent.
- [ ] RLS enabled on application tables.
- [ ] No permissive blanket RLS policies added.
- [ ] Seed strategy respects Supabase Auth.
- [ ] database/README.md explains migration/seed workflow.
- [ ] No production secrets exist.
- [ ] Existing lint/tests/build still pass.
- [ ] Database-specific checks available in the environment were run.
- [ ] No API/product features outside TASK-001 were implemented.

---

# 61. Definition of Done

TASK-001 requires:

schema
+
constraints
+
indexes
+
RLS foundation
+
migration reproducibility
+
seed foundation
+
verification
+
documentation

Simply creating tables is not enough.

---

# 62. Completion Report

When finished, report:

## Summary

Describe the database foundation implemented.

## Migrations Added

List every migration and its purpose.

## Tables Created

List all tables.

## Critical Constraints

Explicitly report implementation of:

- one live listing per property
- one cover image per property
- one application per tenant/listing
- one accepted application per listing

## Indexes Added

Summarize important indexes.

## RLS

Report:

- which tables have RLS enabled
- policies created, if any
- why

Expected initial posture:

RLS enabled with no broad permissive client policies.

## updated_at

Explain the implementation used.

## Seed Strategy

Explain how Supabase Auth-linked users are handled safely.

## Database Verification

Report exactly which database checks were executed.

Distinguish:

runtime database verification

from:

static SQL inspection

Do not imply runtime verification occurred if no database runtime was available.

## Tests

Report:

Tests added:
Tests run:
Tests passed:
Tests failed:
Tests skipped:

## Root Verification

Report results for:

npm run lint
npm run test
npm run build
npm run format:check

## Dependencies Added

List any new dependencies and why they were necessary.

## Documentation Updated

List database/documentation changes.

## Security Notes

Confirm:

- no secrets committed
- RLS posture
- no frontend secret key
- no sensitive identity-document tables introduced

## Known Limitations

Report genuine limitations.

## Recommended Next Task

TASK-002 — Authentication & Authorization

Then stop.

Do not implement TASK-002 automatically.