# TASK-016 — Viewings Completion Report

## Summary

Implemented the complete viewing workflow for shortlisted rental applications.
The backend owns participant identity, property/listing ownership, allowed
actions, application-state integration, history attribution, idempotency, and
race resolution. Tenant and landlord application-detail screens now present
their role-appropriate viewing history and actions. No TASK-017 functionality
was added.

## Viewing API

- `POST /api/v1/landlord/applications/:applicationId/viewings`
- `GET /api/v1/applications/:applicationId/viewings`
- `GET /api/v1/viewings/:viewingId`
- `POST /api/v1/viewings/:viewingId/confirm`
- `POST /api/v1/viewings/:viewingId/decline`
- `POST /api/v1/viewings/:viewingId/cancel`
- `POST /api/v1/viewings/:viewingId/complete`
- `POST /api/v1/viewings/:viewingId/no-show`

There is no generic viewing-status PATCH endpoint. Responses use an explicit
viewing serializer and omit application IDs, proposer IDs, tenant/landlord IDs,
and other ownership metadata.

## Viewing State Machine

- Tenant: `PROPOSED -> CONFIRMED`
- Tenant: `PROPOSED -> DECLINED`
- Either participant: `PROPOSED | CONFIRMED -> CANCELLED`
- Landlord after the start time: `CONFIRMED -> COMPLETED`
- Landlord after the start time: `CONFIRMED -> NO_SHOW`

`DECLINED`, `COMPLETED`, `CANCELLED`, and `NO_SHOW` are terminal. Repeating the
same completed action is idempotent; a different action against a terminal
viewing returns `409 INVALID_VIEWING_TRANSITION`.

## Application Integration

The first proposal requires a `SHORTLISTED` application. Its viewing insert,
`SHORTLISTED -> VIEWING_INVITED` application update, and one actor-attributed
history insert commit atomically. After an unsuccessful terminal viewing, a
landlord may create another proposal while the application remains
`VIEWING_INVITED`.

Completing a confirmed viewing atomically changes the application from
`VIEWING_INVITED -> VIEWING_COMPLETED` and adds exactly one history row. Decline,
cancel, and no-show leave the application at `VIEWING_INVITED`. Listing status
is intentionally not rechecked after submission, so historical workflows
continue for paused, closed, rented, or otherwise non-public listings.

## Open Viewing Invariant

The partial unique index `viewings_one_open_per_application_idx` permits at most
one viewing in `PROPOSED` or `CONFIRMED` for an application. Terminal viewings
are excluded, so multiple historical viewings remain supported. Proposal logic
also locks the application row and checks for an open viewing before insertion;
the database index remains the final concurrency guarantee.

## Atomicity

`propose_viewing_transaction` performs the first viewing/application/history
write as one PostgreSQL transaction. `transition_viewing_transaction` locks the
viewing and application, rechecks the authenticated actor's ACTIVE role and
participant relationship, validates the expected source state, and applies the
fixed endpoint action. Completion updates viewing, application, and history in
one transaction. A failed write rolls the entire operation back.

## Actor Authorization

Every route requires a verified Supabase token, an application profile, and an
ACTIVE account. LANDLORD proposal/completion/no-show additionally require
backend-derived ownership of the application's listing. TENANT
confirm/decline require ownership of the application. Either verified
participant may cancel or read. Guessed cross-user IDs are hidden with 404, and
SUSPENDED/DELETED accounts are blocked before service access. Actor and owner
IDs never come from request bodies.

## Concurrency

Hosted concurrent proposals produced one `201` and one `409`, one open viewing,
one application transition, and one history row. Direct hosted transaction
races proved one winner and one stale-transition rejection for:

- confirm versus decline
- confirm versus cancel
- complete versus cancel

Identical completion retries returned `transitioned_now: false` and retained
exactly one completion history row.

## Frontend

The landlord application detail supports a future local date/time proposal,
optional ordered end time, bounded notes, cancel, complete, and no-show actions
when each is eligible. The tenant detail supports confirm, decline, and cancel.
Both screens show ordered current and historical viewings, status, notes, local
`en-MU` date/time presentation, loading/error/success feedback, disabled pending
actions, and confirmation prompts for destructive/irreversible actions. The
application detail refetches after actions so status and timeline stay current.

## Database Changes

Added and applied:

- `database/migrations/202608220003_add_viewing_transactions.sql`
- `viewings_one_open_per_application_idx`
- `public.propose_viewing_transaction(...)`
- `public.transition_viewing_transaction(...)`

Both functions are search-path hardened `SECURITY DEFINER` functions with no
dynamic SQL. Execute is revoked from `PUBLIC`, `anon`, and `authenticated`, and
granted only to `service_role`. Historical migrations were not modified.

## Dependencies

None.

## Hosted Supabase Verification

- The supported migration synchronization/push workflow applied the new
  TASK-016 migration to the configured development project.
- Hosted catalog verification: 10/10 passed, including all eight migrations,
  the open-viewing index, RLS/no-policy posture, and transaction-function grants.
- TASK-016 real viewing/concurrency verification: 6/6 grouped checks passed.
- TASK-002A–015 hosted regression verification: 136/136 checks passed.
- Total hosted checks: 152 passed, 0 failed, 0 skipped.
- Real API verification covered proposal, participant actions, both-party
  cancellation, repeated actions, historical reproposal, completion/history,
  role boundaries, all required races, and publishable-key table/RPC denial.

The shared hosted project contained an unrelated ACTIVE listing. The TASK-007
search verifier was hardened to compare its controlled fixtures and dynamic
pagination baseline instead of assuming an otherwise-empty project; all of its
privacy and ordering assertions remain intact.

## Tests

Tests added cover proposal/state/history atomicity, open-viewing conflicts,
multiple historical viewings, schedule and strict payload validation, every
actor/action combination, idempotency, participant-safe serialization,
cross-user ownership, inactive accounts, absent out-of-scope endpoints, all
three required transition races, frontend landlord/tenant controls,
confirmation behavior, bearer-authenticated requests, local time, and
historical read-only presentation.

- Tests added: 16 backend integration, 6 frontend integration, 2 embedded
  PostgreSQL invariants, and 6 grouped hosted TASK-016 checks.
- Tests run: 722 root automated checks (146 frontend, 552 backend, 24 embedded
  PostgreSQL) plus 152 hosted checks.
- Tests passed: 874.
- Tests failed: 0.
- Tests skipped: 0.

## Root Verification

- `npm run lint` — passed.
- `npm run test` — passed.
- `npm run build` — passed (Vite emitted only its existing advisory chunk-size
  warning).
- `npm run format:check` — passed.
- `git diff --check` — passed.
- Database static/runtime verification — passed (8 migrations, 21 tables, 24
  runtime checks).

## Security

- RLS remains enabled and deny-by-default; no browser table policies were added.
- Participant ownership is enforced in Node and rechecked inside privileged
  transactions.
- Actor IDs are derived from the verified Supabase access token and never
  accepted from request input.
- Strict validation rejects protected fields and bounds all proposal input.
- No generic viewing mutation endpoint exists.
- Browser roles cannot call the privileged viewing functions or directly
  mutate/read the private viewing table.
- No credentials, access tokens, environment values, or secrets were copied,
  printed, or committed.

## Known Limitations

- Application acceptance is deferred.
- Listing RENTED behavior is deferred.
- Messaging is deferred.
- Notifications are deferred.
- Calendar integrations and reminders are deferred.

## Recommended Next Task

TASK-017 — Conversations
