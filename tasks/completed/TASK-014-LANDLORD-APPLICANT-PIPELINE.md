# TASK-014 — Landlord Applicant Pipeline Completion Report

## Summary

Implemented the read-only landlord applicant pipeline for applications
submitted to owned listings. The foundation includes owner-scoped list/detail
APIs, absolute DRAFT invisibility, minimal applicant identity, submitted answer
presentation, actor-free history, historical visibility after listing closure,
protected frontend routes, privacy/security tests, and real hosted Supabase
verification. No application state transition was added.

## Landlord API

Implemented:

- `GET /api/v1/landlord/listings/:listingId/applications`
- `GET /api/v1/landlord/applications/:applicationId`

Both require verified authentication, an ACTIVE application account,
LANDLORD role, and backend-confirmed listing ownership. The list supports page,
limit, and all eight approved non-DRAFT statuses, defaults to page 1/limit 20,
bounds limit at 100, and orders by `submitted_at DESC, id DESC`.

## Draft Privacy

DRAFT is excluded directly in both repository read queries. It is rejected as
a list filter. A guessed DRAFT application ID returns
`404 APPLICATION_NOT_FOUND`, indistinguishable from an absent or foreign
application. Empty-list totals count submitted/non-DRAFT applications only and
do not reveal a DRAFT volume.

## Applicant Serialization

List items expose only:

- application ID, status, submitted timestamp, move-in date, lease duration,
  occupant count, and updated timestamp; and
- tenant first name, last name, and profile photo URL.

Detail additionally exposes the submitted introduction, created timestamp, a
safe listing/property summary, submitted question text/type and answer values,
and the safe status timeline.

## Tenant Privacy

Applicant identity retrieval selects only `first_name`, `last_name`, and
`profile_photo_url` from the base profile. Serializers intentionally exclude
tenant/profile/Supabase IDs, email, phone, account-status internals, preferred
locations, income range, employer or school, occupation, bio, question/answer
IDs, exact address, coordinates, landlord/property ownership IDs, Storage
paths, and Supabase metadata.

## Answers

The owning landlord can read the stable submitted question text/type and the
application's answer values. Answers are filtered to questions belonging to
the application's listing. Internal answer, question, application, or tenant
IDs are not serialized. TASK-009/TASK-012 locks remain authoritative; TASK-014
adds no answer mutation.

## Timeline

Application detail returns ordered timeline entries containing exactly
`from_status`, `to_status`, and `created_at`. The repository history projection
does not select `changed_by_user_id`, and the landlord serializer has no actor
field.

## Ownership

The backend derives the landlord role profile from the verified auth identity,
then verifies listing ownership through the property's authoritative
`landlord_id`. Another landlord receives `404 LISTING_NOT_FOUND` for the list
and `404 APPLICATION_NOT_FOUND` for detail, without applicant volume or
existence disclosure. TENANT access returns 403. SUSPENDED and DELETED
landlords are blocked before service access.

## Frontend

Added LANDLORD-only routes:

- `/landlord/listings/:listingId/applications`
- `/landlord/applications/:applicationId`

The applicant page provides accessible read-only status tabs, responsive
vertical cards, pagination, loading/error/empty states, and applicant name,
status, move-in, lease, occupants, and submission date. Detail presents the
minimal applicant identity, submitted fields, safe historical listing summary,
answers, and timeline. Listing management now always links to View
applications, including when the count is zero or the listing is closed.

## State Mutations

None were added. There is no generic status PATCH, mark-under-review,
shortlist, reject, accept, viewing invitation, drag-and-drop mutation,
withdrawal, messaging, or notification control. Automated and hosted checks
confirm the prospective action routes return 404 and persisted status remains
unchanged.

## Database Changes

None. Existing tables, indexes, submission constraints, and RLS posture were
sufficient. No historical migration was edited and no policy was added.

## Dependencies

None.

## Hosted Supabase Verification

Real TASK-014 hosted verification passed 9 scenario groups:

- owning landlord sees SUBMITTED while a coexisting DRAFT is excluded;
- guessed DRAFT detail returns 404;
- all visible status filters work and DRAFT is rejected;
- submitted answers, safe timeline, profile photo, and minimal identity render;
- private base-profile and mutable tenant-profile markers remain absent;
- cross-landlord list/detail and TENANT access are blocked;
- historical detail/list remain available after PAUSED and CLOSED;
- SUSPENDED landlord access is denied and safely restored;
- no mutation route exists and direct publishable-key application, answer, and
  history reads remain denied.

All previous hosted regressions passed. Hosted database verification passed 10
catalog checks covering migration history, constraints/indexes, backend-only
functions, and deny-by-default RLS.

## Tests

Tests added: 34 (22 backend authorization/privacy/API cases and 12 frontend
route/pipeline/detail/integration cases).

Tests run: 667 automated local tests/checks plus 137 hosted checks.

Tests passed: 667 local and 137 hosted.

Tests failed: 0.

Tests skipped: 0.

The local result was 132 frontend tests, 516 backend tests, and 19 embedded
PostgreSQL runtime checks. Static database verification also passed.

## Root Verification

- `npm run lint` — passed
- `npm run test` — passed
- `npm run build` — passed (Vite emitted only its existing advisory chunk-size
  warning)
- `npm run format:check` — passed
- `git diff --check` — passed
- `npm run landlord-applications:verify:hosted` — passed (9 checks)
- `npm run db:verify:hosted` — passed (10 checks)
- every prior hosted verification command — passed

## Security

- RLS is unchanged and remains deny-by-default.
- DRAFT privacy is enforced at query and validation boundaries.
- Tenant contact and mutable/private tenant-profile data are not selected into
  the applicant response model or serialized.
- All browser access uses the Node API; direct application-table reads remain
  unavailable to publishable-key clients.
- No credentials, tokens, passwords, or environment values were copied,
  printed, exposed, or committed.

## Known Limitations

- State transitions are deferred to TASK-015.
- Withdrawal is deferred.
- Viewings are deferred.
- Messaging is deferred.
- Notifications are deferred.

## Recommended Next Task

TASK-015 — Application State Engine
