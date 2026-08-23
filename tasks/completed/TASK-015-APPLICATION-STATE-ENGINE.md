# TASK-015 — Application State Engine Completion Report

## Summary

Implemented the explicit application state engine with dedicated landlord
review, shortlist, and reject actions plus tenant withdrawal. The backend owns
all actor, ownership, target-state, concurrency, and history decisions. No
generic status endpoint or TASK-016 functionality was added.

## Endpoints

- `POST /api/v1/landlord/applications/:applicationId/review`
- `POST /api/v1/landlord/applications/:applicationId/shortlist`
- `POST /api/v1/landlord/applications/:applicationId/reject`
- `POST /api/v1/applications/:applicationId/withdraw`

There is no generic status PATCH, acceptance endpoint, or viewing-state action.

## Transition Matrix

- `SUBMITTED → UNDER_REVIEW`
- `SUBMITTED → REJECTED`
- `SUBMITTED → WITHDRAWN`
- `UNDER_REVIEW → SHORTLISTED`
- `UNDER_REVIEW → REJECTED`
- `UNDER_REVIEW → WITHDRAWN`
- `SHORTLISTED → REJECTED`
- `SHORTLISTED → WITHDRAWN`

`REJECTED` and `WITHDRAWN` are terminal in this task.

## Actor Authorization

Landlord actions require a verified token, ACTIVE profile, LANDLORD role, and
backend-confirmed ownership of the application's listing through its property.
Tenant withdrawal requires the same authentication/account checks, TENANT
role, and ownership of the application through the server-resolved tenant
profile. Request bodies cannot select the actor, owner, role, or target status.

## Atomicity

The backend-only `transition_application_status_transaction` function locks the
application row, rechecks actor role and ownership from database relationships,
validates one approved edge, updates status (and `withdrawn_at` only when
withdrawing), and inserts the actor-attributed history event in one PostgreSQL
transaction. A history failure rolls back the state change.

## Concurrency

The service passes the source status it observed to the locked transaction.
After acquiring the row lock, the function rejects a different target when the
current source no longer matches. Hosted races proved one winner, one stable
`409 INVALID_APPLICATION_TRANSITION`, one final state, and one new history row
for review versus withdraw, reject versus withdraw, and shortlist versus
reject.

## Idempotency

When the locked application is already at the endpoint's fixed target and the
corresponding history exists, the function returns `ALREADY_TARGET` without a
write. The API returns `meta.transitioned_now: false`. Repeated and concurrent
identical actions do not add history.

## DRAFT Privacy

Landlord services query only non-DRAFT applications. The transaction also
returns its not-found outcome for a landlord/DRAFT combination. A guessed DRAFT
ID receives `404 APPLICATION_NOT_FOUND`, does not invoke a state change, and
does not reveal that an application exists.

## Frontend

The landlord detail page now shows the exact actions allowed by its current
state: review/reject for SUBMITTED, shortlist/reject for UNDER_REVIEW, and
reject for SHORTLISTED. Rejection requires confirmation. The tenant detail page
offers confirmed withdrawal only for SUBMITTED, UNDER_REVIEW, and SHORTLISTED.
Both flows display pending/error/success state and refetch the safe detail after
success. No acceptance or viewing controls are present.

## Timeline

After a successful action, the frontend refetches detail so the actor-free
timeline immediately includes the committed transition. Existing serializers
continue returning only `from_status`, `to_status`, and `created_at`; they do
not expose `changed_by_user_id`.

## Database Changes

Added and applied:

- `database/migrations/202608220002_add_application_state_transition_transaction.sql`
- `public.transition_application_status_transaction(uuid, uuid, text, text, text)`

The function is `SECURITY DEFINER`, pins an empty search path, uses no dynamic
SQL, is revoked from `PUBLIC`, `anon`, and `authenticated`, and grants execution
only to `service_role`. Historical migrations were not edited. RLS and the
deny-by-default policy posture are unchanged.

## Dependencies

None.

## Hosted Supabase Verification

- Migration synchronization and dry-run identified only the new TASK-015
  migration; the supported CLI push applied it successfully.
- Hosted database catalog: 10/10 passed, including migration history, RLS/no
  policies, and browser-role revocation for all transaction functions.
- TASK-015 state/concurrency verification: 9/9 passed.
- Earlier hosted TASK-002A–014 regression checks: 127/127 passed.
- Private Storage bucket configuration remained valid.
- Total hosted checks reported by the catalog, regression, and TASK-015 suites:
  146 passed, 0 failed.

## Tests

Tests added or extended cover every approved edge, invalid and terminal edges,
identical retries, protected request-body manipulation, actor attribution,
cross-role/cross-owner access, DRAFT privacy, closed-listing continuity, absent
generic/accept/viewing routes, three conflicting-target races, frontend action
sets, confirmation, bearer-authenticated actions, terminal UI, and timeline
refresh.

- Tests run: 698 root automated checks (140 frontend, 536 backend, 22 embedded
  PostgreSQL), plus 146 hosted checks.
- Tests passed: 698 root + 146 hosted.
- Tests failed: 0.
- Tests skipped: 0.

## Root Verification

- `npm run lint` — passed.
- `npm run test` — passed.
- `npm run build` — passed.
- `npm run format:check` — passed.
- `git diff --check` — passed.

## Security

- RLS remains enabled with no broad or new browser policies.
- Landlord and tenant ownership are enforced in Node and rechecked at the
  transactional integrity boundary.
- `changed_by_user_id` comes only from the verified authenticated profile and
  is never serialized to either actor.
- Endpoint-fixed targets prevent status mass assignment.
- No generic status mutation exists.
- The privileged transaction function is not executable by browser roles.
- No credentials, tokens, or environment values were printed, copied, or
  committed.

## Known Limitations

- Acceptance and listing RENTED effects are deferred.
- Viewing scheduling and viewing states are deferred.
- Messaging is deferred.
- Notifications are deferred.

## Recommended Next Task

TASK-016 — Viewings
