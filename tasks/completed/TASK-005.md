# TASK-004 — Property Management Core

## Status

READY

## Priority

P0 — Core Marketplace

## Objective

Implement landlord property-management functionality for the Mauritius Rental Platform.

This task covers the physical property record only.

Landlords must be able to:

- create a property
- list their own properties
- view one of their own properties
- edit one of their own properties
- archive one of their own properties

This task does NOT include:

- property image uploads
- listings
- rental pricing
- applications
- search
- messaging
- viewings

Those belong to later tasks.

---

# 1. Required Reading

Before coding, read:

docs/PRODUCT_SPEC.md
docs/ARCHITECTURE.md
docs/DATABASE.md
docs/API_SPEC.md
docs/SECURITY.md
docs/DEVELOPMENT_RULES.md
docs/TESTING.md
docs/ROADMAP.md
docs/UI_RULES.md
docs/AUTH_SETUP.md
database/README.md
tasks/CURRENT_TASK.md

Inspect all completed TASK-000 through TASK-003 implementation.

Reuse the existing:

- authentication middleware
- application profile loading
- ACTIVE-account enforcement
- role middleware
- Supabase repository/configuration patterns
- API response conventions
- validation patterns
- frontend API client
- protected routing

Do not rebuild these foundations.

---

# 2. Domain Model

A Property is the physical rental asset.

A Property is NOT a Listing.

Property contains information such as:

- type
- physical location
- bedrooms
- bathrooms
- furnishing
- parking

Listing contains rental-cycle information such as:

- monthly rent
- deposit
- availability
- description
- publication status

TASK-004 must preserve this distinction.

---

# 3. Existing Database Table

Use the existing:

properties

table.

Fields:

id
landlord_id
property_type
address_line_1
address_line_2
district
locality
neighbourhood
latitude
longitude
bedrooms
bathrooms
furnished
parking_spaces
verification_status
archived_at
created_at
updated_at

Do not modify the schema unless a genuine correctness issue is discovered.

---

# 4. Property Types

Approved values:

APARTMENT
HOUSE
STUDIO
ROOM
TOWNHOUSE
VILLA
OTHER

Backend validation must enforce the approved values.

Do not trust arbitrary client values.

---

# 5. Verification Status

Property verification status:

UNVERIFIED
PENDING
VERIFIED
REJECTED

TASK-004 only displays the current value where appropriate.

Landlords must NEVER be able to directly change:

verification_status

through property create/edit endpoints.

---

# 6. Required API Endpoints

Implement:

POST  /api/v1/properties
GET   /api/v1/landlord/properties
GET   /api/v1/properties/:propertyId
PATCH /api/v1/properties/:propertyId
POST  /api/v1/properties/:propertyId/archive

Authentication:

required

Account:

ACTIVE

Role:

LANDLORD

---

# 7. Create Property

Endpoint:

POST /api/v1/properties

Request example:

{
  "property_type": "APARTMENT",
  "address_line_1": "Example Street",
  "address_line_2": null,
  "district": "Moka",
  "locality": "Moka",
  "neighbourhood": null,
  "latitude": -20.230,
  "longitude": 57.500,
  "bedrooms": 2,
  "bathrooms": 1,
  "furnished": true,
  "parking_spaces": 1
}

Backend must:

1. verify Supabase identity
2. load application profile
3. require ACTIVE
4. require LANDLORD
5. resolve authenticated user's landlord_profiles row
6. validate input
7. derive landlord_id server-side
8. create property
9. return explicit safe response

Expected:

201 Created

---

# 8. Landlord Identity

Never accept ownership authority from:

landlord_id
user_id
owner_id

in the request.

Property ownership must be derived from:

authenticated user
→ landlord_profiles
→ landlord_id

Strict validation should reject protected ownership fields where practical.

---

# 9. Lazy Landlord Profile

TASK-003 already provides landlord-profile initialization.

Reuse it.

Do not create an alternative landlord-profile creation mechanism inside property logic.

---

# 10. Required Fields

Required:

property_type
district
locality
bedrooms
bathrooms

Optional:

address_line_1
address_line_2
neighbourhood
latitude
longitude
furnished
parking_spaces

Existing database requirements remain authoritative.

---

# 11. Validation

At minimum enforce:

property_type approved
district non-empty
locality non-empty

bedrooms integer >= 0

bathrooms numeric >= 0

parking_spaces integer >= 0

latitude between -90 and 90

longitude between -180 and 180

when coordinates are provided.

Text values must:

- be trimmed
- have reasonable maximum lengths
- reject meaningless empty strings where required

---

# 12. Suggested Text Limits

Unless existing validation conventions establish other reasonable limits:

address_line_1 <= 250
address_line_2 <= 250
district <= 100
locality <= 150
neighbourhood <= 150

Do not add excessive restrictions that interfere with real Mauritius addresses.

---

# 13. Furnished

furnished is:

BOOLEAN

Default:

false

Do not represent this through ambiguous strings such as:

"yes"
"no"

at API level.

---

# 14. Bathrooms

The schema allows:

NUMERIC(3,1)

so values such as:

1
1.5
2

are valid where appropriate.

Do not force bathrooms to integer-only if the database explicitly supports half-bath values.

---

# 15. List Landlord Properties

Endpoint:

GET /api/v1/landlord/properties

Return only properties owned by the authenticated landlord.

Support:

page
limit
archived

Recommended:

?page=1
&limit=20
&archived=false

Default:

page = 1
limit = 20
archived = false

Maximum:

limit = 100

---

# 16. List Response

Use:

{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "total_pages": 0
  }
}

Do not return properties from other landlords.

---

# 17. Archived Filtering

Recommended semantics:

archived=false

returns:

archived_at IS NULL

archived=true

returns:

archived_at IS NOT NULL

If parameter is absent:

default to active/non-archived properties.

Do not invent another property status field.

---

# 18. Get One Property

Endpoint:

GET /api/v1/properties/:propertyId

This is a LANDLORD MANAGEMENT endpoint.

It is NOT the future public property/listing endpoint.

Backend must verify:

authenticated landlord owns property.

---

# 19. Ownership Privacy

For another landlord's property, prefer privacy-preserving:

404 PROPERTY_NOT_FOUND

rather than confirming:

"The property exists but belongs to someone else."

Use this approach consistently for property ownership endpoints if consistent with existing project error conventions.

---

# 20. Property Response

Use an explicit serializer.

May include:

id
property_type
address_line_1
address_line_2
district
locality
neighbourhood
latitude
longitude
bedrooms
bathrooms
furnished
parking_spaces
verification_status
archived_at
created_at
updated_at

This endpoint is private landlord management, so exact address may be included for the owner.

Do not expose landlord_id unless frontend actually requires it.

---

# 21. Update Property

Endpoint:

PATCH /api/v1/properties/:propertyId

Only the owner may update.

Editable fields:

property_type
address_line_1
address_line_2
district
locality
neighbourhood
latitude
longitude
bedrooms
bathrooms
furnished
parking_spaces

Protected:

id
landlord_id
verification_status
archived_at
created_at
updated_at

---

# 22. Partial Update

PATCH must support partial updates.

Do not require the client to resend the entire property.

However:

the resulting record must remain valid.

Strict validation should reject unknown/protected fields.

---

# 23. Archived Property Editing

Recommended V1 behavior:

an archived property should not be editable through normal PATCH.

Return:

409 Conflict

with a stable code such as:

PROPERTY_ARCHIVED

This avoids changing historical records accidentally.

If existing product rules strongly imply another behavior, document the choice.

---

# 24. Archive Property

Endpoint:

POST /api/v1/properties/:propertyId/archive

Only owner may archive.

Set:

archived_at = current timestamp

Do not hard delete the property.

---

# 25. Archive Idempotency

Recommended:

Archiving an already archived property should be idempotent.

Return the existing archived property rather than creating an error.

Do not repeatedly change archived_at on each request.

Preserve original archive timestamp.

---

# 26. Active Listing Check

TASK-004 runs before listing implementation.

Do not implement listing logic prematurely.

However, structure the property service so TASK-006 can later introduce:

"cannot archive property while live listing exists"

without major redesign.

For now, if no listing workflow exists yet, archive may proceed.

Document this temporary limitation.

---

# 27. No Restore Yet

Do not implement:

restore property
unarchive property

unless it already exists in approved API documentation.

That can be added later if product testing shows need.

---

# 28. No Hard Delete

Do not implement:

DELETE /properties/:propertyId

Normal user behavior uses:

archive

Historical relationships must remain intact.

---

# 29. Backend Structure

Follow:

Route
→ Middleware
→ Controller
→ Service
→ Repository
→ Database

Recommended modules:

propertyRoutes.js
propertyController.js
propertyService.js
propertyRepository.js
propertyValidators.js
propertySerializer.js

Exact naming may follow current project conventions.

---

# 30. Middleware

Reuse:

authenticateUser
loadApplicationProfile
requireActiveAccount
requireRole('LANDLORD')

Do not duplicate authentication logic.

---

# 31. Ownership Enforcement

Ownership belongs in backend service/repository workflow.

Required logic concept:

authenticated user
→ landlord profile
→ query property where
   property.id = requested id
   AND
   property.landlord_id = authenticated landlord profile id

Do not fetch unrestricted property then trust frontend ownership.

---

# 32. Repository Query Safety

Prefer owner-scoped queries.

Example concept:

findByIdForLandlord(propertyId, landlordProfileId)

rather than controller logic that retrieves any property globally.

---

# 33. Mass Assignment Tests

Explicitly attempt:

{
  "landlord_id": "another-landlord"
}

{
  "verification_status": "VERIFIED"
}

{
  "archived_at": "..."
}

{
  "id": "..."
}

These must not modify protected state.

Strict Zod validation should ideally reject them.

---

# 34. Cross-Landlord Security Tests

Create/use:

Landlord A
Landlord B

Property belongs to Landlord B.

Verify Landlord A cannot:

GET
PATCH
ARCHIVE

Landlord B's property.

This is mandatory.

---

# 35. Wrong Role Tests

TENANT must not:

POST property
GET landlord properties
GET management property
PATCH property
ARCHIVE property

Expected:

403

---

# 36. Account Status Tests

SUSPENDED landlord:

blocked

DELETED landlord:

blocked

A valid Supabase authentication token must not bypass account status.

---

# 37. Validation Tests

Required examples:

invalid property_type
negative bedrooms
negative bathrooms
negative parking_spaces
latitude > 90
latitude < -90
longitude > 180
longitude < -180
empty district
empty locality
invalid UUID
oversized strings

---

# 38. Pagination Tests

Test:

default page
default limit
maximum limit
invalid negative page
invalid zero page
oversized limit
correct total
correct total_pages

---

# 39. Frontend Routes

Implement landlord property management foundation:

/landlord/properties
/landlord/properties/new
/landlord/properties/:propertyId

Do not create public listing/property pages.

---

# 40. Property List UI

/landlord/properties

Show:

property type
location
bedrooms
bathrooms
furnished
archived state where applicable

Actions:

View
Edit where allowed
Archive where allowed

Do not show:

rent
applications
listing status

because listings do not exist yet.

---

# 41. Empty State

Example:

No properties yet

Add your first property to prepare it for a future rental listing.

Button:

Add property

---

# 42. Create Property Page

Route:

/landlord/properties/new

Organize according to UI_RULES:

Property basics
Location
Features

Do not include photos yet.

Property images are TASK-005.

Do not include:

monthly rent
deposit
available date
listing title
listing description

These belong to listings.

---

# 43. Property Form Fields

Include:

Property type

Address line 1
Address line 2

District
Locality
Neighbourhood

Latitude
Longitude

Bedrooms
Bathrooms

Furnished
Parking spaces

Coordinates may be optional.

Do not integrate maps/geocoding yet.

---

# 44. Mauritius Location UX

Keep structured text inputs/selects simple.

Do not introduce an external geolocation API.

Do not build a complete Mauritius geographic database in TASK-004 unless one already exists in project scope.

---

# 45. Property Detail Page

Route:

/landlord/properties/:propertyId

Show property details clearly.

Provide actions:

Edit
Archive

when valid.

Do not show listing/applicant functionality.

---

# 46. Edit Experience

Editing may happen:

- on the property details page
- or through a dedicated edit state/page

Choose the simplest implementation consistent with existing UI architecture.

Do not create unnecessary routing complexity.

---

# 47. Archive Confirmation

Archiving is a meaningful action.

Require confirmation.

Example:

Archive this property?

It will no longer appear in your active property list.

Button:

Archive property

---

# 48. Frontend Error States

Handle:

loading
empty
validation failure
API unavailable
property not found
forbidden/wrong role
archived property

Do not build only happy path.

---

# 49. Frontend API Service

Create:

propertyService.js

or equivalent.

Do not scatter raw fetch calls across property components.

Reuse existing authenticated API client.

---

# 50. Frontend Route Security

Only LANDLORD may access:

/landlord/properties
/landlord/properties/new
/landlord/properties/:propertyId

TENANT should be redirected/denied appropriately.

Backend remains authoritative.

---

# 51. Responsive Design

Property forms and list must work on mobile.

Use:

single-column forms on mobile.

No horizontal scrolling for primary tasks.

---

# 52. Accessibility

Use:

proper labels
semantic buttons
keyboard-accessible forms
visible focus
accessible validation errors
clear archive confirmation

Do not use clickable divs for actions.

---

# 53. RLS

Do not weaken existing deny-by-default RLS.

Property operations continue through the Node API.

Do not create direct frontend table writes.

---

# 54. Real Supabase Verification

Run relevant property integration tests against the configured development Supabase project.

Use integration accounts through ignored configuration.

Do not print credentials.

At minimum verify against hosted Supabase:

- landlord creates property
- landlord lists own property
- landlord retrieves it
- landlord updates it
- landlord archives it
- another landlord cannot access it
- tenant cannot create property

---

# 55. Test Data Cleanup

Hosted integration tests must avoid polluting the development database excessively.

Use clearly identifiable integration records.

Delete test records only where doing so does not contradict normal product behavior and where cleanup is safe.

Alternatively use transactional/controlled cleanup tooling.

Do not delete real developer-created marketplace data.

---

# 56. Database Migrations

Expected:

none

If implementation requires a schema correction:

create a NEW migration.

Do not edit TASK-001 migrations.

Explain any migration.

---

# 57. No Images

Do NOT implement:

Supabase Storage property upload
property_images API
cover image
image ordering

These belong to:

TASK-005.

---

# 58. No Listings

Do NOT implement:

listing creation
monthly rent
deposit amount
availability
publication
listing status
search

These belong to later tasks.

---

# 59. Documentation

Update:

docs/API_SPEC.md

only if needed to clarify property endpoint behavior.

Update relevant docs when implementation materially changes an approved contract.

Do not rewrite unrelated documentation.

---

# 60. Required Automated Verification

Run:

npm run lint
npm run test
npm run build
npm run format:check
git diff --check

Run database verification.

Run relevant hosted Supabase property integration checks.

---

# 61. Acceptance Criteria

TASK-004 is complete only when:

- [ ] POST /api/v1/properties exists.
- [ ] Only ACTIVE LANDLORD can create.
- [ ] landlord_id is derived server-side.
- [ ] Property validation is implemented.
- [ ] Protected fields cannot be mass-assigned.
- [ ] GET /api/v1/landlord/properties exists.
- [ ] Pagination works.
- [ ] Archived filtering works.
- [ ] Only own properties are returned.
- [ ] GET /api/v1/properties/:propertyId exists.
- [ ] Property ownership is enforced.
- [ ] Cross-landlord property access fails.
- [ ] PATCH /api/v1/properties/:propertyId exists.
- [ ] Only owner can edit.
- [ ] Archived property edit is controlled.
- [ ] verification_status cannot be edited.
- [ ] landlord_id cannot be edited.
- [ ] POST /api/v1/properties/:propertyId/archive exists.
- [ ] Archive uses archived_at, not hard deletion.
- [ ] Archive is idempotent.
- [ ] TENANT cannot use landlord property APIs.
- [ ] SUSPENDED/DELETED landlord remains blocked.
- [ ] RLS remains deny-by-default.
- [ ] /landlord/properties frontend exists.
- [ ] Property creation frontend exists.
- [ ] Property detail/edit frontend exists.
- [ ] Archive confirmation exists.
- [ ] Mobile usability addressed.
- [ ] Accessibility addressed.
- [ ] Hosted Supabase property integration passes.
- [ ] Existing authentication/profile/database tests still pass.
- [ ] No property images implemented.
- [ ] No listings implemented.
- [ ] No secrets committed.

---

# 62. Completion Report

Report:

## Summary

Describe property functionality implemented.

## Backend API

Report:

POST /properties
GET /landlord/properties
GET /properties/:id
PATCH /properties/:id
POST /properties/:id/archive

## Ownership

Explain landlord ownership derivation and cross-landlord protection.

## Validation

Summarize property validation.

## Mass Assignment

Report protected-field tests.

## Archive Behavior

Explain idempotency and archived-edit behavior.

## Frontend

Report property list/create/detail/edit flows.

## Hosted Supabase Verification

Report real integration checks.

Do not reveal credentials.

## Database Changes

Expected:

none.

Explain any migration if required.

## Tests

Tests added:
Tests run:
Tests passed:
Tests failed:
Tests skipped:

## Root Verification

npm run lint
npm run test
npm run build
npm run format:check
git diff --check

## Security

Confirm:

ownership enforced
RLS unchanged
verification_status protected
no secrets exposed

## Known Limitations

Include:

property images deferred to TASK-005
listings deferred to TASK-006

and any genuine remaining limitation.

## Recommended Next Task

TASK-005 — Property Images

Then stop.

Do not begin TASK-005.