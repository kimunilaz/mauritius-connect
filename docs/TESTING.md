# Mauritius Rental Platform — Testing Strategy

## 1. Purpose

This document defines the testing requirements for the Mauritius Rental Platform.

Testing is part of implementation, not a final cleanup step.

Every major feature should be tested at the level appropriate to its behavior.

The primary goals are:

* verify business logic
* verify authorization
* verify ownership boundaries
* verify database integrity
* verify workflow states
* prevent regressions
* verify end-to-end rental flows
* ensure Codex does not consider incomplete functionality finished

---

# 2. Testing Layers

Use four primary testing layers:

```text
Unit Tests
Integration Tests
Security/Authorization Tests
End-to-End Tests
```

Each layer answers a different question.

---

# 3. Unit Tests

Unit tests verify isolated logic.

Examples:

* validators
* application state transitions
* listing state transitions
* viewing state transitions
* helper functions
* serializers
* filtering logic
* utility functions

Unit tests should not depend on real external services unless absolutely necessary.

---

# 4. Integration Tests

Integration tests verify multiple system layers working together.

Examples:

```text
API route
→ middleware
→ controller
→ service
→ repository
→ test database
```

Integration tests should cover:

* authentication
* authorization
* validation
* ownership
* database writes
* database reads
* conflict handling
* status transitions
* transactions

---

# 5. Security Tests

Security tests explicitly try to violate access boundaries.

Examples:

```text
Tenant A reads Tenant B application
Landlord A edits Landlord B property
Tenant tries to create landlord property
Tenant tries to set role ADMIN
Landlord tries to self-verify
Non-participant tries to read conversation
```

These must fail.

Security tests are mandatory for protected resources.

---

# 6. End-to-End Tests

End-to-end tests verify a full real-user journey.

Primary E2E journey:

```text
Landlord registers
↓
Creates landlord profile
↓
Creates property
↓
Uploads images
↓
Creates listing
↓
Publishes listing

Tenant registers
↓
Creates tenant profile
↓
Searches listing
↓
Saves listing
↓
Creates application
↓
Answers landlord questions
↓
Submits application

Landlord
↓
Receives application
↓
Moves application UNDER_REVIEW
↓
Shortlists applicant
↓
Proposes viewing

Tenant
↓
Confirms viewing

Landlord
↓
Marks viewing COMPLETED
↓
Accepts application

System
↓
Application = ACCEPTED
Listing = RENTED
Other open applications handled correctly
```

This is the most important full-system test.

---

# 7. Recommended Test Structure

Backend:

```text
backend/
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── security/
│   ├── fixtures/
│   ├── helpers/
│   └── setup/
```

Frontend:

```text
frontend/
├── src/
│   └── ...
├── tests/
│   ├── components/
│   ├── pages/
│   ├── integration/
│   └── helpers/
```

End-to-end:

```text
e2e/
├── auth/
├── landlord/
├── tenant/
├── applications/
├── messaging/
└── core-rental-flow/
```

Exact folder names may vary slightly if the chosen testing framework has conventions.

---

# 8. Test Environment

Never run destructive tests against production.

Use:

```text
development
test
staging
production
```

where practical.

Automated tests should use a dedicated test database/environment.

---

# 9. Test Data Isolation

Tests must not depend on manually created development data.

Each test or test suite should create the data it needs.

Tests should be repeatable.

Avoid:

```text
"Assume landlord with ID xyz already exists."
```

Instead create fixtures programmatically.

---

# 10. Core Test Users

Use reusable fixtures for:

```text
Tenant A
Tenant B

Landlord A
Landlord B

Admin A
```

This is important for ownership testing.

---

# 11. Authentication Tests

Test:

```text
valid authenticated request
missing token
invalid token
expired/invalid session
unknown user profile
suspended user
```

Expected examples:

```text
missing token → 401

invalid token → 401

wrong role → 403

suspended account → blocked
```

---

# 12. Registration/Profile Tests

Test public user creation rules.

Valid:

```text
TENANT
LANDLORD
```

Invalid:

```text
ADMIN
```

Test:

```text
user cannot self-register ADMIN
user cannot update own role
user cannot update verification status
```

---

# 13. Tenant Profile Tests

Test:

```text
tenant reads own profile
tenant updates own profile
tenant cannot read unrelated private tenant profile
landlord cannot update tenant profile
```

Validation:

```text
number_of_occupants >= 1
preferred_lease_duration_months > 0
```

---

# 14. Landlord Profile Tests

Test:

```text
landlord reads own profile
landlord updates permitted fields
landlord cannot change verification_status
tenant cannot access landlord management endpoint
```

---

# 15. Property Creation Tests

Happy path:

```text
authenticated landlord
valid property input
→ 201
```

Mandatory failures:

```text
unauthenticated user → 401

tenant → 403

invalid bedrooms → validation failure

invalid bathrooms → validation failure

negative parking → validation failure
```

---

# 16. Property Ownership Tests

Create:

```text
Landlord A
Landlord B
Property owned by Landlord B
```

Attempt:

```text
Landlord A updates Landlord B property
```

Expected:

```text
denied
```

Repeat for:

* read
* update
* archive
* image upload
* image delete

---

# 17. Property Archive Tests

Test:

```text
landlord archives own property
archived_at populated
property remains in historical database
```

If active listing exists:

```text
archive rejected
```

unless product rules explicitly close listing first.

---

# 18. Property Image Tests

Test:

```text
valid JPEG upload
valid PNG upload
valid WebP upload
```

Reject:

```text
unauthenticated upload
tenant upload
wrong landlord
SVG
HTML
JavaScript file
oversized image
non-image pretending to be image
too many images
```

---

# 19. Property Cover Image Tests

Test:

```text
first cover image set
second image made cover
previous cover automatically/unambiguously removed
```

Database must never allow:

```text
two cover images for same property
```

---

# 20. Listing Creation Tests

Happy path:

```text
landlord creates listing for own property
→ DRAFT
```

Reject:

```text
tenant creates listing
landlord creates listing for another landlord property
negative rent
negative deposit
invalid lease duration
invalid occupancy
```

---

# 21. Live Listing Uniqueness

Create:

```text
ACTIVE listing for Property A
```

Attempt second:

```text
ACTIVE/PENDING_REVIEW/PAUSED listing for same property
```

Expected:

```text
conflict
```

Historical:

```text
RENTED
CLOSED
```

listing should not prevent a future rental cycle.

---

# 22. Listing State Tests

Test approved transitions:

```text
DRAFT → PENDING_REVIEW
PENDING_REVIEW → ACTIVE
ACTIVE → PAUSED
PAUSED → ACTIVE
ACTIVE → CLOSED
ACTIVE → RENTED
```

Test invalid transitions:

```text
CLOSED → ACTIVE
RENTED → DRAFT
DRAFT → RENTED
```

unless later product rules explicitly allow them.

---

# 23. Public Listing Tests

Anonymous user may:

```text
GET active listings
GET active listing details
```

Anonymous user must not receive:

```text
exact private address
private landlord phone
tenant data
admin notes
verification evidence
```

Inactive listings should not appear publicly.

---

# 24. Search Tests

Test filters independently and in combination.

Examples:

```text
locality
district
min_rent
max_rent
bedrooms
bathrooms
property_type
furnished
available_from
pets_allowed
parking
```

Test:

```text
Moka + max 20000 + 2 bedrooms
```

and confirm only matching records return.

---

# 25. Search Sorting Tests

Allowed:

```text
NEWEST
RENT_LOW_TO_HIGH
RENT_HIGH_TO_LOW
AVAILABLE_SOONEST
```

Invalid sort values must be rejected or safely defaulted.

Do not permit arbitrary database column names.

---

# 26. Search Pagination Tests

Test:

```text
default page = 1
default limit = 20
maximum limit = 100
```

Reject or cap:

```text
limit=1000000
```

Ensure metadata is correct.

---

# 27. Saved Listing Tests

Test:

```text
tenant saves active listing
tenant retrieves saved listings
tenant removes saved listing
```

Duplicate save should be idempotent or return expected conflict according to API contract.

Tenant A must not modify Tenant B saved listings.

---

# 28. Application Question Tests

Landlord may create questions only for own listing.

Test types:

```text
TEXT
NUMBER
BOOLEAN
DATE
SELECT
```

For SELECT:

Test valid options.

Test landlord cannot modify another landlord's questions.

---

# 29. Locked Question Tests

Once listing has a:

```text
SUBMITTED
```

application:

Test destructive edit attempt.

Expected:

```text
APPLICATION_QUESTION_LOCKED
```

Test delete attempt.

Expected:

```text
blocked
```

---

# 30. Draft Application Tests

Tenant may create draft application only for:

```text
ACTIVE listing
```

Test:

```text
tenant creates draft
tenant updates draft
tenant answers questions
```

Reject:

```text
landlord applying
application to inactive listing
duplicate application
tenant modifying another tenant draft
```

---

# 31. Application Submission Tests

Submission should verify:

* application belongs to tenant
* listing still ACTIVE
* application status DRAFT
* required standard fields complete
* required custom questions answered
* answer types valid

After success:

```text
status = SUBMITTED
submitted_at != null
status history created
landlord notification created
```

---

# 32. Application Uniqueness Tests

Same tenant + same listing:

```text
first application → allowed
second application → rejected
```

Database uniqueness and service behavior should agree.

---

# 33. Application Ownership Tests

Create:

```text
Tenant A application
Tenant B application
```

Attempt:

```text
Tenant A reads Tenant B application
Tenant A updates Tenant B application
Tenant A withdraws Tenant B application
```

Expected:

```text
denied
```

---

# 34. Landlord Application Visibility Tests

Landlord A may retrieve applications only for listings owned by Landlord A.

Landlord A must not retrieve:

```text
applications for Landlord B listings
```

even when filtering by guessed listing/application UUID.

---

# 35. Application Transition Tests

Test valid transitions:

```text
SUBMITTED → UNDER_REVIEW
SUBMITTED → REJECTED

UNDER_REVIEW → SHORTLISTED
UNDER_REVIEW → REJECTED

SHORTLISTED → VIEWING_INVITED
SHORTLISTED → REJECTED

VIEWING_INVITED → VIEWING_COMPLETED

VIEWING_COMPLETED → ACCEPTED
VIEWING_COMPLETED → REJECTED
```

---

# 36. Invalid Application Transition Tests

Reject examples:

```text
SUBMITTED → ACCEPTED
REJECTED → SHORTLISTED
ACCEPTED → UNDER_REVIEW
WITHDRAWN → ACCEPTED
DRAFT → SHORTLISTED
```

---

# 37. Application Actor Tests

Tenant controls:

```text
DRAFT
SUBMITTED through submit action
WITHDRAWN through withdraw action
```

Landlord controls approved review progress.

Tenant must not directly set:

```text
SHORTLISTED
ACCEPTED
REJECTED
```

Landlord must not set:

```text
WITHDRAWN
```

as though they were the tenant.

---

# 38. Application Status History Tests

Each valid status transition should create exactly one history row.

Verify:

```text
from_status
to_status
changed_by_user_id
created_at
```

Invalid transitions should create no history row.

---

# 39. Viewing Creation Tests

Landlord may propose viewing only for application belonging to own listing.

Test:

```text
valid start_time
end_time > start_time
```

Reject:

```text
wrong landlord
invalid application state
end before start
```

---

# 40. Viewing Confirmation Tests

Only associated tenant may confirm.

Test:

```text
PROPOSED → CONFIRMED
```

Reject:

```text
Tenant B confirms Tenant A viewing
landlord confirms on tenant's behalf
```

unless product rules later explicitly allow landlord confirmation.

---

# 41. Viewing Decline Tests

Tenant may:

```text
PROPOSED → DECLINED
```

Application should not automatically become REJECTED.

Test that landlord may propose another viewing afterward if workflow allows.

---

# 42. Viewing Completion Tests

Landlord may mark:

```text
CONFIRMED → COMPLETED
```

Then application should transition:

```text
VIEWING_INVITED → VIEWING_COMPLETED
```

according to service rules.

---

# 43. Viewing No-Show Tests

Landlord may mark relevant confirmed viewing:

```text
NO_SHOW
```

after appropriate conditions.

No-show must not automatically accept or reject tenant.

---

# 44. Multiple Viewing Tests

Test one application with:

```text
Viewing 1 DECLINED
Viewing 2 CONFIRMED
Viewing 3 COMPLETED
```

System must support multiple viewing records.

---

# 45. Application Acceptance Tests

Acceptance is a special transactional operation.

Before:

```text
Application = VIEWING_COMPLETED
Listing = ACTIVE
```

After:

```text
Application = ACCEPTED
Listing = RENTED
```

Also verify:

```text
status history created
tenant notified
other active applications handled
```

---

# 46. One Accepted Applicant Test

Create:

```text
Application A
Application B
```

for same listing.

Accept A.

Attempt to accept B.

Expected:

```text
rejected
```

Database must preserve:

```text
exactly one ACCEPTED application
```

---

# 47. Concurrent Acceptance Test

Simulate two acceptance requests at nearly the same time.

Expected:

```text
one succeeds
one fails
```

Final database state:

```text
one ACCEPTED application
one RENTED listing
```

Never two accepted tenants.

---

# 48. Acceptance Transaction Rollback Test

Simulate failure during acceptance workflow.

Example:

```text
application updated
then listing update fails
```

Expected:

```text
entire transaction rolled back
```

Database must not remain:

```text
application ACCEPTED
listing ACTIVE
```

---

# 49. Conversation Creation Tests

Tenant may create/get conversation for active listing according to product rules.

Test idempotency:

```text
first request → conversation created
second request → same conversation returned
```

Do not create duplicates.

---

# 50. Conversation Authorization Tests

Create conversation:

```text
Tenant A
Landlord A
```

Test:

```text
Tenant A reads → allowed
Landlord A reads → allowed
Tenant B reads → denied
Landlord B reads → denied
```

---

# 51. Message Tests

Test:

```text
participant sends valid message
message stored
recipient notification created
```

Reject:

```text
non-participant
empty message
oversized message
```

---

# 52. Message XSS Test

Send content such as:

```html
<script>alert('x')</script>
```

Frontend must display it as plain text.

It must not execute.

---

# 53. Conversation Read Tests

Test:

```text
user marks conversation read
last_read_at updated for that participant
```

Other participant's read state must remain unchanged.

---

# 54. Notification Tests

Test creation for:

```text
application submitted
application shortlisted
application rejected
application accepted
viewing proposed
viewing confirmed
new message
```

Test:

```text
user sees own notifications only
mark one read
mark all read
```

---

# 55. Report Tests

Test:

```text
report listing
report user
```

Reject:

```text
report with no target
invalid reason
oversized description
```

User should not be able to resolve their own report as admin.

---

# 56. Admin Authorization Tests

Tenant:

```text
GET /admin/users → denied
```

Landlord:

```text
GET /admin/reports → denied
```

Admin:

```text
allowed
```

Do not rely on frontend admin route protection.

---

# 57. Admin Audit Tests

Actions such as:

```text
USER_SUSPENDED
LISTING_REMOVED
REPORT_RESOLVED
VERIFICATION_APPROVED
```

must create audit records.

Verify:

```text
admin_user_id
action
target
timestamp
```

---

# 58. Verification Tests

Ordinary user must not directly set:

```text
VERIFIED
```

Test:

```text
landlord self-verification attempt → denied
tenant self-verification attempt → denied
```

Admin workflow may approve according to permission rules.

---

# 59. RLS Tests

Where Supabase RLS applies, test policies with separate authenticated identities.

Examples:

```text
Tenant A cannot SELECT Tenant B private application

Landlord A cannot SELECT Landlord B management records

non-participant cannot SELECT conversation/messages

user cannot UPDATE own role to ADMIN
```

RLS tests should complement API tests.

---

# 60. Mass Assignment Tests

Send protected fields deliberately.

Examples:

```json
{
  "role": "ADMIN"
}
```

```json
{
  "verification_status": "VERIFIED"
}
```

```json
{
  "landlord_id": "another-user"
}
```

```json
{
  "status": "ACCEPTED"
}
```

Expected:

```text
rejected or safely ignored according to contract
```

Never silently privilege-escalate.

---

# 61. Exact Address Exposure Test

Public listing API must not return:

```text
address_line_1
address_line_2
```

unless explicitly approved later.

Test response serialization directly.

---

# 62. Sensitive Data Exposure Test

Anonymous/public API must not return:

```text
tenant profile private data
application answers
private conversations
admin notes
verification evidence
Supabase secrets
```

---

# 63. Error Response Tests

Production-style errors must not include:

```text
stack traces
SQL
database credentials
filesystem paths
environment variables
```

Test unexpected errors produce safe response format.

---

# 64. Rate Limit Tests

Where rate limiting exists, verify:

```text
normal usage allowed
excessive abuse rejected
```

Important targets:

* messages
* reports
* uploads
* application submissions
* conversation creation

---

# 65. Request Size Tests

Test oversized:

```text
JSON body
listing description
message
report description
application answer
```

Expected:

```text
safe rejection
```

---

# 66. Database Constraint Tests

Explicitly verify:

```text
one live listing per property
one cover image per property
one application per tenant/listing
one accepted application per listing
non-negative rent
valid occupant count
```

Do not rely only on service tests.

---

# 67. Timestamp Tests

Verify timestamps are stored with timezone awareness where required.

Examples:

```text
submitted_at
start_time
created_at
published_at
```

Frontend should render viewing times correctly for the expected local context.

---

# 68. Soft Delete / Archive Tests

Verify:

```text
archived property remains historically referenced
closed listing remains in database
withdrawn application remains available in history
deleted message behavior follows deleted_at rules
```

---

# 69. Frontend Component Tests

Test important interactive components such as:

```text
SearchFilters
PropertyCard
ApplicationForm
ApplicationStatusBadge
ViewingCard
MessageThread
```

Focus on behavior rather than implementation details.

---

# 70. Frontend Form Tests

Test:

```text
required field messages
invalid number handling
date validation
submit disabled where appropriate
server validation displayed clearly
```

Do not assume frontend validation guarantees backend validity.

---

# 71. Frontend Role Routing Tests

Test:

```text
tenant cannot navigate to landlord management screen
landlord cannot access tenant-specific management route where inappropriate
ordinary user cannot access admin UI
```

Remember:

Frontend route tests are UX protection.

Backend remains authoritative security.

---

# 72. Mobile Tests

Primary workflows must be tested at mobile viewport sizes.

At minimum:

```text
registration
login
search
property page
application form
landlord applicant review
viewing confirmation
messaging
```

No essential action should require desktop width.

---

# 73. Accessibility Tests

At minimum verify:

* inputs have labels
* buttons have meaningful names
* forms can be navigated by keyboard
* errors are associated with fields
* images have appropriate alt text
* focus states remain visible
* status is not communicated by color alone

---

# 74. Browser Coverage

During V1, test at minimum current supported versions of:

```text
Chrome
Edge
Firefox
Safari
```

Mobile testing should include at least one Chromium-based mobile browser and Safari/iOS when available.

---

# 75. Performance Smoke Tests

Before public launch, verify:

```text
listing search returns promptly
property page does not load unnecessarily huge images
application dashboard pagination works
message history does not fetch unlimited messages
```

Do not optimize based solely on hypothetical scale.

---

# 76. Regression Tests

When a bug is fixed:

1. reproduce bug
2. add regression test where practical
3. fix bug
4. verify regression test passes
5. run related test suite

A bug should not be allowed to return silently.

---

# 77. Test Naming

Test names should describe behavior.

Good:

```text
rejects tenant attempting to create property
```

```text
prevents second accepted application for same listing
```

Bad:

```text
test 1
```

```text
works
```

---

# 78. Deterministic Tests

Avoid tests depending unnecessarily on:

* real clock time
* random order
* network services
* production accounts

Mock/fix time where business rules require controlled dates.

---

# 79. External Service Mocking

Tests should avoid sending:

* real emails
* real SMS
* real production notifications

Use mocks/stubs in automated test environments.

Supabase development/test infrastructure should be isolated from production.

---

# 80. Test Cleanup

Tests should clean up their own state or operate within resettable isolated environments.

One test must not cause another test to pass or fail.

---

# 81. CI Test Groups

Recommended CI order:

```text
1. lint
2. unit tests
3. integration tests
4. frontend build
5. backend checks
6. security tests
7. E2E tests where environment supports them
```

Fast failures should occur early.

---

# 82. Pull Request Requirements

A feature should not be merged if:

```text
relevant tests fail
build fails
lint fails
mandatory authorization test is missing
database migration fails
```

---

# 83. Codex Test Requirement

When Codex implements a feature, it must:

1. identify required tests
2. add tests with implementation
3. run relevant tests
4. report exact test results
5. report any test it could not run

Codex must not simply say:

```text
Tests should pass.
```

It must actually run them where the environment permits.

---

# 84. Codex Completion Report

Codex should report:

```text
Tests added:
Tests run:
Tests passed:
Tests failed:
Tests skipped:
Reason for skipped tests:
```

If no tests were added, Codex should explain why the task did not require them.

---

# 85. Minimum Test Coverage Philosophy

Do not chase arbitrary percentage coverage solely for appearance.

Prioritize coverage of:

* authorization
* ownership
* workflow states
* transactions
* important validation
* public/private data boundaries
* critical user flows

A high coverage percentage with weak security tests is not acceptable.

---

# 86. Critical Test Suite

The following tests are considered release-critical:

```text
authentication
role authorization
property ownership
listing ownership
application ownership
conversation authorization
application state transitions
one accepted applicant
acceptance transaction
file upload restrictions
public data serialization
admin access
full rental E2E journey
```

---

# 87. Private Beta Gate

Before private beta:

* authentication tests pass
* ownership tests pass
* application flow works
* viewing flow works
* public data exposure tests pass
* image upload restrictions work
* end-to-end rental flow passes
* major mobile workflows work

Messaging/admin functionality may still have minor non-blocking issues if explicitly documented.

---

# 88. Public Launch Gate

Before public launch:

* all private beta gates pass
* security test suite passes
* RLS reviewed and tested
* admin authorization passes
* reporting works
* production build passes
* backup/recovery process verified
* rate limits configured
* dependency review completed
* end-to-end rental workflow passes in production-like environment

---

# 89. Testing Non-Goals

Do not introduce unnecessary testing complexity such as:

* huge synthetic load systems before traffic exists
* enterprise chaos engineering
* production fault injection
* large distributed testing infrastructure

Introduce advanced testing only when actual scale requires it.

---

# 90. Final Testing Principle

The most important question is not:

> Does the UI appear to work?

It is:

> Can the system preserve correct ownership, security, state, and data integrity even when users intentionally send invalid or malicious requests?

The platform is considered reliable only when both normal behavior and failure behavior are tested.

---

# 91. TASK-025 Playwright E2E and Hosted QA

The deterministic browser suite lives in `e2e/prototype.spec.js` and runs with
Playwright Chromium. It starts an owned backend on port 3100 and frontend on
port 5174, uses one serial worker, and does not reuse unrelated development
servers.

The runner loads ignored local configuration from `backend/.env` and
`.env.integration`. It requires `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and
`SUPABASE_SECRET_KEY`; values must never be printed, copied into reports, or
committed. No pre-existing user passwords or fixed database identifiers are
required.

For each run, the suite creates random `task025-` Auth identities for Tenant A,
Tenant B, a tenant retaining a DRAFT application, Landlord A, Landlord B, and an
ADMIN. It creates the rental data through browser/API workflows, discovers only
its own namespace during teardown, deletes only its own records and private
storage objects, and removes its temporary Auth identities. It never resets or
assumes an empty hosted database.

Run the browser suite from the repository root:

```bash
npm run test:e2e
npm run test:e2e:report
```

The lifecycle covers property and listing creation, image upload, application
questions, ADMIN approval, public search/address privacy, saved listings,
reports, conversations, messages, notifications, three tenant applications,
DRAFT privacy, application review, every supported viewing outcome, acceptance,
RENTED privacy, competing rejection, verification evidence/review, account
suspension/reactivation, cross-role denial, responsive layouts, accessibility
basics, and loading/error/empty states.

The suite deliberately uses normal API authentication, authorization, CORS,
rate limiting, database transactions, private storage, and deny-by-default RLS.
Do not weaken or globally disable those controls for a test run. Normal E2E
traffic is kept below abuse thresholds.

Hosted regression also includes the feature-specific `*:verify:hosted` scripts
listed in `package.json`, followed by:

```bash
npm run supabase:migrations:sync
npm run db:verify:hosted
npm run db:verify
```

Before applying any pending forward migration to a shared development project,
inspect the migration ledger and obtain the required environment authorization.
Never use a hosted database reset.

On failure, inspect the Playwright screenshot, video, trace, and
`error-context.md` under ignored `test-results/`; open the HTML report with
`npm run test:e2e:report`. Reproduce product defects with a regression assertion,
fix them without expanding the frozen feature set, rerun the affected case, and
then rerun the full serial suite. Expected negative-test 401/403/404 responses
are acceptable; page exceptions, unexpected failed requests, explicit console
errors, CORS failures, and local 5xx responses are not.
