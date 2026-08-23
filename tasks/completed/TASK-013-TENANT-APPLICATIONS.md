# TASK-013 — Tenant Applications Completion Report

## Summary

Implemented the authenticated tenant application list and detail experience.
The backend now provides tenant-scoped pagination, status filtering, safe
listing availability presentation, owner-authorized answers, and an actor-free
status timeline. The frontend provides protected list/detail routes, status and
availability UX, draft continuation, and read-only submitted/unavailable
states. No withdrawal, landlord pipeline, or new state transition was added.

## Tenant Applications API

`GET /api/v1/tenant/applications` requires a verified Supabase identity, an
ACTIVE account, and TENANT role. It derives the tenant profile from the
authenticated user and returns only that tenant's applications through the
standard success and pagination envelope. Results are ordered by
`updated_at DESC, id DESC`.

## Filtering & Pagination

The endpoint defaults to `page=1` and `limit=20`, bounds `limit` at 100, and
rejects invalid or unknown query values. Its optional `status` filter accepts
all nine approved application states, including states reserved for later
workflow tasks. Pagination metadata includes page, limit, total, and total
pages.

## Listing Privacy

For a listing that is still ACTIVE on a non-archived property, the response
uses the existing public listing-card serializer and short-lived signed cover
URL, with `availability: AVAILABLE`. Otherwise it returns only
`availability: UNAVAILABLE` and `listing: null`. An application never grants
access to a former title/description, exact address, coordinates, landlord or
property ownership IDs, or internal Storage paths.

## Application Detail

The existing `GET /api/v1/applications/:applicationId` remains tenant-owner
only and now presents the tenant's safe core fields, availability-aware public
listing card, answers, and safe status history. DRAFT + AVAILABLE returns
editable continuation metadata. DRAFT + UNAVAILABLE is preserved but
read-only. SUBMITTED applications are always read-only and expose their
server-controlled submission timestamp.

## Answers

Application detail includes the owning tenant's saved/submitted answer values.
For a public DRAFT, current safe question text may be shown. A non-public DRAFT
does not use current question structure as a private-data backdoor, while a
SUBMITTED application may show its locked question text. Cross-listing answers
are excluded. No new answer mutation behavior was added.

## Status Timeline

Detail responses include ordered status-history events with exactly
`from_status`, `to_status`, and `created_at`. The repository does not select
`changed_by_user_id`, and the serializer has no actor field.

## Ownership & Security

Tenant ownership is resolved entirely from verified authentication and the
backend tenant profile. Cross-tenant detail returns 404, LANDLORD access to the
tenant list returns 403, and missing, SUSPENDED, or DELETED account access is
blocked. RLS remains deny-by-default and direct authenticated/anonymous
publishable-key reads of applications, answers, and history return no data.

## Frontend

Added protected routes:

- `/tenant/applications`
- `/tenant/applications/:applicationId`

The list supports all-status filtering, pagination, loading/error/empty states,
human-readable status labels, submitted/updated dates, safe public cards, and
minimal unavailable cards. DRAFT + AVAILABLE links back to the existing
application editor. Detail shows status, availability, tenant-owned fields,
answers, and a safe timeline; submitted or unavailable records show a clear
read-only state. The account foundation now links tenants to My applications.
There is no withdrawal or landlord applicant control.

## Database Changes

None. Existing tables, constraints, TASK-012 transactional functions, and
deny-by-default RLS were sufficient. No migration or policy was added or
changed.

## Dependencies Added

None.

## Hosted Supabase Verification

Real TASK-013 hosted verification passed 9 scenario groups:

- owner-scoped DRAFT/SUBMITTED listing, ordering, and pagination;
- every approved status filter and invalid query rejection;
- safe ACTIVE public card with a working signed private-Storage cover URL;
- minimal unavailable DRAFT and SUBMITTED representations;
- owner answers and actor-free timeline detail;
- DRAFT availability/editability behavior;
- cross-tenant 404, LANDLORD 403, and unauthenticated 401 behavior;
- SUSPENDED tenant denial and restoration; and
- direct publishable-key application, answer, and history read denial.

All prior hosted authentication, profile, property, private-image, listing,
search, saved-listing, application-question, draft, answer, and submission
regressions passed. The hosted database catalog suite also passed all 10
checks. A legacy TASK-010 hosted exact-key assertion was updated to validate
the new documented detail fields and unavailable-listing privacy contract.

## Tests

Tests added: 31 (18 backend integration/security/privacy cases and 13 frontend
route/list/detail/UX cases).

Tests run: 633 automated local tests/checks plus 128 hosted checks.

Tests passed: 633 local and 128 hosted.

Tests failed: 0.

Tests skipped: 0.

The local result was 120 frontend tests, 494 backend tests, and 19 embedded
PostgreSQL runtime checks. Static database verification also passed.

## Root Verification

- `npm run lint` — passed
- `npm run test` — passed
- `npm run build` — passed (Vite emitted only its existing advisory chunk-size
  warning)
- `npm run format:check` — passed
- `git diff --check` — passed
- `npm run tenant-applications:verify:hosted` — passed (9 checks)
- `npm run db:verify:hosted` — passed (10 checks)
- every prior hosted verification command — passed

## Security

- RLS is unchanged and remains deny-by-default.
- Tenant ownership is derived and enforced by the backend.
- Unavailable listing data remains private.
- `changed_by_user_id` is neither queried nor exposed to tenants.
- No credentials, environment values, access tokens, or secrets were copied,
  printed, or committed.

## Known Limitations

- Withdrawal is deferred.
- The landlord applicant pipeline is deferred to TASK-014.
- UNDER_REVIEW and later transitions are deferred.
- Viewings are deferred.
- Notifications are deferred.

## Recommended Next Task

TASK-014 — Landlord Applicant Pipeline
