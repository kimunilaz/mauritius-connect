# TASK-009 — Application Questions Completion Report

## Summary

Implemented landlord-defined application questions for owned rental listings.
The foundation supports question CRUD, all five approved types, ordered SELECT
options, deterministic presentation, ACTIVE-only public reads, terminal listing
read-only behavior, and complete question-set locking after the first submitted
application.

The implementation reuses the verified Supabase identity, ACTIVE-account and
LANDLORD authorization middleware, existing listing ownership service, public
listing eligibility service, explicit serializers, centralized frontend API
client, private backend database access, and deny-by-default RLS posture.

No application creation, answers, submission workflow, applicant dashboard,
scoring, ranking, messaging, or TASK-010 functionality was implemented.

## API

Implemented all five required endpoints:

- `GET /api/v1/landlord/listings/:listingId/application-questions`
- `POST /api/v1/listings/:listingId/application-questions`
- `PATCH /api/v1/listings/:listingId/application-questions/:questionId`
- `DELETE /api/v1/listings/:listingId/application-questions/:questionId`
- `GET /api/v1/listings/:listingId/application-questions`

The landlord GET returns questions plus `locked`, `editable`, and
`listing_status` metadata. POST returns `201`, PATCH returns `200`, and DELETE
returns `204`. The anonymous public endpoint returns only explicitly serialized
question presentation data.

Management endpoints require a verified access token, existing ACTIVE
application profile, LANDLORD role, and backend-confirmed listing ownership.
Strict request schemas reject unknown and protected fields, invalid UUIDs,
unapproved types, invalid ordering, and invalid options.

## Question Types

Supported types are exactly:

- `TEXT`
- `NUMBER`
- `BOOLEAN`
- `DATE`
- `SELECT`

Question text is required, trimmed, and limited to 500 characters.
`is_required` must be boolean, and `display_order` must be an integer of zero or
greater. No scoring or ranking type was introduced.

## SELECT Options

SELECT questions require at least one option. Each option requires trimmed,
non-empty text of at most 200 characters and an integer display order of zero
or greater. Non-SELECT questions reject non-empty option payloads and always
serialize `options: []`.

Changing SELECT to another type deletes obsolete options. Changing a
non-SELECT question to SELECT requires valid replacement options. Replacing a
SELECT option set removes the old set and persists the complete validated new
set.

Question and option multi-write operations use controlled compensation:

- failed option creation removes the newly created question;
- failed option replacement restores the original question fields and options;
- question deletion relies on the existing option cascade only for the selected
  question.

Automated failure-injection tests prove that partial SELECT structures are not
left behind.

Questions are ordered by `display_order`, `created_at`, and `id`. Options are
ordered by `display_order` and `id`.

## Ownership

The backend derives the authenticated user from the verified Supabase bearer
token and resolves the authoritative LANDLORD application/role profile. It then
uses the existing listing service's owner-scoped lookup. URL listing IDs are
validated but never treated as ownership proof.

Cross-landlord listing access returns privacy-preserving
`404 LISTING_NOT_FOUND`. A guessed question ID is scoped to the already-owned
listing and returns `404 APPLICATION_QUESTION_NOT_FOUND` when it does not belong
there. Request bodies cannot override `listing_id`, question identity,
timestamps, ownership, or other protected fields. TENANT, SUSPENDED, and
DELETED actors are rejected before mutation.

Question mutations are allowed only for `DRAFT`, `PENDING_REVIEW`, `ACTIVE`,
and `PAUSED` listings. `RENTED` and `CLOSED` questions remain readable by their
owner but are not mutable and return `409 LISTING_NOT_EDITABLE`.

## Submitted-Application Lock

The repository checks for any application on the listing where
`submitted_at IS NOT NULL`. Once found, the service returns
`409 APPLICATION_QUESTIONS_LOCKED` before any structural write.

After the first submitted application, the following are all blocked:

- CREATE questions;
- PATCH question text;
- PATCH question type;
- PATCH required state;
- PATCH options;
- PATCH question or option ordering;
- DELETE questions.

The complete question set is read-only regardless of later application status.
A trusted DRAFT application fixture with `submitted_at IS NULL` does not trigger
the lock; create, update, ordering, and delete continue to work until actual
submission.

## Public Visibility

The public read route is anonymous but first uses the existing public listing
eligibility boundary. Questions are returned only for an `ACTIVE` listing on a
non-archived property. DRAFT, PENDING_REVIEW, PAUSED, RENTED, CLOSED,
archived-property, and unknown listings all return the same
`404 LISTING_NOT_FOUND` response.

The explicit public serializer exposes only:

- question `id`, `question_text`, `question_type`, `is_required`,
  `display_order`, and `options`;
- option `id`, `option_text`, and `display_order`.

It does not expose listing/property ownership, landlord details, application
records, timestamps, moderation data, addresses, or other private fields.

## Frontend

The existing landlord listing detail page now contains an Application questions
manager with:

- loading, safe error/retry, and empty states;
- ordered question cards;
- Add, Edit, and confirmed Delete actions;
- question text, type, required state, and numeric order controls;
- accessible SELECT option add/remove, text, and ordering controls;
- client and server validation feedback;
- responsive mobile layout and visible keyboard focus behavior;
- submitted-application lock messaging with all mutations hidden;
- terminal listing read-only messaging.

The public listing detail page includes a read-only Application questions
section only when questions exist. It displays types, required/optional state,
and SELECT options. It contains no Apply action, answer inputs, submission
button, or applicant workflow.

## Database Changes

None. No migration, table, constraint, index, trigger, or RLS policy was added
or edited. The existing `application_questions`,
`application_question_options`, and `applications.submitted_at` contract was
sufficient. The existing question-option cascade remains unchanged.

## Dependencies Added

None. Existing React, Express, Zod, Supabase, fetch, and testing infrastructure
were reused.

## Hosted Supabase Verification

Real TASK-009 verification passed 9/9 hosted integration groups using isolated
trusted fixtures:

- owned landlord question creation;
- real SELECT option persistence and deterministic serialization;
- ordered landlord read and allowlisted update;
- second-landlord and TENANT mutation rejection;
- ACTIVE anonymous privacy-safe read;
- non-public listing hiding;
- DRAFT application fixture does not lock mutations;
- submitted application fixture locks create, patch, option/order changes, and
  delete;
- publishable-key reads and writes remain blocked by RLS.

The verifier creates a temporary controlled second landlord only through
trusted setup infrastructure. It removes the application fixture, questions,
options, listings, properties, application profile, role profile, and temporary
auth identity during cleanup. No developer marketplace data is changed.

All hosted regressions passed 83/83 checks:

- database catalog: 9/9;
- authentication: 10/10;
- tenant/landlord profiles: 7/7;
- properties: 8/8;
- property images/private Storage: 11/11;
- landlord listings: 10/10;
- public search/privacy: 9/9;
- saved listings: 10/10;
- application questions: 9/9.

## Tests

Tests added: 56 TASK-009-focused tests (44 backend integration/security tests
and 12 frontend component/integration tests).

Tests run: 446 application tests, static database verification, 15 embedded
PostgreSQL runtime checks, and 83 real hosted Supabase checks.

Tests passed: all 85 frontend tests, all 361 backend tests, all static database
checks, all 15 embedded database checks, and all 83 hosted checks.

Tests failed: 0 in the final verification run.

Tests skipped: 0.

Important coverage includes all types, validation limits, strict objects,
protected fields, SELECT creation and type changes, failure compensation,
deterministic ordering, partial update, deletion scope, authentication, role and
account status, cross-landlord access, guessed IDs, terminal listing states,
every locked mutation category, DRAFT non-locking, all public listing statuses,
archived properties, public serialization, landlord UX, SELECT option UX,
locked UX, wrong-role routing, and the absence of an application form.

## Root Verification

- `npm run lint` — PASS.
- `npm run test` — PASS (85 frontend, 361 backend, static database verification,
  and 15 embedded PostgreSQL checks).
- `npm run build` — PASS. Vite emitted only its advisory chunk-size warning.
- `npm run format:check` — PASS.
- `git diff --check` — PASS (exit 0; only Windows line-ending notices).

## Security

- RLS remains enabled and unchanged with no application-table policies.
- Direct browser reads and writes to question and option tables remain blocked.
- Listing ownership is enforced from the verified LANDLORD identity.
- ACTIVE-account and role checks run on every management endpoint.
- Public eligibility is ACTIVE/non-archived and returns privacy-preserving 404s.
- Public serializers expose only allowlisted question and option fields.
- Submitted application history makes the complete question structure
  immutable.
- No tenant scoring, ranking, answer, or evaluation fields were introduced.
- No credentials, tokens, environment values, or secrets were printed, copied,
  committed, or included in this report.

## Known Limitations

- Application creation is deferred to TASK-010.
- Application answers are deferred.
- Application submission is deferred.
- The applicant workflow and dashboards are deferred.
- Ordering uses accessible numeric controls rather than drag-and-drop.

## Recommended Next Task

TASK-010 — Rental Application Drafts.
