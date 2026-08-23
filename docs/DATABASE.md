# Mauritius Rental Platform — Database Design

## 1. Database Objective

The database supports the complete V1 rental workflow while preserving:

* data integrity
* clear ownership
* secure authorization
* controlled application states
* controlled listing states
* historical records
* verification
* future scalability
* auditability

Technology:

* PostgreSQL
* hosted through Supabase

Supabase Auth manages authentication identities.

PostgreSQL stores application/business data.

---

# 2. Authentication Identity

Supabase Auth maintains authenticated users in:

```text
auth.users
```

Do not duplicate:

* passwords
* password hashes
* authentication credentials

inside application tables.

Create an application profile linked directly to:

```text
auth.users.id
```

Relationship:

```text
auth.users
    |
    | 1 : 1
    |
profiles
```

The `profiles.id` UUID should equal the corresponding Supabase Auth user UUID.

---

# 3. User Roles

V1 roles:

```text
TENANT
LANDLORD
ADMIN
```

A user has one primary V1 role.

Multi-role accounts are outside V1 unless explicitly approved later.

---

# 4. Entity Relationship Overview

```text
auth.users
    |
    v
profiles
   |
   +-----------------------------+
   |                             |
   v                             v
tenant_profiles           landlord_profiles
   |                             |
   v                             v
tenant_preferred_locations   properties
                                 |
                    +------------+-------------+
                    |                          |
                    v                          v
             property_images               listings
                                               |
              +----------------+---------------+----------------+
              |                |                                |
              v                v                                v
       saved_listings   application_questions             applications
                              |                                |
                              v                                v
                    application_question_options      application_answers
                                                               |
                                                               v
                                                  application_status_history
                                                               |
                                                               v
                                                           viewings

profiles
   |
   +------ conversations
   |             |
   |             v
   |     conversation_participants
   |             |
   |             v
   |          messages
   |
   +------ notifications
   |
   +------ reports
   |
   +------ verification_records
   |
   +------ admin_audit_logs
```

---

# 5. UUID Generation

Preferred primary keys:

```text
UUID
```

Use PostgreSQL:

```sql
gen_random_uuid()
```

where application-generated IDs are not required.

---

# 6. Business State Storage

Prefer:

```text
TEXT + CHECK constraint
```

for most business states rather than excessive PostgreSQL enums.

Example:

```sql
status TEXT NOT NULL CHECK (
  status IN ('ACTIVE', 'SUSPENDED', 'DELETED')
)
```

This keeps state changes easier to migrate later.

---

# 7. profiles

Purpose:

Base platform profile attached to authenticated Supabase user.

```text
profiles

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
```

Foreign key:

```text
id → auth.users.id
```

Role:

```text
TENANT
LANDLORD
ADMIN
```

Account status:

```text
ACTIVE
SUSPENDED
DELETED
```

Email should normally come from Supabase Auth rather than being duplicated unless an explicit application requirement emerges.

---

# 8. tenant_profiles

```text
tenant_profiles

id UUID PRIMARY KEY
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
```

Foreign key:

```text
user_id → profiles.id
```

Constraints:

```text
preferred_lease_duration_months > 0
number_of_occupants >= 1
```

when values are provided.

Do not store highly sensitive identity or financial documents here.

---

# 9. tenant_preferred_locations

A tenant may prefer multiple locations.

Do not use comma-separated location strings.

```text
tenant_preferred_locations

id UUID PRIMARY KEY
tenant_profile_id UUID NOT NULL
district TEXT
locality TEXT
neighbourhood TEXT
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
```

Foreign key:

```text
tenant_profile_id → tenant_profiles.id
```

---

# 10. landlord_profiles

```text
landlord_profiles

id UUID PRIMARY KEY
user_id UUID NOT NULL UNIQUE
verification_status TEXT NOT NULL DEFAULT 'UNVERIFIED'
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
```

Foreign key:

```text
user_id → profiles.id
```

Verification status:

```text
UNVERIFIED
PENDING
VERIFIED
REJECTED
```

---

# 11. properties

A property represents the physical asset.

A property is not a listing.

```text
properties

id UUID PRIMARY KEY
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
```

Foreign key:

```text
landlord_id → landlord_profiles.id
```

Constraints:

```text
bedrooms >= 0
bathrooms >= 0
parking_spaces >= 0
```

Property types:

```text
APARTMENT
HOUSE
STUDIO
ROOM
TOWNHOUSE
VILLA
OTHER
```

Verification status:

```text
UNVERIFIED
PENDING
VERIFIED
REJECTED
```

---

# 12. Property Archival

Normal user workflow should not hard-delete historical properties.

Use:

```text
archived_at
```

to archive them.

A property with historical listings/applications should remain available internally.

---

# 13. Property Address Privacy

The database may store exact address information.

Public API responses should not automatically expose it.

Public listing responses may initially show:

* district
* locality
* neighbourhood

instead.

Exact address release should be a deliberate product decision.

---

# 14. property_images

Actual image files are stored in Supabase Storage.

Database stores metadata.

```text
property_images

id UUID PRIMARY KEY
property_id UUID NOT NULL
storage_path TEXT NOT NULL
display_order INTEGER NOT NULL DEFAULT 0
is_cover BOOLEAN NOT NULL DEFAULT FALSE
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
```

Foreign key:

```text
property_id → properties.id
```

Unique:

```text
UNIQUE(property_id, storage_path)
```

Only one cover image per property:

```sql
CREATE UNIQUE INDEX one_cover_image_per_property
ON property_images(property_id)
WHERE is_cover = TRUE;
```

---

# 15. listings

A listing represents one rental cycle/offering for a property.

```text
listings

id UUID PRIMARY KEY
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
```

Foreign key:

```text
property_id → properties.id
```

Constraints:

```text
monthly_rent >= 0
deposit_amount >= 0
minimum_lease_months > 0
maximum_occupants > 0
```

when nullable values are supplied.

Status:

```text
DRAFT
PENDING_REVIEW
ACTIVE
PAUSED
RENTED
CLOSED
```

---

# 16. One Live Listing Per Property

Prevent multiple simultaneous rental cycles for the same property:

```sql
CREATE UNIQUE INDEX one_live_listing_per_property
ON listings(property_id)
WHERE status IN ('PENDING_REVIEW', 'ACTIVE', 'PAUSED');
```

Historical:

```text
RENTED
CLOSED
```

listings remain allowed.

---

# 17. saved_listings

```text
saved_listings

tenant_id UUID NOT NULL
listing_id UUID NOT NULL
created_at TIMESTAMPTZ NOT NULL DEFAULT now()

PRIMARY KEY (tenant_id, listing_id)
```

Foreign keys:

```text
tenant_id → tenant_profiles.id
listing_id → listings.id
```

Composite primary key prevents duplicate saves.

---

# 18. application_questions

Landlord-defined listing-specific questions.

```text
application_questions

id UUID PRIMARY KEY
listing_id UUID NOT NULL
question_text TEXT NOT NULL
question_type TEXT NOT NULL
is_required BOOLEAN NOT NULL DEFAULT FALSE
display_order INTEGER NOT NULL DEFAULT 0
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
```

Foreign key:

```text
listing_id → listings.id
```

Question types:

```text
TEXT
NUMBER
BOOLEAN
DATE
SELECT
```

---

# 19. application_question_options

Used for SELECT questions.

```text
application_question_options

id UUID PRIMARY KEY
question_id UUID NOT NULL
option_text TEXT NOT NULL
display_order INTEGER NOT NULL DEFAULT 0
```

Foreign key:

```text
question_id → application_questions.id
```

---

# 20. applications

Represents one tenant application to one listing.

```text
applications

id UUID PRIMARY KEY
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
```

Foreign keys:

```text
listing_id → listings.id
tenant_id → tenant_profiles.id
```

Status:

```text
DRAFT
SUBMITTED
UNDER_REVIEW
SHORTLISTED
VIEWING_INVITED
VIEWING_COMPLETED
ACCEPTED
REJECTED
WITHDRAWN
```

Constraints:

```text
requested_lease_duration_months > 0
number_of_occupants > 0
```

when supplied.

---

# 21. Application Uniqueness

One tenant should have only one application record per listing:

```text
UNIQUE(listing_id, tenant_id)
```

If future reapplication is introduced, explicitly redesign the rule.

Do not simply create duplicates.

---

# 22. Application Submission Integrity

A non-draft application should have submission time populated.

Recommended:

```sql
CHECK (
  status = 'DRAFT'
  OR submitted_at IS NOT NULL
)
```

The service layer must also enforce submission rules.

---

# 23. application_answers

```text
application_answers

id UUID PRIMARY KEY
application_id UUID NOT NULL
question_id UUID NOT NULL
answer_text TEXT
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
```

Foreign keys:

```text
application_id → applications.id
question_id → application_questions.id
```

Unique:

```text
UNIQUE(application_id, question_id)
```

Validation that an answer matches:

```text
TEXT
NUMBER
BOOLEAN
DATE
SELECT
```

belongs primarily to the service layer.

---

# 24. Historical Application Question Protection

Once a listing has received a:

```text
SUBMITTED
```

application:

Existing application questions must not be destructively changed or removed in V1.

Required questions must not be added in a way that invalidates previously submitted applications.

The service layer must enforce this.

---

# 25. application_status_history

Provides an audit trail.

```text
application_status_history

id UUID PRIMARY KEY
application_id UUID NOT NULL
from_status TEXT
to_status TEXT NOT NULL
changed_by_user_id UUID NOT NULL
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
```

Foreign keys:

```text
application_id → applications.id
changed_by_user_id → profiles.id
```

---

# 26. Application Status Transactions

Application transitions should update:

```text
applications.status
```

and:

```text
application_status_history
```

atomically where possible.

TASK-012 implements the first transition with the narrowly scoped
`submit_application_transaction` database function. The Node API completes
authentication, ACTIVE-account, TENANT-role, ownership, and readiness checks,
then calls the function through the backend-only privileged client. Inside one
transaction the function rechecks ownership and listing eligibility, locks the
application, validates the current required fields/questions/answers, performs
the conditional `DRAFT` to `SUBMITTED` update, assigns `submitted_at`, and
inserts its status-history row.

Submission and `mutate_application_question_transaction` take the same
transaction-scoped PostgreSQL advisory lock derived from `listing_id`. This
serializes first submission against structural question changes without
moving unrelated workflow policy into SQL. An application row lock serializes
repeated submit calls. The partial unique index
`application_status_history_one_submission_idx` is the final backstop against
more than one `DRAFT` to `SUBMITTED` history record per application.

The `application_answers_require_draft` trigger locks the parent application
and rejects answer insert, update, or delete after it leaves DRAFT. This closes
the answer-write race at the same database boundary as submission.

TASK-015 adds the narrowly scoped
`transition_application_status_transaction` function for review, shortlist,
rejection, and tenant withdrawal. The Node API first performs authentication,
ACTIVE-account, role, application ownership, and explicit-endpoint checks. The
function then locks the application row, rechecks the actor relationship and
role against application tables, compares the status observed by the service
with the locked status, applies one approved edge, and inserts one
actor-attributed `application_status_history` row in the same transaction.

Identical target retries are read-only and succeed only when corresponding
history exists. Different targets racing from the same observed state cannot
both commit. `withdrawn_at` is assigned only by a successful transition to
`WITHDRAWN`. The function is `SECURITY DEFINER` with an empty search path,
contains no dynamic SQL, is revoked from `PUBLIC`, `anon`, and `authenticated`,
and is executable only by `service_role`.

The service layer validates:

* user
* role
* ownership
* current status
* requested status

---

# 27. viewings

A viewing belongs to an application.

```text
viewings

id UUID PRIMARY KEY
application_id UUID NOT NULL
proposed_by_user_id UUID NOT NULL
start_time TIMESTAMPTZ NOT NULL
end_time TIMESTAMPTZ
status TEXT NOT NULL DEFAULT 'PROPOSED'
notes TEXT
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
```

Foreign keys:

```text
application_id → applications.id
proposed_by_user_id → profiles.id
```

Status:

```text
PROPOSED
CONFIRMED
DECLINED
COMPLETED
CANCELLED
NO_SHOW
```

Constraint:

```text
end_time > start_time
at most one open viewing per application where status is PROPOSED or CONFIRMED
```

when `end_time` exists.

---

# 28. Multiple Viewings

One application may have multiple viewings.

Example:

```text
Viewing 1 → DECLINED
Viewing 2 → CONFIRMED
```

Relationship:

```text
applications 1 : many viewings
```

Do not enforce one viewing per application. TASK-016 adds a partial unique
index only for open states (`PROPOSED`, `CONFIRMED`), preserving any number of
terminal historical viewings. Backend-only transaction functions serialize the
first proposal/application transition and each viewing action. Completing a
viewing atomically moves its application from `VIEWING_INVITED` to
`VIEWING_COMPLETED` and writes exactly one application-status-history row.

---

# 29. conversations

Represents a landlord/tenant conversation for a listing.

```text
conversations

id UUID PRIMARY KEY
listing_id UUID NOT NULL
tenant_user_id UUID NOT NULL
landlord_user_id UUID NOT NULL
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
```

Foreign keys:

```text
listing_id → listings.id
tenant_user_id → profiles.id
landlord_user_id → profiles.id
```

Unique:

```text
UNIQUE(listing_id, tenant_user_id, landlord_user_id)
```

---

# 30. conversation_participants

Used for membership and read tracking.

```text
conversation_participants

conversation_id UUID NOT NULL
user_id UUID NOT NULL
last_read_at TIMESTAMPTZ
joined_at TIMESTAMPTZ NOT NULL DEFAULT now()

PRIMARY KEY (conversation_id, user_id)
```

Foreign keys:

```text
conversation_id → conversations.id
user_id → profiles.id
```

---

# 31. messages

```text
messages

id UUID PRIMARY KEY
conversation_id UUID NOT NULL
sender_user_id UUID NOT NULL
content TEXT NOT NULL
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
edited_at TIMESTAMPTZ
deleted_at TIMESTAMPTZ
```

Foreign keys:

```text
conversation_id → conversations.id
sender_user_id → profiles.id
```

Backend must validate that sender belongs to conversation.

---

# 32. notifications

```text
notifications

id UUID PRIMARY KEY
user_id UUID NOT NULL
type TEXT NOT NULL
title TEXT NOT NULL
message TEXT NOT NULL
entity_type TEXT
entity_id UUID
read_at TIMESTAMPTZ
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
```

Foreign key:

```text
user_id → profiles.id
```

Example types:

```text
APPLICATION_RECEIVED
APPLICATION_SHORTLISTED
APPLICATION_REJECTED
APPLICATION_ACCEPTED
VIEWING_PROPOSED
VIEWING_CONFIRMED
MESSAGE_RECEIVED
```

---

# 33. reports

```text
reports

id UUID PRIMARY KEY
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
```

Foreign keys:

```text
reporter_user_id → profiles.id
reported_user_id → profiles.id
listing_id → listings.id
resolved_by_user_id → profiles.id
```

Statuses:

```text
OPEN
UNDER_REVIEW
RESOLVED
DISMISSED
```

Require at least one target:

```sql
CHECK (
  reported_user_id IS NOT NULL
  OR listing_id IS NOT NULL
)
```

---

# 34. Report Reasons

Initial reasons:

```text
FAKE_LISTING
INCORRECT_INFORMATION
PROPERTY_UNAVAILABLE
DUPLICATE_LISTING
SUSPICIOUS_LANDLORD
SUSPICIOUS_TENANT
HARASSMENT
OTHER
```

---

# 35. verification_records

Stores specific verification actions.

```text
verification_records

id UUID PRIMARY KEY
subject_type TEXT NOT NULL
subject_id UUID NOT NULL
verification_type TEXT NOT NULL
status TEXT NOT NULL DEFAULT 'PENDING'
reviewed_by_user_id UUID
notes TEXT
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
reviewed_at TIMESTAMPTZ
```

Subject types:

```text
USER
PROPERTY
```

Verification types:

```text
EMAIL
PHONE
LANDLORD_IDENTITY
PROPERTY_INFORMATION
PROPERTY_AUTHORITY
```

Statuses:

```text
PENDING
VERIFIED
REJECTED
EXPIRED
```

Because `subject_id` can reference different subject types, this is polymorphic.

Backend/admin services must validate the referenced subject.

---

# 36. Verification Display Rule

Do not display only:

```text
Verified
```

Prefer precise indicators:

```text
Email verified
Phone verified
Landlord identity reviewed
Property information reviewed
```

A badge must reflect what was actually checked.

---

# 37. admin_audit_logs

```text
admin_audit_logs

id UUID PRIMARY KEY
admin_user_id UUID NOT NULL
action TEXT NOT NULL
target_type TEXT NOT NULL
target_id UUID
reason TEXT
metadata JSONB
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
```

Foreign key:

```text
admin_user_id → profiles.id
```

Example actions:

```text
USER_SUSPENDED
USER_RESTORED
LISTING_REMOVED
REPORT_RESOLVED
VERIFICATION_APPROVED
VERIFICATION_REJECTED
```

Ordinary application functionality must not modify historical audit records.

---

# 38. Recommended Indexes

## Profiles

```sql
CREATE INDEX idx_profiles_role
ON profiles(role);
```

## Properties

```sql
CREATE INDEX idx_properties_landlord
ON properties(landlord_id);
```

```sql
CREATE INDEX idx_properties_location
ON properties(district, locality);
```

## Listings

```sql
CREATE INDEX idx_listings_status
ON listings(status);
```

```sql
CREATE INDEX idx_listings_available_from
ON listings(available_from);
```

```sql
CREATE INDEX idx_listings_rent
ON listings(monthly_rent);
```

---

# 39. Application Indexes

```sql
CREATE INDEX idx_applications_listing
ON applications(listing_id);
```

```sql
CREATE INDEX idx_applications_tenant
ON applications(tenant_id);
```

```sql
CREATE INDEX idx_applications_listing_status
ON applications(listing_id, status);
```

These support landlord applicant pipelines.

---

# 40. Messaging Index

```sql
CREATE INDEX idx_messages_conversation_created
ON messages(conversation_id, created_at);
```

---

# 41. Notification Indexes

```sql
CREATE INDEX idx_notifications_user_created
ON notifications(user_id, created_at DESC);
```

```sql
CREATE INDEX idx_notifications_unread
ON notifications(user_id)
WHERE read_at IS NULL;
```

---

# 42. Search Fields

Important search fields:

```text
listings.status
listings.monthly_rent
listings.available_from
properties.district
properties.locality
properties.bedrooms
properties.bathrooms
properties.property_type
properties.furnished
properties.parking_spaces
```

Do not create excessive indexes prematurely.

Review real query plans once production usage exists.

---

# 43. Foreign Key Delete Strategy

Delete behavior must be deliberate.

Historical marketplace records should normally be preserved.

Do not use broad cascading deletion without reviewing consequences.

---

# 44. Property Deletion

Use:

```text
archived_at
```

instead of hard deletion.

This preserves listing/application history.

---

# 45. Listing Deletion

Listings that have applications should not normally be hard deleted.

Use:

```text
CLOSED
RENTED
```

statuses.

---

# 46. Application Deletion

Submitted applications should not normally be deleted.

Use:

```text
WITHDRAWN
REJECTED
```

for normal workflow outcomes.

Draft applications may eventually support deletion if required.

---

# 47. Message Deletion

If message deletion is introduced, use:

```text
deleted_at
```

rather than immediate hard deletion where history needs preservation.

---

# 48. Timestamps

Use:

```text
TIMESTAMPTZ
```

for all date-time events.

Examples:

* messages
* viewings
* application events
* listing publishing
* audit logs

Avoid timezone-naive timestamps.

---

# 49. Money

Use:

```text
NUMERIC(12,2)
```

for:

* monthly rent
* deposit amount

Do not use floating-point types for money.

V1 assumes:

```text
MUR
```

unless a later product requirement introduces multi-currency.

---

# 50. Updated Timestamps

Tables containing:

```text
updated_at
```

should have that value updated consistently.

Preferred:

A project-wide PostgreSQL trigger approach.

Avoid relying on individual controllers to remember to update timestamps.

---

# 51. Row Level Security

Because Supabase is used, Row Level Security must be reviewed for tables reachable through Supabase APIs.

Enable RLS on exposed application tables.

Default principle:

> Deny unless explicitly permitted.

---

# 52. Supabase Publishable Key

The frontend may use:

```text
SUPABASE_PUBLISHABLE_KEY
```

for approved client-side Supabase functionality.

The publishable key does not itself grant privileged access.

RLS policies determine what authenticated/public users can access through the Data API.

---

# 53. Supabase Secret Key

The backend may use:

```text
SUPABASE_SECRET_KEY
```

for controlled privileged operations.

Important:

The secret key bypasses RLS.

Therefore it must:

* exist only on backend infrastructure
* never be sent to React
* never use a `VITE_*` environment variable
* never be committed
* never be logged

Backend authorization remains mandatory even when privileged access is used.

---

# 54. Legacy Key Compatibility

Older Supabase projects may expose:

```text
anon
service_role
```

New documentation should prefer:

```text
publishable
secret
```

terminology where supported.

If legacy keys must temporarily be used, they must follow equivalent client/server security boundaries.

---

# 55. Primary Data Access Architecture

Core rental workflow should normally use:

```text
React
   ↓
Node API
   ↓
authentication
   ↓
authorization
   ↓
validation
   ↓
business service
   ↓
repository
   ↓
PostgreSQL
```

Do not allow React to directly update sensitive rental workflow states.

---

# 56. Example Tenant Access

Tenant may:

```text
READ own tenant profile
UPDATE own tenant profile
CREATE own application
READ own applications
WITHDRAW own eligible application
READ own notifications
READ conversations they participate in
```

Tenant may not:

```text
READ arbitrary tenant applications
CHANGE application to ACCEPTED
CREATE landlord properties
CHANGE verification status
```

---

# 57. Example Landlord Access

Landlord may:

```text
CREATE own property
READ own property-management data
UPDATE own property
CREATE listing for own property
READ applications to own listings
PERFORM permitted application transitions
```

Landlord may not:

```text
READ private applications to another landlord's listing
UPDATE another landlord's property
SELF-VERIFY property
CHANGE tenant identity data
```

---

# 58. Conversation Security

Only conversation participants may:

```text
READ conversation
READ messages
SEND message
UPDATE own read state
```

Guessing another UUID must never provide access.

---

# 59. Admin Security

Admin permissions must still be enforced server-side.

React displaying an admin page does not constitute authorization.

Administrative actions should be audited.

---

# 60. Data Minimization

Do not add database fields simply because they may be useful someday.

Each personal-data field should support a current feature.

If V1 does not need something, do not collect it.

---

# 61. Sensitive Data Excluded From V1

Do not create V1 storage for:

```text
bank statements
passport scans
national ID scans
payslips
bank account numbers
credit reports
background checks
```

Future sensitive verification requires separate design review.

---

# 62. Database Transactions

Use transactions when multiple changes must succeed together.

Examples:

```text
application status
+
application status history
```

and:

```text
accept application
+
mark listing RENTED
+
record status history
+
process other active applications
```

---

# 63. One Accepted Applicant Per Listing

Database-level guarantee:

```sql
CREATE UNIQUE INDEX one_accepted_application_per_listing
ON applications(listing_id)
WHERE status = 'ACCEPTED';
```

This prevents accidental double acceptance.

---

# 64. Accepting an Applicant

Recommended V1 transaction:

```text
Application
VIEWING_COMPLETED → ACCEPTED

Listing
ACTIVE → RENTED
```

Then handle other active applications according to product rules.

The operation must be performed atomically.

---

# 65. Acceptance Workflow

Application service should:

1. authenticate user
2. require LANDLORD
3. resolve application
4. resolve listing
5. verify listing ownership
6. validate current application status
7. ensure no accepted application already exists
8. set application ACCEPTED
9. set listing RENTED
10. create status history
11. process other active applications
12. create notifications
13. commit transaction

---

# 66. Remaining Applications

When listing becomes:

```text
RENTED
```

other non-final applications should be moved to:

```text
REJECTED
```

with an internal reason such as:

```text
LISTING_RENTED
```

if the product uses this V1 approach.

Do not delete them.

---

# 67. Seed Data

Development seed should include:

```text
1 landlord
2 tenants
1 admin

multiple properties

ACTIVE listing
CLOSED listing

DRAFT application
SUBMITTED application
SHORTLISTED application

viewing

conversation
messages
notifications
```

This allows realistic Codex testing.

---

# 68. Migration Rules

Every schema change requires a migration.

Codex must:

* create migration
* commit migration
* never silently alter production schema
* update DATABASE.md when architecture materially changes

Example:

```text
001_create_profiles.sql
002_create_properties.sql
003_create_listings.sql
004_create_applications.sql
```

Actual filenames may follow Supabase CLI timestamp conventions.

---

# 69. Naming Rules

Database naming:

```text
snake_case
```

Examples:

```text
landlord_profiles
property_images
created_at
```

Tables should generally use plural names.

---

# 70. Nullability

Do not make columns nullable without reason.

Ask:

> Can a valid record exist without this field?

If not:

```text
NOT NULL
```

Examples:

```text
listing.property_id
application.tenant_id
message.content
```

must not be nullable.

---

# 71. Validation Layers

Use both database constraints and application validation.

Database protects:

* foreign keys
* uniqueness
* non-negative values
* accepted-application uniqueness
* structural integrity

Backend protects:

* ownership
* user roles
* valid state transitions
* question-edit rules
* workflow behavior

Neither layer replaces the other.

---

# 72. V1 Tables

```text
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
```

---

# 73. Explicitly Excluded Database Domains

Do not create V1 tables for:

```text
payments
transactions
escrow
commissions
invoices
leases
digital_signatures
credit_scores
background_checks
insurance
property_management
tenant_ai_scores
```

These are outside approved scope.

---

# 74. Final Database Principle

The schema represents:

```text
Physical property
        ↓
Rental listing
        ↓
Tenant application
        ↓
Application workflow
        ↓
Viewing
        ↓
Rental outcome
```

while preserving:

* ownership
* history
* security
* auditability
* clear relational integrity

Codex must not invent new core database entities without first checking:

```text
PRODUCT_SPEC.md
ARCHITECTURE.md
DATABASE.md
API_SPEC.md
SECURITY.md
```

and documenting any proposed architectural change.
