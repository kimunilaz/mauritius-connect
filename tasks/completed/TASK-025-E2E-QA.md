# TASK-025 — End-to-End Testing & QA

## Status

COMPLETE

## Summary

TASK-025 now has deterministic Playwright coverage for the frozen TENANT,
LANDLORD, and ADMIN prototype. All 13 journeys pass together
against the local frontend/backend and linked development Supabase project.
The run creates random namespaced accounts and data, exercises the lifecycle in
serial order, and deletes only its own fixtures without a hosted reset.

The two authorized forward-only regression migrations were applied to the linked
development project without a reset, historical rewrite, seed, role batch, or
hosted-data deletion. Their hosted catalog and browser regressions pass.

## E2E Infrastructure

- Framework: Playwright Chromium.
- Entry points: `npm run test:e2e` and `npm run test:e2e:report`.
- Owned servers: backend port 3100 and frontend port 5174; unrelated development
  servers are not reused.
- Fixture personas: Tenant A, Tenant B, DRAFT Tenant, Landlord A, Landlord B,
  and ADMIN, all randomly generated with a `task025-` namespace.
- Credentials remain in ignored local environment files and process memory;
  reports, traces, and test results are ignored by Git.
- Cleanup discovers and deletes only namespaced test records, private storage
  objects, and Auth identities. It never resets the database.
- Authorization, rate limiting, CORS, private storage, transactions, and
  deny-by-default RLS remain enabled.

## Tenant Journey

Passing coverage includes authentication/session refresh/logout/recovery UI,
public discovery and filtering, listing detail, save/un-save state, duplicate
report protection, conversation reuse, blank and valid messages, required
application validation, draft persistence, submission, application history,
viewing responses, notification read/read-all behavior, final acceptance, saved
listing unavailability, and continued historical application/conversation access.

## Landlord Journey

Passing coverage includes authentication, property creation, invalid property
validation, private image upload, listing validation and creation, application
questions, publication to PENDING_REVIEW, ACTIVE confirmation after ADMIN
approval, applicant pipeline privacy, review, shortlist, all viewing outcomes,
messaging, acceptance, RENTED state, and explicit reactivation of a paused
listing after account reactivation.

## ADMIN Journey

Passing coverage includes the listing queue/detail and approval UI, required
return feedback, report review plus resolve/dismiss actions, verification queue
and detail UI, property-authority approval, identity rejection, user/listing
inspection, and role protection. Suspension/reactivation passes both the hosted
browser workflow and local PGlite regression.

## Security / Cross-Role QA

Passing browser/API checks cover missing authentication, wrong-role navigation,
TENANT access to LANDLORD/ADMIN resources, LANDLORD access to tenant-owned or
ADMIN resources, unrelated application/viewing/conversation/verification access,
foreign property ownership, tenant evidence access, and privacy-safe 404
responses. No TASK-023 control was disabled.

## Privacy QA

- DRAFT application is absent from the applicant pipeline and returns 404 from
  guessed landlord and unrelated-tenant detail requests.
- DRAFT, PENDING_REVIEW, suspended/paused, and RENTED listings are unavailable
  from public search/detail.
- Public listing responses omit exact address data.
- Verification evidence remains private.
- Notification previews do not contain private message bodies.
- Historical application and conversation access remains available with minimal
  unavailable-listing context after RENTED.

## Application / Acceptance QA

The main path passes DRAFT → SUBMITTED → UNDER_REVIEW → SHORTLISTED →
VIEWING_INVITED → VIEWING_COMPLETED → ACCEPTED. Acceptance produces exactly one
ACCEPTED application and one RENTED listing, rejects the eligible competing
application, leaves the competing DRAFT untouched, records one history event,
and generates the tenant notification.

`202608300001_require_active_listing_for_acceptance.sql` fixes a HIGH integrity
gap by requiring the locked listing to be ACTIVE before acceptance. The PGlite
regression verifies this invariant while retaining atomic competition rejection.

## Viewings

Passing coverage includes propose, invalid past proposal, confirm, decline,
cancel, re-propose, complete, no-show, and the one-open-viewing conflict. The
tests synchronize on user-visible results rather than arbitrary sleeps.

## Messaging / Notifications

Passing coverage includes idempotent conversation creation, participant-only
access, messages from both roles, blank-message prevention, ordering, message
reporting without content mutation, notification generation, unread state,
mark-one-read, mark-all-read, and post-RENTED historical conversation access.

## Reports / Verification

Passing coverage includes listing and message reports, duplicate protection,
ADMIN review, resolve and dismiss outcomes, identity and property-authority
verification requests, private PNG evidence, invalid evidence rejection,
tenant/public evidence denial, ADMIN approve/reject, and the public trust
indicator.

## Responsive QA

The final passing responsive audit covers 375×812 TENANT pages, 768×900
LANDLORD management/pipeline pages, and 1280×900 ADMIN queues. It verifies the
main landmark, visible page heading, accessible names, image alternatives, and
no horizontal overflow. Public mobile filtering, keyboard focus, loading,
empty, and recoverable error states are also exercised.

## Accessibility QA

The smoke audit checks main landmarks, one visible H1, names for links/buttons/
form controls, image alt attributes, keyboard focus visibility, labeled inputs,
status/alert messaging, and non-color status text. This is a private-beta smoke
gate, not a WCAG certification.

## Browser Console / Network

The suite records uncaught page errors, explicit console errors, failed requests,
and local 5xx responses. The passing run has none. Expected negative-test
401/403/404 responses are asserted. Chromium's generic resource log for the
deliberate RENTED-listing 404 is excluded while the response itself remains
verified. CORS allow/deny behavior passes and no tokens are logged.

## Bugs Found & Fixed

- HIGH — Frozen ADMIN listing-review and user-administration backend workflows
  had no usable frontend routes. Added the missing existing-feature list/detail
  surfaces and protected navigation.
- HIGH — ADMIN verification pages consumed the already-unwrapped API envelope
  incorrectly and could not render records. Fixed loading/error/empty/action
  behavior and added property verification ownership enforcement/regressions.
- HIGH — Eligible application acceptance had no landlord UI action. Added the
  action only for VIEWING_COMPLETED and covered it through unit/E2E tests.
- HIGH — The acceptance transaction did not reject a non-ACTIVE listing. Added
  forward migration `202608300001` and PostgreSQL regression coverage.
- HIGH — Hosted suspension failed because the RPC output parameter conflicted
  with an unqualified profile column. Added forward migration `202608300002`,
  preserving atomic suspension, ACTIVE-listing pause, audit, reactivation, RLS,
  and backend-only grants. The migration is applied and its hosted regression
  passes.
- LOW — Two hosted route verifiers still asserted that the frozen acceptance
  endpoint did not exist. Corrected the stale assertions; both verifiers pass.
- TEST HARNESS — Replaced overlapping route interception, corrected two direct
  proposal paths, aligned invalid-evidence status with the frozen API contract,
  and waited for the visible confirmation result before database inspection.

## Remaining QA Findings

- LOW — Vite reports a 614.34 kB main JavaScript chunk (161.43 kB gzip), above
  its advisory 500 kB threshold. The build succeeds and tested layouts remain
  responsive. Route-level code splitting is a future performance optimization,
  not a private-beta correctness or security blocker.

No remaining MEDIUM finding has been identified. All discovered BLOCKER/HIGH
issues are fixed and verified locally and against hosted Supabase.

## Out-of-Scope Product Gaps

None identified. Changes repair and test frozen prototype behavior; no product
capability, workflow state, verification type, moderation action, payment,
contract, analytics, recommendation, or deployment work was added.

## Hosted Supabase Verification

Twenty feature-specific hosted verifier scripts pass, totaling 164 reported
checks across Auth, profiles, properties, images, listings, public search,
saves, questions, applications, answers, submission, tenant applications,
landlord applications, transitions, viewings, conversations, messages,
notifications, reports, and verification.

The hosted ledger contains all 19 migrations through `202608300002`. The push
applied exactly `202608300001_require_active_listing_for_acceptance.sql` and
`202608300002_fix_admin_account_state_ambiguity.sql`; it applied no seeds or role
batch. `npm run db:verify:hosted` passes all 10 read-only catalog checks. No
hosted reset, historical rewrite, unrelated migration, or data deletion occurred.

## Database Verification

`npm run db:verify` passes: 19 ordered migrations, 21 tables, RLS and critical
static invariants, plus 26 embedded PostgreSQL runtime checks. New regressions
cover ACTIVE-only acceptance and atomic suspension/reactivation with listings
remaining paused.

## Tests

- Unit/integration: 15 frontend files / 156 tests passed; 27 backend files /
  569 tests passed; 26 database runtime checks passed.
- E2E: all 13 tests passed together in 8.0 minutes. The suspension affected
  suite also passed independently with 10/10 prerequisite-through-suspension tests.
- Hosted: 20 verifier scripts / 164 reported checks and 10/10 read-only catalog
  checks passed after both forward migrations were applied.
- Failed product regressions after implemented local fixes: 0.
- Skipped from the final E2E command: 0.

## Root Verification

- `npm run lint` — PASS.
- `npm run test` — PASS.
- `npm run test:e2e` — PASS, 13/13.
- `npm run build` — PASS, with the documented LOW chunk-size advisory.
- `npm run format:check` — PASS.
- `npm run security:check` — PASS; static credential scan and npm audit with
  zero vulnerabilities.
- `git diff --check` — PASS; only platform line-ending warnings.

## Feature Freeze

Confirmed: no new product functionality was added. TASK-026 deployment work was
not started.

## Recommended Next Task

TASK-026 — Deployment & Private-Beta Readiness. TASK-026 was not begun as part
of this task.
