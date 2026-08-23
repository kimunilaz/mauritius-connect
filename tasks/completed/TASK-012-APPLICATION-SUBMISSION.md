# TASK-012 — Application Submission Completion Report

## Summary

Implemented tenant-owned rental application submission from DRAFT to
SUBMITTED. The foundation includes current readiness validation, an atomic and
idempotent database transition, exactly one attributed status-history row,
submission/question-mutation race protection, post-submit edit protection, a
tenant review-and-confirm frontend, local security/concurrency coverage, and
real hosted Supabase verification. No TASK-013 functionality was added.

## Submission API

`POST /api/v1/applications/:applicationId/submit` requires verified Supabase
authentication, an ACTIVE application account, TENANT role, and ownership
resolved from the authenticated tenant profile. A request body cannot select
the tenant, actor, status, or timestamps.

A first successful request returns the explicit application serializer with
`status: SUBMITTED`, server-controlled `submitted_at`, and
`meta.submitted_now: true`. An idempotent retry returns the same submitted
state with `meta.submitted_now: false`. Another tenant receives 404; a wrong
role or inactive account is blocked; later application states return the
stable `APPLICATION_NOT_SUBMITTABLE` conflict.

## Readiness

Submission requires:

- `move_in_date`, `requested_lease_duration_months`, and
  `number_of_occupants`;
- an answer to every question that is currently required;
- every stored TEXT, NUMBER, BOOLEAN, DATE, and SELECT answer to remain valid
  for its current question and option set; and
- the listing to remain ACTIVE on a non-archived property at commit time.

Incomplete requests return `422 APPLICATION_INCOMPLETE` with safe arrays for
missing core fields, missing question IDs, and invalid question IDs. Optional
questions may remain blank. An unavailable listing returns
`409 LISTING_NOT_AVAILABLE` and the draft is preserved.

## Atomicity

The backend performs its normal authorization and readiness checks, then calls
the narrowly scoped backend-only `submit_application_transaction` function.
Inside one PostgreSQL transaction the function rechecks actor/application
ownership, locks the listing and application, revalidates listing eligibility,
core fields, current questions, and current answers, conditionally updates only
an unchanged DRAFT application, assigns `submitted_at`, and inserts the
DRAFT-to-SUBMITTED history row. Any failure rolls back both changes.

## Concurrency

The application row lock serializes simultaneous submission requests. The
conditional DRAFT update makes stale writes harmless, and an already-SUBMITTED
request resolves idempotently. A unique partial index on submission history is
the final database backstop. Local and hosted concurrent requests produced one
transition and exactly one history row without raw database errors.

## Question-Mutation Race

Submission and `mutate_application_question_transaction` take the same
transaction-scoped advisory lock derived from `listing_id`. If submission wins,
the later structural mutation sees the submitted-application lock and fails.
If mutation wins, submission validates the resulting question type/options and
answers. The parent-application answer trigger also locks the application row,
preventing answer changes between validation and commit.

The hosted verifier covered mutation-first behavior and a simultaneous
submission-versus-type-change race. Both resolved deterministically without a
submitted application being paired with an inconsistent question structure.

## Status History

The transaction writes exactly one row with `from_status: DRAFT` and
`to_status: SUBMITTED`. `changed_by_user_id` is the verified Supabase auth user
ID after its tenant/application relationship is rechecked in the transaction.
It is never read from request input. `withdrawn_at` remains unchanged.

## Frontend

The existing `/listings/:listingId/apply` page now provides:

- frontend highlighting for missing core fields and required questions;
- persistence of valid draft fields and answers before review;
- a read-only final review of core fields and current answers;
- explicit finality copy and a separate Submit application action;
- disabled controls while submission is pending;
- double-click protection and idempotent retry handling;
- useful commit-time incomplete and listing-unavailable feedback; and
- a persistent Submitted state with status and submission timestamp and no
  editable controls.

The route remains TENANT-only. No dashboard or landlord applicant view was
added.

## Database Changes

Added new migration:

- `202608220001_add_application_submission_transactions.sql`

It adds:

- `submit_application_transaction`;
- atomic `mutate_application_question_transaction` using the shared per-listing
  lock;
- `application_answers_require_draft` trigger/function; and
- `application_status_history_one_submission_idx`.

Both RPC entry points revoke execution from PUBLIC, anonymous, and authenticated
browser roles and grant execution only to the trusted backend role. They are
search-path hardened and contain no dynamic SQL. The migration was applied to
the configured development Supabase project with the reproducible CLI workflow.
All historical migration files remain untouched. The development seed was
only reordered to stage its submitted fixture through DRAFT before inserting
the fixture answer, preserving its final data and repeatability under the new
trigger.

## Dependencies Added

None.

## Hosted Supabase Verification

Real hosted TASK-012 verification passed 10 checks:

- tenant completion and persisted SUBMITTED timestamp/status;
- exactly one server-attributed DRAFT-to-SUBMITTED history row;
- eight concurrent submissions and idempotent retry;
- required core-field and required-question enforcement;
- optional unanswered question submission;
- cross-tenant and LANDLORD blocking;
- listing availability recheck;
- mutation-first and simultaneous question/submission race outcomes;
- post-submit draft, answer, and question mutation blocking; and
- direct anonymous/authenticated RPC, application, and history mutation denial.

Hosted database verification passed 10 catalog checks, including migration
history, RLS with no application-table policies, the new trigger/index, and
backend-only function grants. All 99 prior hosted authentication, profile,
property, image, listing, search, saved-listing, question, application-draft,
and answer regression checks also passed.

## Tests

Tests added: 34 behavioral/runtime checks (23 backend route/security cases, 6
frontend submission cases, 1 question-race regression, and 4 embedded
PostgreSQL transaction checks).

Tests run: 602 automated local tests/checks plus 119 real hosted checks.

Tests passed: 602 local and 119 hosted.

Tests failed: 0.

Tests skipped: 0.

The full local result was 107 frontend tests, 476 backend tests, and 19 embedded
PostgreSQL runtime checks. Static database inspection also passed.

## Root Verification

- `npm run lint` — passed
- `npm run test` — passed
- `npm run build` — passed (Vite emitted only its existing advisory chunk-size
  warning)
- `npm run format:check` — passed
- `git diff --check` — passed
- `npm run db:verify:hosted` — passed
- `npm run submissions:verify:hosted` — passed
- every prior hosted verification command — passed

## Security

RLS remains enabled and deny-by-default, with no new table policies. Tenant
ownership and history actor identity are derived from verified authentication
and checked again at the transaction boundary. The question/submission and
answer/submission races are closed with database locks. Browser roles cannot
execute the privileged functions or directly mutate applications/history. No
credentials, tokens, passwords, or environment values were printed, copied,
or committed.

## Known Limitations

- Application withdrawal is deferred.
- A tenant applications dashboard is deferred.
- Landlord applicant access is deferred.
- UNDER_REVIEW and every later workflow transition are deferred.
- Submission notifications are deferred.
- A refreshed submitted application does not yet have a tenant dashboard/detail
  destination; the successful submission state is retained for the current
  application flow.

## Recommended Next Task

TASK-013 — Tenant Applications
