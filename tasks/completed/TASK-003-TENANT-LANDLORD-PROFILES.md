# TASK-003 Completion Report — Tenant & Landlord Profiles

## Summary

Implemented role-specific Tenant and Landlord profile foundations on top of the
existing verified Supabase authentication, application-profile authorization,
ACTIVE-account enforcement, privileged backend data layer, and deny-by-default
RLS posture. The feature includes lazy/idempotent role-profile initialization,
strict role and ownership boundaries, safe serializers, validation, frontend
profile pages, and real hosted Supabase verification.

## Tenant Profile

- `GET /api/v1/tenant/profile` resolves or safely initializes the authenticated
  TENANT's role profile.
- `PATCH /api/v1/tenant/profile` accepts only occupation, employer/school,
  broad income range, preferred move date, lease duration, occupants, pets, and
  bio.
- `PATCH /api/v1/profile` provides one shared allowlisted path for base name and
  phone edits.
- Text lengths, ISO calendar dates, positive lease duration, minimum occupant
  count, nullable optional fields, and non-empty patches are validated with
  strict Zod schemas.
- Responses omit internal role-profile IDs, ownership IDs, and timestamps.

Initialization first checks the authoritative `profiles.role`, then uses the
existing unique `tenant_profiles.user_id` constraint. A concurrent duplicate
insert is recovered by re-reading the winning row, making initialization
idempotent and race-safe.

## Preferred Locations

- `GET /api/v1/tenant/preferred-locations`
- `POST /api/v1/tenant/preferred-locations`
- `DELETE /api/v1/tenant/preferred-locations/:id`

District, locality, and neighbourhood are trimmed and bounded; at least one
must be meaningful. Ownership is derived from the verified auth user through
their tenant profile. Deletes are scoped by both location ID and owned tenant
profile ID, returning `PREFERRED_LOCATION_NOT_FOUND` for absent or foreign
records. Obvious per-tenant duplicates are compared case-insensitively and
return HTTP 409 `CONFLICT`.

## Landlord Profile

- `GET /api/v1/landlord/profile` safely initializes the LANDLORD role row and
  returns first name, last name, phone, and verification status.
- `PATCH /api/v1/landlord/profile` updates only first name, last name, and
  phone through the shared base-profile repository logic.
- `verification_status` is display-only and cannot be assigned by the client.

## Role Security

- TENANT cannot access Landlord profile endpoints.
- LANDLORD cannot access Tenant profile or preferred-location endpoints.
- Matching role is checked by reusable middleware and again at the profile
  service initialization boundary.
- Cross-role role-profile creation is therefore impossible through these APIs.
- The immutable application role remains sourced from `public.profiles.role`;
  no TASK-003 route changes it or trusts request data/user metadata for access.
- SUSPENDED and DELETED accounts are rejected before role-profile operations.

## Mass Assignment

Strict schemas reject `id`, `user_id`, `created_at`, `updated_at`, `role`,
`account_status`, `phone_verified`, `verification_status`, tenant ownership
IDs, and all other unknown fields. Automated tests verify these boundaries and
confirm rejected input cannot alter stored role, ownership, or verification
state.

## Frontend

- Added protected `/tenant/profile` and `/landlord/profile` routes with safe
  wrong-role redirects.
- Tenant UI is split into Personal details, Rental preferences, and Preferred
  locations sections, including add/remove behavior and privacy/context copy.
- Landlord UI provides base-field editing and precise read-only verification
  status copy.
- `/account` links to the correct role-specific page without becoming a
  dashboard.
- Forms are labelled, keyboard-operable, mobile-first and single-column at
  narrow widths, use appropriate input types, visible focus, loading/empty/error
  states, and readable server validation messages.

## Files Created

- `backend/src/controllers/profileController.js`
- `backend/src/repositories/roleProfileRepository.js`
- `backend/src/routes/profileRoutes.js`
- `backend/src/services/profileService.js`
- `backend/src/validators/profileValidators.js`
- `backend/scripts/verify-hosted-profiles.mjs`
- `backend/tests/helpers/createProfileTestContext.js`
- `backend/tests/integration/profileRoutes.test.js`
- `backend/tests/unit/profileService.test.js`
- `frontend/src/pages/profile/TenantProfilePage.jsx`
- `frontend/src/pages/profile/LandlordProfilePage.jsx`
- `frontend/src/services/roleProfileService.js`
- `frontend/tests/pages/RoleProfiles.test.jsx`

## Files Modified

- `backend/src/app.js`
- `backend/src/repositories/profileRepository.js`
- `backend/src/routes/index.js`
- `frontend/src/App.jsx`
- `frontend/src/components/auth/ProtectedRoute.jsx`
- `frontend/src/pages/account/AccountPage.jsx`
- `frontend/src/services/apiClient.js`
- `frontend/src/styles.css`
- `docs/API_SPEC.md`
- `package.json`

## Database Changes

None. The TASK-001 tables, foreign keys, checks, unique role-profile user IDs,
and deny-by-default RLS contract were sufficient. No migration or RLS policy
was added or modified.

## Real Supabase Verification

The ignored developer-controlled TENANT and LANDLORD identities were used from
local environment configuration without printing credentials.

- TASK-003 hosted profile verifier: 7/7 checks passed.
- Existing hosted authentication verifier: 10/10 checks passed.
- Hosted database catalog verifier: 9/9 checks passed.
- Real checks covered role initialization/idempotency, cross-role rejection,
  real bearer JWTs, Tenant updates, structured location CRUD and ownership,
  Landlord verification protection, suspension, direct publishable/user RLS
  denial, logout/login, and existing auth escalation protections.
- Temporary integration data and account status were restored by cleanup logic.

## Tests Added

Added backend integration/unit coverage for initialization, race recovery,
ownership, role boundaries, ACTIVE/SUSPENDED/DELETED enforcement, validation,
all protected fields, preferred-location CRUD/duplicates, safe responses, and
Landlord verification protection. Added frontend coverage for route protection,
role redirects, loading profile data, authenticated submission, validation
errors, location add/delete, empty state, and read-only verification display.

Final automated totals:

- Frontend: 19 tests passed.
- Backend: 73 tests passed.
- Database: 5 migrations statically checked and 15 embedded runtime checks
  passed.
- Total frontend/backend tests: 92 passed, 0 failed, 0 skipped.

## Root Verification

- `npm run lint` — passed
- `npm run test` — passed
- `npm run build` — passed
- `npm run format:check` — passed
- `git diff --check` — passed (line-ending notices only)
- `npm run db:verify:hosted` — passed, 9 checks
- `npm run auth:verify:hosted` — passed, 10 checks
- `npm run profiles:verify:hosted` — passed, 7 checks

## Security Notes

- Identity and ownership always derive from the verified Supabase token.
- Application role remains authoritative in `public.profiles`; request roles
  and Supabase user metadata are not trusted.
- Privileged database operations occur only after authentication, profile,
  ACTIVE-status, role, validation, and ownership checks.
- Direct publishable/user database access remains denied by RLS.
- No secret, password, token, or credential was added to code, logs, reports,
  or version control. Local environment files remain ignored.
- No property, listing, application, messaging, viewing, verification approval,
  admin, or TASK-004 functionality was implemented.

## Dependencies Added

None for TASK-003.

## Documentation Updated

`docs/API_SPEC.md` now clarifies lazy role-profile initialization, the shared
base-profile update contract, strict role-specific assignment, preferred
location duplicate/ownership behavior, and Landlord verification protection.

## Known Limitations

- Preferred-location duplicate prevention is service-level because the current
  nullable structured columns do not have a database uniqueness constraint. It
  prevents normal repeated submissions, but simultaneous identical requests
  could race. No migration was justified for this foundation task.
- Responsive behavior is enforced by mobile-first CSS and component tests; no
  separate visual browser/device matrix was available in this environment.
- Landlord verification workflows and detailed role profiles remain explicitly
  outside TASK-003.

## Recommended Next Task

TASK-004 — Properties & Listing Foundation. Do not begin it automatically.
