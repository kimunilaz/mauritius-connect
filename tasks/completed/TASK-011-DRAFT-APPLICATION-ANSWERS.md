# TASK-011 — Draft Application Answers Completion Report

## Summary

Implemented tenant-owned DRAFT application answers on top of the existing
TASK-009 question and TASK-010 draft infrastructure. ACTIVE TENANT users can
load, partially update, and clear answers for their own DRAFT application.
Answer writes are validated against the application's current listing
questions, and the backend remains the sole ownership and mutation authority.

Landlord question changes now safely remove incompatible DRAFT answers while
preserving answers that remain valid. Submitted-application question locking is
unchanged. Application submission and all TASK-012 functionality were not
implemented.

## API

### GET /applications/:id/answers

`GET /api/v1/applications/:applicationId/answers` returns only the authenticated
tenant owner's saved answers, ordered by the current question order. The
explicit serializer exposes `question_id`, `answer_text`, and `updated_at` only.
It does not expose application ownership, database answer IDs, listing data, or
question internals.

An unavailable listing does not destroy its draft answers: the owner may still
retrieve the safe saved-answer representation. Cross-tenant and unknown
application IDs return the same privacy-preserving `404 APPLICATION_NOT_FOUND`.

### PUT /applications/:id/answers

`PUT /api/v1/applications/:applicationId/answers` accepts a strict partial-upsert
payload containing only `answers[].question_id` and `answers[].answer_text`.
The endpoint requires a verified ACTIVE TENANT, derives the tenant profile from
the bearer identity, scopes the application lookup by that tenant, and permits
mutation only while the application is DRAFT with `submitted_at = null` and the
listing remains publicly eligible.

Duplicate question IDs in one request, unknown fields, protected fields, and
questions from another listing are rejected. The existing composite database
key `(application_id, question_id)` remains the concurrency backstop; eight
real concurrent upserts left one answer row.

## Type Validation

- **TEXT:** whitespace is trimmed; non-empty text is limited to 2,000
  characters.
- **NUMBER:** a finite numeric string is required and stored canonically as
  text, for example `01.50` becomes `1.5`.
- **BOOLEAN:** only the exact strings `true` and `false` are accepted.
- **DATE:** a real ISO calendar date in `YYYY-MM-DD` form is required.
- **SELECT:** the answer must exactly match a current option for that exact
  question.

All type validation is authoritative on the backend. The frontend mirrors the
rules for immediate field feedback but is not a security boundary.

## SELECT Validation

SELECT choices are loaded from the current `application_question_options` rows
joined to the question belonging to the application's listing. An answer is
accepted only when its text exactly equals a current `option_text` for that
question; invented choices and choices belonging to another question or
listing fail validation.

The selected option text is stored in the existing `answer_text` column, as
defined by the approved database contract. Removing that text from the current
option set removes the now-incompatible DRAFT answer. Adding or reordering
options preserves an existing answer when its text remains valid.

## Draft Semantics

Required questions may remain unanswered while an application is DRAFT;
submission completeness is intentionally deferred. PUT is a partial upsert, so
only supplied questions are changed. Existing answers may be updated without
affecting omitted answers.

Supplying `null`, an empty string, or whitespace-only text explicitly clears
that question's saved answer. The service compensates the affected subset if a
multi-step write fails, avoiding a silently partial answer update.

Answer mutation returns `409 APPLICATION_NOT_EDITABLE` once an application is
not an unsubmitted DRAFT. If its listing becomes non-public, reads remain safe
and available while writes return `409 LISTING_NOT_AVAILABLE`.

## Question Mutation Interaction

- A **question type change** removes all existing DRAFT answers for that
  question because their prior representation is no longer compatible.
- A **SELECT option-set change** removes only DRAFT answers whose stored text is
  absent from the replacement option set; still-valid choices are preserved.
- A **question deletion** removes dependent DRAFT answers before deleting the
  question, satisfying the existing restrictive foreign key safely.
- **Question text, display order, and required-state-only changes** preserve
  existing DRAFT answers because they do not invalidate the stored value.

Only DRAFT, unsubmitted application answers participate in this cleanup.
TASK-009's `submitted_at IS NOT NULL` lock still runs before every structural
mutation, so submitted questions and answers remain protected.

Real hosted verification also identified and corrected one integration edge:
an option-only edit previously attempted an empty Supabase/PostgREST question
update and could be misreported as a missing question. Option-only edits now
skip the empty scalar update, with a regression assertion covering that exact
behavior.

## Ownership & Security

The server resolves the authenticated Supabase user to the tenant profile and
queries applications using both application ID and the derived tenant ID. It
never accepts tenant or application ownership claims from the request body.

Another tenant receives `404` for GET and PUT. LANDLORD users receive `403`, and
SUSPENDED or DELETED accounts are blocked by the existing account-status
middleware. Strict request validation prevents mass assignment, while current
question lookup prevents cross-listing question injection.

## Frontend

The protected application draft page now loads the listing's current public
questions and the tenant's existing saved answers together. It renders an
accessible control for each approved type:

- textarea for TEXT;
- numeric input for NUMBER;
- Yes/No select for BOOLEAN;
- date input for DATE; and
- current-option select for SELECT.

Required and optional states are labelled, saved answers reload into their
controls, and field-level validation is shown without requiring required
answers during DRAFT. One **Save draft** action saves the existing base draft
fields and then the answer partial upsert through the centralized bearer API.
If only the second operation fails, the UI clearly states that basic details
were saved but answers were not. Unavailable listings do not fetch or reveal a
stale question structure. No submit action was added.

## Database Changes

None. No migration was added or edited. TASK-011 uses the existing
`application_answers` table, restrictive foreign keys, timestamps, RLS
enablement, and composite `(application_id, question_id)` primary key.

## Dependencies Added

None.

## Hosted Supabase Verification

TASK-011 real hosted verification passed 13/13 checks:

- save and canonicalize all five answer types using a real TENANT JWT;
- update and explicitly clear answers;
- reject an invented SELECT option;
- reject cross-listing question injection;
- block a second tenant and a LANDLORD;
- preserve one row across eight concurrent upserts;
- preserve an answer across text/order/required-only edits;
- remove an answer after a question type change;
- remove an invalid SELECT answer after option replacement;
- remove a dependent DRAFT answer before question deletion;
- confirm structurally invalidated answers remain absent on tenant reload;
- preserve safe GET while blocking PUT after listing unavailability; and
- deny direct publishable-key reads and writes through RLS.

All existing hosted regressions also passed: database 9/9, authentication
10/10, profiles 7/7, properties 8/8, property images 11/11, listings 10/10,
public search 9/9, saved listings 10/10, application questions 9/9, and rental
application drafts 12/12. This is 108/108 hosted checks across the full suite.

No environment values, tokens, passwords, or credentials were printed or
copied into this report.

## Tests

Tests added: 49 TASK-011-focused cases: 38 backend answer-route cases, 6
frontend answer-form cases, and 5 landlord-question mutation regressions.

Tests run:

- frontend automated suite: 101;
- backend automated suite: 452;
- local database verification: 20; and
- hosted Supabase verification: 108.

Tests passed: 681 total automated, database, and hosted checks.

Tests failed: 0.

Tests skipped: 0.

Coverage includes bearer authentication, ACTIVE TENANT enforcement, ownership
isolation, strict mass-assignment rejection, cross-listing injection, all five
types, clearing, partial updates, required-question DRAFT semantics, unavailable
listing behavior, concurrency, safe serialization, question invalidation,
submitted locks, protected routing, control rendering, answer reload, partial
save failure messaging, and absence of a submit action.

## Root Verification

- `npm run lint`: passed.
- `npm run test`: passed (101 frontend, 452 backend, 5 static database, and 15
  embedded PostgreSQL checks).
- `npm run build`: passed.
- `npm run format:check`: passed.
- `git diff --check`: passed.

The frontend production build reports the existing non-failing Vite advisory
that the main minified bundle exceeds 500 kB. The production build succeeds.

## Security

- RLS remains enabled with no broad application-table policies and was not
  weakened.
- Tenant ownership is derived from verified authentication and enforced only
  on the backend.
- Cross-listing answer injection is rejected against the application's current
  question set.
- Answer responses use an explicit minimal serializer.
- Direct browser reads and writes to `application_answers` remain denied.
- No credentials, passwords, access tokens, refresh tokens, secret values, or
  private keys were added, printed, or exposed.

## Known Limitations

- Application submission is deferred to TASK-012.
- Submission completeness and required-answer enforcement are deferred to
  TASK-012.
- The tenant application dashboard is deferred.
- Landlord applicant access is deferred.

## Recommended Next Task

TASK-012 — Application Submission

Do not begin TASK-012 automatically.
