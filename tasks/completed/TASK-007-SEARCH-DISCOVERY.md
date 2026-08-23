# TASK-007 — Search & Discovery Completion Report

## Summary

TASK-007 adds the first public marketplace surface. Anonymous and authenticated
visitors can browse eligible rentals, apply structured filters, choose an
allowlisted deterministic sort, paginate results, and view responsive public
listing details. All browsing flows through the Node API. The browser receives
explicit public response objects and short-lived presentation URLs, not direct
database or private Storage access.

No saved-listing, application-question, rental-application, messaging, viewing,
recommendation, or admin-approval functionality was added.

## Public API

- `GET /api/v1/listings` provides public search, filter, sort, and pagination.
- `GET /api/v1/listings/:listingId` provides public-safe listing detail and an
  ordered image gallery.

Neither route requires authentication or an application profile. Supplying a
valid TENANT or LANDLORD session does not broaden visibility. Invalid queries
use the standard `VALIDATION_ERROR` envelope. Non-public, archived-property,
unknown, and otherwise unavailable detail IDs use privacy-preserving
`404 LISTING_NOT_FOUND` responses.

## Eligibility

The purpose-built public repository always requires both:

```text
listings.status = ACTIVE
properties.archived_at IS NULL
```

The ACTIVE and archive predicates are present in both search and detail query
paths. DRAFT, PENDING_REVIEW, PAUSED, RENTED, and CLOSED listings never enter a
public serializer. Guessed listing UUIDs do not bypass eligibility.

## Filters

Implemented filters and semantics:

- `district`, `locality`, and `neighbourhood`: bounded, case-insensitive exact
  structured-location matches.
- `property_type`: allowlisted APARTMENT, HOUSE, STUDIO, ROOM, TOWNHOUSE, VILLA,
  or OTHER.
- `min_rent` and `max_rent`: inclusive non-negative PostgreSQL numeric bounds;
  a combined range must have `min_rent <= max_rent`.
- `bedrooms`: inclusive minimum integer.
- `bathrooms`: inclusive minimum with at most one decimal place.
- `furnished` and `pets_allowed`: strict `true` or `false` only.
- `available_from`: listing availability on or before the requested ISO date.

Unknown fields, invalid property types, arbitrary boolean strings, malformed
dates, invalid ranges, and out-of-bound numbers are rejected. User input is not
used to construct SQL columns, operators, or sort fragments.

## Sorting

Supported sorts are:

- `newest`: `published_at DESC` and the default.
- `rent_low`: `monthly_rent ASC`.
- `rent_high`: `monthly_rent DESC`.
- `available_soon`: `available_from ASC`.

Every ordering ends with listing UUID as a stable tie-breaker. Arbitrary column
names and unrecognized sort values are rejected.

## Pagination

Search defaults to page 1 and limit 20, with a maximum limit of 100. Invalid,
negative, zero, and excessive values are rejected. Responses contain:

```json
{
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "total_pages": 0
  }
}
```

The total is calculated against the same ACTIVE, non-archived, filtered query
used for the result page.

## Public Serialization

Separate public card and detail serializers build allowlisted response objects.
They explicitly exclude:

- `address_line_1` and `address_line_2`;
- latitude and longitude;
- landlord IDs, profile/user IDs, email, and phone;
- property ownership IDs and internal listing/property relationships;
- verification evidence, notes, and private moderation data; and
- raw Storage paths or joined database records.

Public location is limited to district, locality, and neighbourhood. The only
verification presentation is a boolean property-information indicator that is
true exclusively when the stored property verification status is VERIFIED.

## Images

The `property-images` bucket remains private. The backend first resolves an
eligible ACTIVE listing on a non-archived property and only then queries and
signs its images. Search signs only the cover image. Detail signs all eligible
property images in deterministic `display_order`, `created_at`, then UUID order.

Presentation URLs retain the existing 15-minute lifetime and are never stored
in PostgreSQL. Search degrades a failed cover signature to
`cover_image_url: null`; detail omits an individual image whose signature cannot
be created. Non-public, archived, and unlisted properties cannot use these
routes as signing oracles.

## Frontend

The public frontend now includes:

- `/listings`, available while logged out or logged in;
- URL-backed structured filters with explicit search submission and clear
  filters;
- a compact mobile filter toggle and always-visible responsive desktop panel;
- allowlisted sorting and previous/next pagination;
- platform result counts and responsive public listing cards;
- consistent Mauritian Rupee and date formatting;
- cover-image fallback, loading skeletons, empty guidance, safe API errors, and
  retry controls;
- `/listings/:listingId` with ordered responsive images, approximate location,
  rent, key facts, availability, rental conditions, description, and safe trust
  copy; and
- a reusable public header with an obvious Browse rentals link.

Semantic headings, labels, actual buttons and links, keyboard focus styles,
meaningful image alternatives, text status feedback, reduced-motion handling,
touch-sized controls, and layouts without essential horizontal scrolling
address accessibility and mobile requirements. No Apply or Save control was
added prematurely.

## Hosted Supabase Verification

The new real hosted public-search verifier passed 9/9 checks:

- anonymous search returned only ACTIVE, non-archived fixtures;
- all structured filters worked against hosted PostgreSQL;
- sorting was allowlisted and deterministic;
- pagination returned stable results and exact metadata;
- public detail excluded private fields and produced working signed image URLs;
- PENDING_REVIEW, PAUSED, CLOSED, and archived-property ACTIVE detail remained
  hidden;
- anonymous, real TENANT, and real LANDLORD callers received identical public
  visibility;
- unsigned Storage and direct publishable-key listing/property/image reads
  remained denied; and
- signed URLs remained presentation-only and were not persisted.

ACTIVE listings were inserted only through trusted, cleanup-scoped integration
setup using the existing backend-only privileged client. No application route,
admin backdoor, or landlord PENDING_REVIEW-to-ACTIVE transition was added.

All hosted regressions passed:

- Database catalog, constraints, indexes, and RLS: 9/9.
- Authentication and JWT verification: 10/10.
- Tenant/Landlord profiles: 7/7.
- Property management: 8/8.
- Private property images and Storage: 11/11.
- Landlord listing management: 10/10.
- Public search and discovery: 9/9.

Total hosted checks: 64/64 passed. Fixtures used unique identifiers and were
removed afterward. No credential or environment value is included here.

## Database Changes

None. Existing TASK-001 listing status, rent, availability, and property
location indexes were sufficient. No migration was added or edited. RLS remains
enabled and deny-by-default with no application-table policies.

## Tests

Tests added:

- 45 backend public eligibility, filtering, validation, sorting, pagination,
  authentication-independence, privacy, image-scope, fallback, and detail cases.
- 11 frontend public search, URL filter, sorting, pagination, loading, empty,
  error, mobile-filter, detail, privacy, and unavailable-listing cases.
- One cleanup-safe real hosted public-search verifier with 9 checks.

Tests run:

- Frontend Vitest: 61.
- Backend Vitest: 276.
- Embedded PostgreSQL: 15 runtime checks, plus static inspection of 5
  migrations and 21 application tables.
- Hosted Supabase: 64 checks across all completed foundations.

Tests passed: all 337 frontend/backend tests, all local database checks, and all
64 hosted checks.

Tests failed: 0.

Tests skipped: 0.

## Root Verification

- `npm run lint` — passed.
- `npm run test` — passed.
- `npm run build` — passed.
- `npm run format:check` — passed.
- `git diff --check` — passed; informational Windows line-ending notices only.
- `npm run db:verify:hosted` — passed, 9 checks.
- `npm run auth:verify:hosted` — passed, 10 checks.
- `npm run profiles:verify:hosted` — passed, 7 checks.
- `npm run properties:verify:hosted` — passed, 8 checks.
- `npm run images:verify:hosted` — passed, 11 checks.
- `npm run listings:verify:hosted` — passed, 10 checks.
- `npm run search:verify:hosted` — passed, 9 checks.

The production frontend and backend builds complete successfully. Vite reports
an informational main-bundle size warning; it does not affect correctness.

## Security

- PostgreSQL RLS is unchanged and remains deny-by-default.
- The property-images bucket remains private with no publishable-key object
  policy.
- Public browsing goes only through Node API repository/service layers.
- Purpose-built public repository projections and explicit serializers are
  used; no `SELECT *` response is returned.
- ACTIVE and non-archived eligibility precedes every public image signature.
- Exact addresses, coordinates, ownership identifiers, landlord contact data,
  evidence, and Storage paths are absent from public responses.
- The frontend contains no direct core-table or private Storage access.
- No password, token, Supabase key, integration credential, or environment
  value was committed or included in this report.

## Dependencies Added

None. Existing React, Express, Zod, Supabase, and native fetch infrastructure
were sufficient.

## Documentation Updated

- `docs/API_SPEC.md` now defines public eligibility, every filter, sort,
  pagination, serializer, privacy, detail, and image-fallback contract.
- `docs/SECURITY.md` now documents eligibility-gated public image signing while
  retaining the private bucket and deny-by-default access model.
- This completion report records implementation and verification evidence.

## Known Limitations

- Saved listings are deferred to TASK-008.
- Application questions are deferred.
- Rental applications are deferred.
- Keyword and full-text search are deferred.
- Personalized or recommendation ranking is deferred.
- Admin approval from PENDING_REVIEW to ACTIVE remains a future controlled
  workflow; TASK-007 adds no approval capability.
- Responsive image variants and route-level frontend code splitting remain
  future performance improvements.

## Recommended Next Task

TASK-008 — Saved Listings.

TASK-008 was not started.
