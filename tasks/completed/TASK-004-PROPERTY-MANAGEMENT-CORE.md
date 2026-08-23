# TASK-004 Completion Report — Property Management Core

## Summary

Implemented the landlord-only physical property management foundation. ACTIVE
LANDLORD accounts can create, paginate/filter, view, edit, and soft-archive
their own properties through the Node API and protected React screens. Property
ownership is derived from the verified Supabase identity and the matching
`landlord_profiles` row; no client owner identifier is trusted.

The implementation deliberately excludes images, listings, rent, deposits,
availability, search, applications, viewings, messaging, and administration.

## Backend API

- `POST /api/v1/properties` creates an owned physical property and returns 201.
- `GET /api/v1/landlord/properties` returns only owned properties with `page`,
  `limit`, `archived`, and pagination metadata.
- `GET /api/v1/properties/:propertyId` returns an owned private management
  record, including the owner's exact address fields.
- `PATCH /api/v1/properties/:propertyId` performs strict partial updates on
  editable physical-property fields.
- `POST /api/v1/properties/:propertyId/archive` sets `archived_at` without hard
  deletion.

All endpoints reuse the established bearer-token verification, application
profile loading, ACTIVE-account enforcement, and `requireRole('LANDLORD')`
middleware before reaching the property controller/service/repository stack.

## Ownership

The backend resolves ownership as:

```text
verified Supabase user ID
→ public.profiles role check
→ landlord_profiles.user_id
→ landlord_profiles.id
→ properties.landlord_id
```

Create requests pass the resolved landlord-profile ID directly to the
repository. Get, update, and archive queries include both `property.id` and the
resolved `landlord_id`. Lists filter by that landlord ID before pagination.
Missing and foreign properties return the same privacy-preserving HTTP 404
`PROPERTY_NOT_FOUND` response.

Cross-landlord GET, PATCH, and archive protections are covered locally and
against hosted Supabase.

## Validation

Strict Zod validation enforces:

- Approved types: APARTMENT, HOUSE, STUDIO, ROOM, TOWNHOUSE, VILLA, OTHER.
- Required nonblank district and locality.
- Integer bedrooms and parking spaces greater than or equal to zero.
- Numeric bathrooms greater than or equal to zero, including half-bath values.
- Latitude from -90 to 90 and longitude from -180 to 180 when provided.
- Boolean furnished values.
- Trimmed addresses and location text with the approved size bounds.
- UUID route parameters.
- Page and limit as positive integers, limit capped at 100, and strict archived
  boolean query semantics.
- At least one editable field for PATCH.

Create defaults `furnished` to false and `parking_spaces` to zero when omitted.

## Mass Assignment

Route schemas reject unknown fields. Service-level allowlisting provides a
second boundary before repository calls. Tests explicitly reject attempts to
assign `id`, `landlord_id`, `user_id`, `owner_id`, `verification_status`,
`archived_at`, `created_at`, and `updated_at`. Property serializers omit
`landlord_id` from API output because the frontend does not require it.

## Archive Behavior

Archiving is a soft update to `archived_at`; no DELETE or restore endpoint was
added. Repeated archive requests return the existing record and preserve the
original timestamp. A concurrent archive race re-reads the owned record rather
than replacing its timestamp. Normal PATCH on an archived property returns HTTP
409 with code `PROPERTY_ARCHIVED`.

The service is structured so a future listing task can add a live-listing guard.
No listing lookup was introduced prematurely in TASK-004.

## Frontend

- `/landlord/properties` provides active/archived filters, responsive property
  cards, pagination, loading/error/retry states, the required empty state, and
  View/Edit/Archive actions where valid.
- `/landlord/properties/new` provides a mobile-first form grouped into Property
  basics, Location, and Features.
- `/landlord/properties/:propertyId` provides private detail display, inline edit
  mode, precise verification status, archived state, not-found handling, and
  archive confirmation.
- The account foundation page links LANDLORD users to property management.
- All three routes use the existing role-aware protected-route infrastructure;
  unauthenticated users go to login and TENANT users are redirected safely.
- Forms use labels, required-field indicators, semantic controls, appropriate
  number/checkbox input types, keyboard-accessible actions, visible focus,
  field-level errors, and single-column mobile layouts.

The property UI does not display or collect rent, deposits, availability,
listing status, listing descriptions, images, or applicant information.

## Hosted Supabase Verification

The real development project was verified using only ignored
developer-controlled integration configuration. No credentials or token values
were printed or stored.

TASK-004 property verifier: 8/8 checks passed:

- LANDLORD created a property with server-derived ownership.
- Owned active property appeared in the landlord list and private detail read.
- Editable fields updated and protected fields failed validation.
- TENANT property creation returned 403.
- Foreign-owner GET, PATCH, and archive returned 404.
- Archive was idempotent, archived filtering worked, and later editing returned
  `PROPERTY_ARCHIVED`.
- SUSPENDED LANDLORD access returned 403 and the controlled account was restored.
- Anonymous and authenticated publishable-key database reads remained empty
  under deny-by-default RLS.

The verifier used uniquely identified records and privileged cleanup scoped to
those exact IDs. It did not remove developer-created marketplace data.

Regression hosted verification also passed:

- Database catalog/RLS: 9/9 checks.
- Authentication: 10/10 checks.
- Tenant/Landlord profiles: 7/7 checks.

## Database Changes

None. The existing `properties` schema, `landlord_profiles` foreign key,
constraints, indexes, timestamp trigger, and RLS posture satisfy TASK-004. No
migration or RLS policy was added or modified.

## Tests

Tests added:

- 46 backend property integration cases.
- 10 frontend property management cases.
- A reproducible real hosted property integration verifier with cleanup.

Tests run:

- Frontend Vitest suite: 29.
- Backend Vitest suite: 119.
- Embedded database runtime checks: 15, plus static verification of 5 migrations
  and all 21 application tables.
- Hosted checks: 34 across property, profile, auth, and database verifiers.

Tests passed: all 148 frontend/backend tests, all database checks, and all 34
hosted checks.

Tests failed: 0.

Tests skipped: 0.

## Root Verification

- `npm run lint` — passed.
- `npm run test` — passed.
- `npm run build` — passed.
- `npm run format:check` — passed.
- `git diff --check` — passed; informational Windows line-ending notices only.
- `npm run properties:verify:hosted` — passed, 8 checks.
- `npm run profiles:verify:hosted` — passed, 7 checks.
- `npm run auth:verify:hosted` — passed, 10 checks.
- `npm run db:verify:hosted` — passed, 9 checks.

## Files Created

- `backend/src/controllers/propertyController.js`
- `backend/src/repositories/propertyRepository.js`
- `backend/src/routes/propertyRoutes.js`
- `backend/src/serializers/propertySerializer.js`
- `backend/src/services/propertyService.js`
- `backend/src/validators/propertyValidators.js`
- `backend/scripts/verify-hosted-properties.mjs`
- `backend/tests/helpers/createPropertyTestContext.js`
- `backend/tests/integration/propertyRoutes.test.js`
- `frontend/src/components/property/PropertyForm.jsx`
- `frontend/src/pages/property/CreatePropertyPage.jsx`
- `frontend/src/pages/property/PropertyDetailPage.jsx`
- `frontend/src/pages/property/PropertyListPage.jsx`
- `frontend/src/services/propertyService.js`
- `frontend/tests/pages/Properties.test.jsx`

## Files Modified

- `backend/src/app.js`
- `backend/src/routes/index.js`
- `backend/src/validators/validateRequest.js`
- `backend/tests/helpers/createProfileTestContext.js`
- `frontend/src/App.jsx`
- `frontend/src/pages/account/AccountPage.jsx`
- `frontend/src/services/apiClient.js`
- `frontend/src/styles.css`
- `docs/API_SPEC.md`
- `package.json`

## Dependencies Added

None.

## Security

- Landlord ownership is entirely backend-derived and enforced in owner-scoped
  persistence queries.
- The application role and ACTIVE status remain authoritative in the backend.
- RLS remains enabled with no broad application-table policies.
- `verification_status`, ownership, archive, IDs, and timestamps are protected.
- Exact property addresses are returned only through private owner management
  endpoints; no public property endpoint was added.
- No password, access token, secret key, integration credential, or environment
  value was printed, exposed to frontend code, or committed. Environment files
  remain ignored.

## Known Limitations

- Property images are deferred to TASK-005.
- Listings, including rent, deposits, availability, publication, and the
  live-listing archive guard, are deferred to TASK-006.
- Property restore/unarchive is not part of the approved API.
- Coordinates are optional manual values; maps and geocoding are intentionally
  absent.

## Recommended Next Task

TASK-005 — Property Images. Do not begin it automatically.
