# TASK-008 — Saved Listings Completion Report

## Summary

Implemented the complete Saved Listings foundation for authenticated ACTIVE
TENANT users. Tenants can save eligible public rentals, inspect their own saved
state, browse a paginated saved-rentals page, and remove saves. Ownership is
derived entirely from the verified auth identity and application tenant
profile. The implementation preserves an existing save after its listing stops
being public while reducing that API item to a deliberately minimal unavailable
representation.

The work reuses the existing authentication, role-profile, public-listing,
private-image, API client, and deny-by-default RLS foundations. No application,
recommendation, messaging, viewing, or later-task functionality was added.

## API

Implemented:

- `GET /api/v1/tenant/saved-listings` — tenant-private, paginated saved list.
- `GET /api/v1/tenant/saved-listings/:listingId/status` — returns only the
  authenticated tenant's saved boolean and listing identifier.
- `POST /api/v1/listings/:listingId/save` — idempotently saves an eligible
  listing.
- `DELETE /api/v1/listings/:listingId/save` — idempotently removes the
  authenticated tenant's relationship, including after unavailability.

All routes use the standard authentication, profile-loading, ACTIVE-account,
and TENANT-role middleware. Request schemas reject mass-assignment fields and
invalid identifiers or pagination.

## Eligibility

A NEW save requires the exact public eligibility invariant: listing status is
`ACTIVE` and the related property has no `archived_at` value. Unknown, draft,
pending-review, paused, rented, closed, and archived-property targets return the
same `404 LISTING_NOT_FOUND` response so private existence is not disclosed.

An already-existing relationship is returned as a successful save without
reapplying new-save eligibility. This preserves the tenant's relationship and
ability to remove it after marketplace visibility changes.

## Idempotency

Repeated POST requests return `saved: true` and do not create additional rows.
The service checks the tenant-scoped relationship and also treats a database
duplicate-key race as success. The existing `(tenant_id, listing_id)` composite
primary key remains the final concurrency guarantee.

Repeated DELETE requests return `204` whether or not the relationship exists.
Unsave is tenant-scoped and never deletes or mutates a listing or property.

## Ownership

The backend derives the Supabase auth user UUID from the verified bearer token,
loads the authoritative TENANT application profile, and resolves/initializes
that user's `tenant_profiles` row. Only that row's ID is used for repository
queries and mutations. Client-supplied `tenant_id`, `user_id`, `listing_id`, or
timestamp fields are rejected and cannot affect ownership.

List, status, save, and remove operations are all tenant-scoped. A second
tenant has independent state for the same listing, and one tenant cannot read
or remove the other tenant's relationship.

## Unavailable Listings

When a saved listing becomes `PAUSED`, `CLOSED`, `RENTED`, is attached to an
archived property, or otherwise stops satisfying public eligibility, the
database relationship remains. The saved-list response emits only:

```json
{
  "listing_id": "uuid",
  "saved_at": "timestamp",
  "availability": "UNAVAILABLE",
  "listing": null
}
```

No title, description, rent, address, coordinates, property details,
landlord/ownership data, image metadata, or Storage path is serialized. Status
continues to return `saved: true`, and DELETE remains available so the tenant
can remove the relationship.

## Images

AVAILABLE saves reuse the explicit TASK-007 public listing-card serializer and
existing short-lived signed cover-image presentation. Eligibility is checked
before image lookup or signing. UNAVAILABLE saves do not query/sign an image and
contain no image URL or private Storage metadata.

## Frontend

Added the protected `/tenant/saved-listings` page with responsive cards,
loading, error/retry, empty, pagination, AVAILABLE, and UNAVAILABLE states.
Available items reuse the public listing card; unavailable items show only a
generic message, saved timestamp, and Remove action.

The public listing detail page now:

- shows a login affordance to logged-out visitors while browsing remains public;
- loads and displays server-confirmed saved state for TENANT users;
- supports accessible save/unsave controls with pending and safe error states;
- hides tenant save controls from LANDLORD users.

TENANT account and public-header navigation link to Saved rentals. The frontend
uses the centralized API client and current Supabase access token; it does not
write directly to `saved_listings`.

## Database Changes

None. No migration or policy was added or edited. The existing composite
primary key and restrictive foreign keys are sufficient, and RLS remains
enabled with no application-table policies.

## Hosted Supabase Verification

Real development Supabase verification passed. Isolated fixtures and a
temporary second controlled tenant were created through trusted test/setup
infrastructure and fully removed afterward. No developer marketplace records
were modified.

TASK-008 saved-listing integration passed 10/10 checks:

- real TENANT save of an ACTIVE/non-archived listing;
- duplicate save remains exactly one row;
- safe saved-list card and working signed cover;
- tenant-private status;
- independent second-tenant state;
- LANDLORD rejection;
- non-public and archived-property new-save rejection;
- ACTIVE save remains related and becomes minimal UNAVAILABLE after both
  PAUSED and CLOSED transitions;
- unavailable save remains idempotently removable;
- publishable-key reads and mutations remain blocked by RLS.

All hosted regressions passed 74/74 checks total:

- database catalog: 9/9;
- authentication: 10/10;
- tenant/landlord profiles: 7/7;
- properties: 8/8;
- property images/private Storage: 11/11;
- landlord listings: 10/10;
- public search/privacy: 9/9;
- saved listings: 10/10.

Hosted search exposed one real projection mismatch: the shared eligibility
guard required listing status, while the real public projection filtered on but
did not select that field. The minimal correction adds `status` to the internal
explicit repository projection; public serializers still omit private/internal
fields. A projection-contract regression test was added, and hosted public
search then passed 9/9.

## Tests

Tests added: 53 TASK-008-focused tests (40 backend saved-route/security tests,
12 frontend saved-listing tests, and 1 public repository projection regression
test).

Tests run: 390 application tests, static database verification, 15 embedded
PostgreSQL runtime checks, and 74 hosted Supabase integration checks.

Tests passed: all 390 application tests, all 15 embedded database checks, all
static database checks, and all 74 hosted checks.

Tests failed: 0 in the final verification run.

Tests skipped: 0.

Important coverage includes eligibility, archived properties, idempotency,
concurrent duplicate handling, ownership derivation, cross-tenant isolation,
mass assignment, role/account-status enforcement, stable pagination, AVAILABLE
serialization, every non-public UNAVAILABLE state, no unavailable image
signing, relationship preservation, unavailable removal, protected frontend
routing, save UX, and logged-out/wrong-role behavior.

The full suite also identified and fixed a route-composition regression where a
router-level TENANT middleware intercepted unrelated landlord listing routes.
Middleware is now attached only to the exact save/unsave routes, with a
dedicated regression test; the focused 117-test listing/saved-listing suite and
real hosted landlord listing verification both passed afterward.

## Root Verification

- `npm run lint` — PASS.
- `npm run test` — PASS (73 frontend, 317 backend, database static verification,
  and 15 embedded PostgreSQL checks).
- `npm run build` — PASS. Vite emitted only its advisory chunk-size warning.
- `npm run format:check` — PASS.
- `git diff --check` — PASS (exit 0; only Windows line-ending notices).

## Security

- Tenant ownership is derived from the verified token and authoritative
  application/tenant profiles.
- ACTIVE-account and TENANT-role enforcement is backend-side on every save API.
- New-save eligibility is verified by the backend; request ownership claims are
  not trusted.
- AVAILABLE responses use the established explicit public serializer.
- Old non-public saves expose no private listing/property data and trigger no
  image signing.
- RLS and the private property-images bucket were not weakened.
- Publishable-key direct reads and writes to `saved_listings` were verified as
  blocked.
- No credentials, access tokens, environment values, or secrets were printed,
  copied, committed, or included in this report.
- No new dependency was added.

## Known Limitations

- Search-card save buttons are optional and were deferred; save/unsave is
  available on public listing detail and the saved-rentals page.
- Application questions are deferred to TASK-009.
- Applications are deferred to a later task.
- Recommendations are deferred to a later task.

## Recommended Next Task

TASK-009 — Application Questions.
