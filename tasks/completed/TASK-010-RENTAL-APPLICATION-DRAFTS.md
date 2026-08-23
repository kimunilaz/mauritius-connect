# TASK-010 — Rental Application Drafts Completion Report

## Summary

Implemented the deliberately narrow rental-application DRAFT foundation. An
authenticated ACTIVE TENANT can create or restore one application draft for a
publicly eligible listing, retrieve only their own application, and update only
the four approved draft fields. Application answers, submission, dashboards,
landlord applicant access, withdrawal, and state progression were not added.

The implementation follows the existing controller/service/repository layers,
uses the existing verified Supabase bearer identity, keeps privileged database
access backend-only, and leaves the deny-by-default RLS posture unchanged.

## API

### POST /listings/:listingId/applications

Creates a new DRAFT for the authenticated tenant or idempotently returns that
tenant's existing DRAFT. New records force `status = DRAFT`, `submitted_at =
null`, and `withdrawn_at = null`. An existing non-DRAFT returns `409
APPLICATION_ALREADY_EXISTS`.

### GET /applications/:applicationId

Returns the authenticated tenant's own application through an explicit safe
serializer. Cross-tenant and unknown IDs return `404 APPLICATION_NOT_FOUND`.
The response does not include tenant identity, submission/withdrawal
timestamps, or listing/property data.

### PATCH /applications/:applicationId

Updates only the authenticated tenant's own editable DRAFT. Only
`move_in_date`, `requested_lease_duration_months`, `number_of_occupants`, and
`introductory_message` are accepted.

## Eligibility

A new draft is accepted only when the target listing is currently ACTIVE and
its property is not archived, using the same backend public-eligibility
boundary as Search & Discovery. Unknown, non-public, and archived-property
targets return the same privacy-preserving `404 LISTING_NOT_FOUND` response.

An existing DRAFT is resolved before new-draft eligibility is checked so it is
preserved and retrievable after the listing becomes unavailable.

## Idempotency

Repeated POST requests return the existing DRAFT without overwriting it. The
existing unique `(listing_id, tenant_id)` database constraint is the final
concurrency guarantee. Repository unique violations are resolved by reading
and returning the winning DRAFT; a winning non-DRAFT remains a conflict.

Real hosted verification sent eight concurrent creation requests. They
returned the same application ID and left exactly one database row.

## Ownership

The verified Supabase auth user ID is resolved to the existing tenant profile
on the backend. The server derives `tenant_id` from that profile and never uses
request ownership claims. Every GET and PATCH includes both application ID and
the derived tenant ID in repository scope, so another tenant receives the same
404 as an unknown application.

## Draft Editing

Editable fields are:

- preferred move-in date;
- requested lease duration in positive whole months;
- positive whole number of occupants; and
- trimmed introductory message, maximum 2,000 characters.

Optional values may be cleared to null. The validator is strict and rejects
IDs, ownership, listing ID, status, submitted/withdrawn timestamps, audit
timestamps, and unknown fields. A non-DRAFT returns `409
APPLICATION_NOT_EDITABLE`.

If a listing later becomes non-public, GET remains available with only safe
application fields and `editable: false` metadata. PATCH returns `409
LISTING_NOT_AVAILABLE` and leaves the draft intact.

## Frontend

Public listing detail now offers authenticated tenants a **Start or continue
application** action and sends logged-out visitors to login with the apply
destination preserved. LANDLORD users receive no tenant application action.

The protected `/listings/:listingId/apply` route idempotently creates or
restores the DRAFT only after the tenant enters the route. It presents the four
approved fields, field constraints, loading/error states, a clear DRAFT label,
and copy stating that the application is not submitted. There is no submit or
answer UI. Preserved drafts for unavailable listings render read-only with a
safe unavailable message.

## Database Changes

None. No migrations were added or edited. TASK-010 uses the existing
`applications` table, checks, foreign keys, timestamps, RLS enablement, and
unique tenant/listing constraint.

## Dependencies Added

None.

## Hosted Supabase Verification

TASK-010 real integration verification passed 12/12 checks:

- real TENANT JWT creation of a protected DRAFT;
- repeated creation idempotency and value preservation;
- eight-request concurrent creation yielding one row;
- independent second-tenant application;
- cross-tenant GET/PATCH isolation;
- LANDLORD rejection;
- protected-field escalation rejection;
- approved owner PATCH;
- non-public and archived-property new-draft rejection;
- safe retrieval and blocked editing after listing pause;
- existing non-DRAFT conflict; and
- denied anonymous/authenticated publishable-key table access and mutation.

All existing hosted regressions also passed: database 9/9, authentication
10/10, profiles 7/7, properties 8/8, property images 11/11, listings 10/10,
public search 9/9, saved listings 10/10, and application questions 9/9.

No environment values, tokens, passwords, or credentials were printed or
copied into this report.

## Tests

Tests added: 58 focused cases (48 backend, 10 frontend).

Tests run:

- frontend automated suite: 95;
- backend automated suite: 409;
- local database verification: 20;
- hosted Supabase verification checks: 95.

Tests passed: 619 total automated/database/hosted checks.

Tests failed: 0.

Tests skipped: 0.

Coverage includes eligibility, idempotency, a mocked conflict race and a real
hosted concurrency race, ownership isolation, mass-assignment defense,
validation, account/role enforcement, unavailable listing behavior, explicit
serializer privacy, protected frontend routing, bearer requests, safe UI
states, and proof that no answer or submit route exists.

## Root Verification

- `npm run lint`: passed.
- `npm run test`: passed (95 frontend, 409 backend, 5 static database, and 15
  embedded PostgreSQL checks).
- `npm run build`: passed.
- `npm run format:check`: passed.
- `git diff --check`: passed.

The frontend production build reports the existing advisory that its main
minified bundle exceeds Vite's 500 kB warning threshold; the build succeeds.

## Security

- RLS remains enabled with no application-table policies and was not weakened.
- Tenant ownership is derived and enforced entirely on the backend.
- Protected fields are strict and immutable through draft endpoints.
- Frontend application calls use the centralized bearer-authenticated Node API;
  there are no direct browser application reads or writes.
- Unavailable drafts do not expose private listing/property information.
- No credentials, passwords, access tokens, refresh tokens, secret values, or
  private keys were added or exposed.

## Known Limitations

- Custom question answers are deferred to TASK-011.
- Application submission is deferred to TASK-012.
- The tenant application dashboard is deferred.
- Landlord applicant access is deferred.

## Recommended Next Task

TASK-011 — Draft Application Answers

Do not begin TASK-011 automatically.
