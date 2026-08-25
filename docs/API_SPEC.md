# Mauritius Rental Platform — API Specification

## Verification

Landlords may create and list their own `LANDLORD_IDENTITY` or owned-property `PROPERTY_AUTHORITY` requests through `/api/v1/landlord/verifications`. Evidence is uploaded as a private multipart file at `/:verificationId/evidence`; the backend validates and stores it under a generated path. Active ADMIN users use `/api/v1/admin/verifications` and explicit `/review`, `/approve`, and `/reject` actions. Only `VERIFIED` records contribute public `landlord_verified` or `property_authority_verified` booleans; verification is manual evidence review and is not a legal guarantee.

## Admin tools

Active ADMIN users may review listings through explicit `/admin/listings/:id/approve` and `/return-to-draft` actions, and administer users through `/admin/users` plus explicit suspend/reactivate actions. There is no generic listing-status endpoint or user deletion/impersonation API.

## 1. API Objective

The API defines the contract between:

* React frontend
* Node.js backend
* PostgreSQL/Supabase data layer

The API must enforce:

* authentication
* authorization
* ownership
* validation
* controlled workflow transitions
* consistent responses
* predictable error handling

The frontend must never be treated as a trusted authority.

---

# 2. API Style

Use REST.

Base path:

```text
/api
```

Example:

```text
GET /api/listings
```

Do not introduce GraphQL in V1.

---

# 3. API Versioning

Recommended:

```text
/api/v1
```

Example:

```text
GET /api/v1/listings
```

This allows future API evolution without breaking older clients.

Use `/api/v1` from the beginning.

---

# 4. Content Type

Use:

```http
Content-Type: application/json
```

for standard API requests and responses.

Use multipart upload only for file upload workflows when required.

---

# 5. Authentication

Use Supabase Auth.

Authenticated frontend requests must send:

```http
Authorization: Bearer <access_token>
```

The backend must validate the token.

The backend must derive the authenticated user ID from the token.

Never trust user IDs sent by the frontend for authorization.

---

# 6. Standard Success Response

Use:

```json
{
  "success": true,
  "data": {}
}
```

For lists:

```json
{
  "success": true,
  "data": [],
  "meta": {}
}
```

---

# 7. Standard Error Response

Use:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message"
  }
}
```

Validation errors may include fields:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Some fields are invalid.",
    "fields": {
      "monthly_rent": "Monthly rent must be greater than or equal to zero."
    }
  }
}
```

---

# 8. HTTP Status Codes

Use consistently.

```text
200 OK
201 Created
204 No Content

400 Bad Request
401 Unauthorized
403 Forbidden
404 Not Found
409 Conflict
422 Unprocessable Entity
429 Too Many Requests

500 Internal Server Error
```

Do not use `200` for failed operations.

---

# 9. Common Error Codes

Recommended internal codes:

```text
AUTH_REQUIRED
INVALID_TOKEN
FORBIDDEN
ROLE_REQUIRED
ONBOARDING_REQUIRED
PROFILE_ALREADY_EXISTS
ACCOUNT_SUSPENDED
ACCOUNT_DELETED
RESOURCE_NOT_FOUND

VALIDATION_ERROR
CONFLICT

PROFILE_NOT_FOUND
PROPERTY_NOT_FOUND
LISTING_NOT_FOUND
APPLICATION_NOT_FOUND
VIEWING_NOT_FOUND
CONVERSATION_NOT_FOUND
MESSAGE_NOT_FOUND
REPORT_NOT_FOUND

INVALID_LISTING_STATUS
INVALID_APPLICATION_STATUS
INVALID_APPLICATION_TRANSITION
INVALID_VIEWING_STATUS
INVALID_VIEWING_TRANSITION

DUPLICATE_APPLICATION
DUPLICATE_SAVED_LISTING
ACTIVE_LISTING_EXISTS
ACCEPTED_APPLICATION_EXISTS

UPLOAD_FAILED
FILE_TOO_LARGE
INVALID_FILE_TYPE

RATE_LIMITED
INTERNAL_ERROR
```

---

# 10. Authentication Endpoints

Supabase Auth may handle some authentication directly from the frontend.

However, the application still needs profile-related bootstrap endpoints.

Recommended endpoints:

```text
POST /api/v1/auth/register-profile
GET  /api/v1/auth/me
```

---

# 11. Register Application Profile

```http
POST /api/v1/auth/register-profile
```

Authentication:

Required.

Purpose:

Create the application `profiles` record after Supabase user registration.

Request:

```json
{
  "role": "TENANT",
  "first_name": "Jane",
  "last_name": "Doe",
  "phone": "+230..."
}
```

Allowed roles:

```text
TENANT
LANDLORD
```

Do not allow public creation of:

```text
ADMIN
```

Response:

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "role": "TENANT",
    "first_name": "Jane",
    "last_name": "Doe",
    "account_status": "ACTIVE"
  }
}
```

Status:

```text
201 Created
```

Possible errors:

```text
AUTH_REQUIRED
INVALID_TOKEN
VALIDATION_ERROR
PROFILE_ALREADY_EXISTS
```

---

# 12. Get Current User

```http
GET /api/v1/auth/me
```

Authentication:

Required.

Response:

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "role": "TENANT",
    "first_name": "Jane",
    "last_name": "Doe",
    "phone": "+230...",
    "profile_photo_url": null,
    "account_status": "ACTIVE"
  }
}
```

Possible errors:

```text
AUTH_REQUIRED
INVALID_TOKEN
ONBOARDING_REQUIRED
ACCOUNT_SUSPENDED
ACCOUNT_DELETED
```

`ONBOARDING_REQUIRED` uses HTTP 403: the Supabase identity is authenticated,
but it is not yet authorized as an application user because no `profiles` row
exists.

---

# 13. Tenant Profile Endpoints

```text
GET   /api/v1/tenant/profile
PATCH /api/v1/tenant/profile
```

Role:

```text
TENANT
```

The role-specific row is initialized lazily and idempotently from the verified
user ID. Clients do not supply a tenant profile ID or owner ID.

---

# 14. Get Tenant Profile

```http
GET /api/v1/tenant/profile
```

Response:

```json
{
  "success": true,
  "data": {
    "occupation_type": "STUDENT",
    "employer_or_school": "Example University",
    "income_range": "10000-20000",
    "preferred_move_date": "2026-09-01",
    "preferred_lease_duration_months": 12,
    "number_of_occupants": 1,
    "has_pets": false,
    "bio": "..."
  }
}
```

---

# 15. Update Tenant Profile

```http
PATCH /api/v1/tenant/profile
```

Request example:

```json
{
  "occupation_type": "STUDENT",
  "employer_or_school": "Example University",
  "preferred_move_date": "2026-09-01",
  "preferred_lease_duration_months": 12,
  "number_of_occupants": 1,
  "has_pets": false
}
```

Backend must ensure:

* authenticated user is TENANT
* tenant updates only their own profile
* positive numeric constraints hold
* only the documented role fields are assigned

Names and phone are updated separately through `PATCH /api/v1/profile`, which
accepts only `first_name`, `last_name`, and `phone` for an ACTIVE TENANT or
LANDLORD account.

---

# 16. Tenant Preferred Locations

```text
GET    /api/v1/tenant/preferred-locations
POST   /api/v1/tenant/preferred-locations
DELETE /api/v1/tenant/preferred-locations/:id
```

Role:

TENANT.

Example POST:

```json
{
  "district": "Moka",
  "locality": "Moka",
  "neighbourhood": null
}
```

At least one structured field is required. Obvious case-insensitive duplicates
for the same tenant return HTTP 409 with code `CONFLICT`. Delete operations are
scoped to the authenticated tenant; an absent or foreign location returns HTTP
404 with code `PREFERRED_LOCATION_NOT_FOUND`.

---

# 17. Landlord Profile Endpoints

```text
GET   /api/v1/landlord/profile
PATCH /api/v1/landlord/profile
```

Role:

```text
LANDLORD
```

Verification status must not be editable by the landlord.

The role-specific row is initialized lazily and idempotently. GET returns safe
base fields (`first_name`, `last_name`, `phone`) and `verification_status`.
PATCH accepts only those three base fields; attempts to submit
`verification_status` or ownership/account fields fail validation.

---

# 18. Property Endpoints

```text
POST   /api/v1/properties
GET    /api/v1/properties/:propertyId
PATCH  /api/v1/properties/:propertyId
POST   /api/v1/properties/:propertyId/archive
GET    /api/v1/landlord/properties
```

Role for management:

```text
LANDLORD
```

---

# 19. Create Property

```http
POST /api/v1/properties
```

Request:

```json
{
  "property_type": "APARTMENT",
  "address_line_1": "Example Street",
  "address_line_2": null,
  "district": "Plaines Wilhems",
  "locality": "Quatre Bornes",
  "neighbourhood": "Belle Rose",
  "latitude": -20.263,
  "longitude": 57.479,
  "bedrooms": 2,
  "bathrooms": 1,
  "furnished": true,
  "parking_spaces": 1
}
```

Backend must:

1. authenticate user
2. require LANDLORD
3. resolve landlord profile
4. reject any submitted `landlord_id`, `user_id`, or `owner_id`
5. derive `landlord_id` from the authenticated user's landlord profile
6. validate numeric values
7. create property

Response:

```text
201 Created
```

`verification_status` starts from the database-controlled `UNVERIFIED` default.
Ownership, verification, archive, ID, and timestamp fields are not accepted.

---

# 20. Get Landlord Properties

```http
GET /api/v1/landlord/properties
```

Supports:

```text
?page=1
&limit=20
&archived=false
```

Defaults are page 1, limit 20, and active properties. Limit is capped at 100.
`archived=true` returns only rows with an archive timestamp. All queries are
scoped to the authenticated landlord profile.

Response:

```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 3,
    "total_pages": 1
  }
}
```

---

# 21. Get Property

```http
GET /api/v1/properties/:propertyId
```

This route is for landlord management.

Backend must confirm authenticated landlord owns the property.

Missing and non-owned properties both return HTTP 404 with code
`PROPERTY_NOT_FOUND`.

Public property information should be exposed through listing endpoints instead.

---

# 22. Update Property

```http
PATCH /api/v1/properties/:propertyId
```

Only owner may update.

Do not allow direct edits to:

```text
landlord_id
verification_status
archived_at
id
created_at
updated_at
```

PATCH is partial, but requires at least one editable field. Archived properties
return HTTP 409 with code `PROPERTY_ARCHIVED`.

---

# 23. Archive Property

```http
POST /api/v1/properties/:propertyId/archive
```

Backend should reject archival if an active rental listing still exists unless product rules explicitly permit the listing to be closed first.

Until the listing workflow is implemented, TASK-004 archives the owned property
without a listing check. Repeated archive requests are idempotent and preserve
the original `archived_at` value. Archival is soft; no property DELETE endpoint
is provided.

Recommended response:

```text
200 OK
```

with updated property.

---

# 24. Property Image Endpoints

Recommended:

```text
POST   /api/v1/properties/:propertyId/images
DELETE /api/v1/properties/:propertyId/images/:imageId
PATCH  /api/v1/properties/:propertyId/images/:imageId
```

Possible PATCH uses:

* set cover
* change display order

---

# 25. Upload Property Image

```http
POST /api/v1/properties/:propertyId/images
```

Role:

LANDLORD.

Backend must verify ownership.

Validate:

* actual decoded JPEG, PNG, or WebP content
* 10 MiB maximum file size and 40-megapixel decode limit
* 20-image property limit
* generated, ownership-derived Storage path

The request is `multipart/form-data` with exactly one `image` file. The backend
re-encodes the decoded image before persistence, stripping EXIF and GPS
metadata. Archived properties return `PROPERTY_ARCHIVED`; non-owned properties
remain indistinguishable from missing properties.

Response:

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "url": "short-lived-private-signed-url",
    "is_cover": false,
    "display_order": 2
  }
}
```

The Storage path is private metadata and is not returned. The first image is
the cover; later images append to the current maximum display order.

`PATCH /api/v1/properties/:propertyId/images/:imageId` accepts exactly one or
both of `{"is_cover": true}` and a non-negative integer `display_order`.
Clients cannot unset a cover or assign protected metadata. `DELETE` removes the
private object and its metadata and returns the remaining ordered images; when
the cover is deleted, the first remaining image becomes cover.

Owned property-detail responses include an ordered `images` array using this
same safe representation. Signed URLs expire after 15 minutes and are never
persisted. Landlord property-list responses do not sign every image.

---

# 26. Listing Endpoints

Management:

```text
POST   /api/v1/listings
GET    /api/v1/landlord/listings
GET    /api/v1/landlord/listings/:listingId
PATCH  /api/v1/listings/:listingId
POST   /api/v1/listings/:listingId/publish
POST   /api/v1/listings/:listingId/pause
POST   /api/v1/listings/:listingId/activate
POST   /api/v1/listings/:listingId/close
```

Public:

```text
GET /api/v1/listings
GET /api/v1/listings/:listingId
```

The public endpoints are not implemented in TASK-006. They remain reserved for
TASK-007. All TASK-006 management endpoints require an authenticated ACTIVE
LANDLORD and use owner-scoped property/listing resolution.

---

# 27. Create Listing

```http
POST /api/v1/listings
```

Role:

LANDLORD.

Request:

```json
{
  "property_id": "uuid",
  "title": "Furnished 2-bedroom apartment in Moka",
  "description": "...",
  "monthly_rent": 18000,
  "deposit_amount": 18000,
  "available_from": "2026-09-01",
  "minimum_lease_months": 6,
  "maximum_occupants": 3,
  "pets_allowed": false
}
```

Backend must:

* verify property belongs to landlord
* reject an archived property
* create as DRAFT
* reject client-supplied status and timestamp fields

Multiple private DRAFT rental cycles may exist for a property. The one-live
listing conflict is enforced when a draft is submitted for review.

Response:

```text
201 Created
```

---

# 28. Update Listing

```http
PATCH /api/v1/listings/:listingId
```

Role:

LANDLORD.

Backend must verify ownership via property.

Do not allow arbitrary direct change of:

```text
status
published_at
closed_at
```

Use dedicated state-transition endpoints.

Editable fields are limited to title, description, rent, deposit, availability,
lease duration, occupants, and pets. `property_id` is immutable. Normal edits
are allowed only for DRAFT and PAUSED; PENDING_REVIEW, ACTIVE, RENTED, and CLOSED
return `LISTING_NOT_EDITABLE`.

Private landlord reads are:

```text
GET /api/v1/landlord/listings
GET /api/v1/landlord/listings/:listingId
```

The list supports `page`, `limit`, and approved `status` filters and signs only
the cover image. Detail returns the owned property summary and temporary signed
property images. Another landlord's listing returns `LISTING_NOT_FOUND`.

---

# 29. Publish Listing

```http
POST /api/v1/listings/:listingId/publish
```

Backend validates listing completeness.

The only landlord publish transition is:

```text
DRAFT → PENDING_REVIEW
```

The following alternative is explicitly prohibited in TASK-006:

```text
DRAFT → ACTIVE
```

"Publish" means submit for review; it never makes the listing public or ACTIVE.
The PENDING_REVIEW to ACTIVE transition remains a future administrative action
and has no TASK-006 landlord endpoint.

Before submission, the backend re-checks required listing fields, ownership,
non-archived property state, at least one property image, a cover image, and no
other PENDING_REVIEW/ACTIVE/PAUSED listing for the property. Failures use
`LISTING_NOT_READY` with safe readiness reason codes or
`LIVE_LISTING_ALREADY_EXISTS`. The existing partial unique database index is
the final concurrency guarantee. Successful submission sets `published_at`
server-side.

---

# 30. Pause Listing

```http
POST /api/v1/listings/:listingId/pause
```

Allowed:

```text
ACTIVE → PAUSED
```

---

# 31. Reactivate Listing

```http
POST /api/v1/listings/:listingId/activate
```

Allowed:

```text
PAUSED → ACTIVE
```

---

# 32. Close Listing

```http
POST /api/v1/listings/:listingId/close
```

Allowed from:

```text
DRAFT
PENDING_REVIEW
ACTIVE
PAUSED
```

to:

```text
CLOSED
```

Do not physically delete listing history.

Close sets `closed_at` server-side and is idempotent for an already CLOSED
listing. RENTED cannot be closed or otherwise mutated by a landlord. Closing a
listing does not archive its property.

Property archival now checks listings first. A PENDING_REVIEW, ACTIVE, or
PAUSED listing returns `PROPERTY_HAS_LIVE_LISTING`; a property with DRAFT-only
listing history may be archived.

---

# 33. Public Listing Search

```http
GET /api/v1/listings
```

Authentication:

Not required.

Return only:

```text
ACTIVE
```

listings.

The joined property must also have `archived_at IS NULL`. A hidden listing or
an ACTIVE listing attached to an archived property returns no public result.
Public browsing never requires an application profile, and an optional bearer
header does not change visibility.

Supported filters:

```text
district
locality
neighbourhood
min_rent
max_rent
bedrooms
bathrooms
property_type
furnished
available_from
pets_allowed
page
limit
sort
```

Filter semantics:

- `district`, `locality`, and `neighbourhood` are bounded, normalized
  case-insensitive exact matches against structured fields.
- `property_type` accepts `APARTMENT`, `HOUSE`, `STUDIO`, `ROOM`, `TOWNHOUSE`,
  `VILLA`, or `OTHER`.
- `min_rent` and `max_rent` are inclusive and must form a valid non-negative
  range.
- `bedrooms` and `bathrooms` are inclusive minimums.
- `furnished` and `pets_allowed` accept only `true` or `false`.
- `available_from=YYYY-MM-DD` means available on or before that date.

Pagination defaults to page 1 and limit 20. Limit 100 is the maximum. Invalid,
unknown, negative, zero, or excessive query values return `VALIDATION_ERROR`.

Example:

```text
/api/v1/listings?locality=Moka&max_rent=20000&bedrooms=2&page=1
```

---

# 34. Search Sorting

Initial allowed sorts:

```text
newest
rent_low
rent_high
available_soon
```

The default is `newest`. Sorts map respectively to `published_at DESC`,
`monthly_rent ASC`, `monthly_rent DESC`, and `available_from ASC`. Every sort
uses listing UUID as a deterministic final tie-breaker.

Do not allow arbitrary SQL order fields from query strings.

Map allowed values server-side.

---

# 35. Public Listing Response

Return public-safe property information only.

Example:

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "title": "2-bedroom apartment",
      "monthly_rent": 18000,
      "available_from": "2026-09-01",
      "property": {
        "property_type": "APARTMENT",
        "district": "Moka",
        "locality": "Moka",
        "neighbourhood": null,
        "bedrooms": 2,
        "bathrooms": 1,
        "furnished": true,
        "parking_spaces": 1
      },
      "cover_image_url": "short-lived signed URL or null"
    }
  ],
  "meta": {}
}
```

Search cards are built by an explicit public serializer. They do not expose
property IDs, owner IDs, exact addresses, coordinates, landlord contact data,
verification evidence, Storage paths, listing status, or raw joined rows.

---

# 36. Get Public Listing Details

```http
GET /api/v1/listings/:listingId
```

Public only when the listing is ACTIVE and its property is not archived.
Otherwise return `404 LISTING_NOT_FOUND`, including for guessed UUIDs of DRAFT,
PENDING_REVIEW, PAUSED, RENTED, and CLOSED listings.

Returns public-safe listing fields plus:

* images
* listing description and rental conditions
* approximate location and property facts
* a true property-information verification indicator when supported by a
  VERIFIED database status

Must not expose:

* exact street address or coordinates
* landlord identifiers, email, or phone
* private tenant data
* internal moderation notes
* verification documents
* Storage paths

Image objects contain only `id`, a 15-minute presentation `url`,
`display_order`, and `is_cover`, in deterministic image order. The private
bucket is unchanged. The backend signs images only after public listing
eligibility succeeds and never persists signed URLs. Search signs only the
cover. A failed cover signature produces `cover_image_url: null`; an individual
detail image that cannot be signed is omitted without exposing its path.

---

# 37. Saved Listing Endpoints

```text
GET    /api/v1/tenant/saved-listings
GET    /api/v1/tenant/saved-listings/:listingId/status
POST   /api/v1/listings/:listingId/save
DELETE /api/v1/listings/:listingId/save
```

Role:

TENANT.

All four routes require a verified Supabase identity, an ACTIVE application
account, and the TENANT application role. The backend derives the
`saved_listings.tenant_id` through the authenticated user's tenant profile;
request-supplied tenant or ownership identifiers are never authoritative.

`GET /api/v1/tenant/saved-listings` accepts the standard `page` and `limit`
parameters. An AVAILABLE entry embeds the same private-safe card serializer
used by public search. If an older save's listing is no longer ACTIVE or its
property is archived, the relationship is preserved and returned as:

```json
{
  "listing_id": "uuid",
  "saved_at": "timestamp",
  "availability": "UNAVAILABLE",
  "listing": null
}
```

No listing, property, owner, address, image, or Storage-path fields are
serialized for an UNAVAILABLE save. The status endpoint returns only
`listing_id` and the current tenant's `saved` boolean.

---

# 38. Save Listing

```http
POST /api/v1/listings/:listingId/save
```

Backend must:

* allow a new relationship only for an ACTIVE listing on a non-archived property
* treat an existing relationship as success, even if that listing later became unavailable
* rely on the `(tenant_id, listing_id)` composite primary key as the final concurrency guarantee

Success is idempotent:

```json
{
  "success": true,
  "data": {
    "listing_id": "uuid",
    "saved": true
  }
}
```

An ineligible or unknown new target returns `404 LISTING_NOT_FOUND`, without
revealing whether a private listing exists.

`DELETE /api/v1/listings/:listingId/save` is also idempotent and returns `204`
whether or not the tenant currently has that relationship. It remains
available after the listing becomes non-public and never deletes or mutates the
listing or property.

Direct browser reads or writes to `saved_listings` remain denied by RLS. These
operations go through the Node API.

---

# 39. Application Question Management

```text
GET    /api/v1/landlord/listings/:listingId/application-questions
POST   /api/v1/listings/:listingId/application-questions
PATCH  /api/v1/listings/:listingId/application-questions/:questionId
DELETE /api/v1/listings/:listingId/application-questions/:questionId

GET    /api/v1/listings/:listingId/application-questions
```

The first four management routes require a verified identity, ACTIVE account,
LANDLORD role, and backend-confirmed ownership of the listing. Cross-landlord
listing access returns `404 LISTING_NOT_FOUND`; a question ID is always scoped
to the owned listing and cannot move between listings.

The landlord GET response includes metadata:

```json
{
  "locked": false,
  "editable": true,
  "listing_status": "DRAFT"
}
```

Question mutations are allowed only for `DRAFT`, `PENDING_REVIEW`, `ACTIVE`,
and `PAUSED` listings while no submitted application exists. `RENTED` and
`CLOSED` return `409 LISTING_NOT_EDITABLE`.

The final GET is anonymous and returns questions only when the listing is
`ACTIVE` and its property is not archived. All other and unknown states return
`404 LISTING_NOT_FOUND` without revealing question existence.

---

# 40. Create Application Question

Request:

```json
{
  "question_text": "Do you have pets?",
  "question_type": "BOOLEAN",
  "is_required": true,
  "display_order": 1
}
```

For SELECT:

```json
{
  "question_text": "Preferred lease duration?",
  "question_type": "SELECT",
  "is_required": true,
  "display_order": 2,
  "options": [
    { "option_text": "6 months", "display_order": 0 },
    { "option_text": "12 months", "display_order": 1 },
    { "option_text": "18 months", "display_order": 2 }
  ]
}
```

Supported types are `TEXT`, `NUMBER`, `BOOLEAN`, `DATE`, and `SELECT`.
SELECT requires at least one valid option. Non-SELECT questions cannot retain
options. Changing SELECT to another type removes its options as one compensated
operation; changing another type to SELECT requires replacement options.

PATCH accepts only `question_text`, `question_type`, `is_required`,
`display_order`, and context-valid `options`. Create and update reject protected
or unknown fields. DELETE returns `204` and cascades only that question's
options.

Questions are ordered by `display_order`, `created_at`, then `id`. Options are
ordered by `display_order`, then `id`. Both landlord and public serializers
return only question presentation fields; non-SELECT questions consistently
return `options: []`.

---

# 41. Question Edit Restriction

If any application for the listing has `submitted_at IS NOT NULL`, the entire
question set becomes immutable. Application status text alone is not the lock
authority. A DRAFT application with `submitted_at IS NULL` does not lock it.

The backend blocks create, update, delete, type changes, option changes,
required-state changes, and ordering changes.

Return:

```text
409 CONFLICT
```

with code:

```text
APPLICATION_QUESTIONS_LOCKED
```

Question/option persistence uses controlled compensation so a failed
multi-table operation does not leave a SELECT question with partial or invalid
options.

---

# 42. Rental Application Endpoints

```text
POST   /api/v1/listings/:listingId/applications
GET    /api/v1/tenant/applications
GET    /api/v1/applications/:applicationId
PATCH  /api/v1/applications/:applicationId
GET    /api/v1/applications/:applicationId/answers
PUT    /api/v1/applications/:applicationId/answers
```

TASK-010 implements tenant-owned DRAFT record operations, TASK-011 adds DRAFT
answer operations, TASK-012 adds submission, and TASK-013 adds the tenant-owned
list/detail read experience. Withdrawal, landlord reads, and later status
progression remain future endpoints.

---

# 43. Create Draft Application

```http
POST /api/v1/listings/:listingId/applications
```

Role:

TENANT.

Request:

```json
{
  "move_in_date": "2026-09-01",
  "requested_lease_duration_months": 12,
  "number_of_occupants": 1,
  "introductory_message": "..."
}
```

Backend must:

* derive the tenant profile from the verified authenticated identity
* require an ACTIVE tenant account
* allow a new draft only for an ACTIVE listing on a non-archived property
* create `status = DRAFT` with `submitted_at` and `withdrawn_at` null
* rely on the database uniqueness constraint for one application per
  tenant/listing
* return the existing DRAFT without overwriting it when creation is repeated,
  including when concurrent requests race
* return `APPLICATION_ALREADY_EXISTS` if the existing record is not DRAFT

Response:

```text
201 Created for a new draft
200 OK for an idempotently returned existing draft
```

---

## 43.1 Retrieve Tenant Application Detail

```http
GET /api/v1/applications/:applicationId
```

Only the owning ACTIVE tenant may retrieve the application. The response uses
an explicit tenant serializer and never returns `tenant_id`, internal ownership
identifiers, or status-history actor IDs. It includes the tenant's own core
fields, safe answer values, submission timestamps, and an actor-free timeline
containing only `from_status`, `to_status`, and `created_at`.

When the associated listing is still `ACTIVE` on a non-archived property, the
response includes `availability: "AVAILABLE"` and the same privacy-safe public
listing card used by Search & Discovery, with private images represented only
by short-lived signed presentation URLs. Otherwise it includes
`availability: "UNAVAILABLE"` and `listing: null`; the application does not
grant access to former listing fields, exact addresses, coordinates, ownership
data, or Storage paths. A DRAFT is editable only while available. A submitted
application and an unavailable DRAFT are read-only.

---

# 44. Update Draft Application

```http
PATCH /api/v1/applications/:applicationId
```

Tenant only.

Allowed only while:

```text
DRAFT
```

Editable fields:

* move_in_date
* requested_lease_duration_months
* number_of_occupants
* introductory_message

Do not allow tenant to update status directly.

Editing also requires the listing to remain ACTIVE on a non-archived property.
If it is no longer publicly eligible, the draft is preserved and retrieval
continues, but PATCH returns `409 LISTING_NOT_AVAILABLE`. `id`, `listing_id`,
`tenant_id`, `status`, submission/withdrawal timestamps, and audit timestamps
are strict protected fields and cannot be mass-assigned.

---

# 45. Draft Application Answers

Implemented endpoints:

```text
GET /api/v1/applications/:applicationId/answers
PUT /api/v1/applications/:applicationId/answers
```

Both require a verified identity, ACTIVE account, TENANT role, and backend
ownership of the application. Another tenant receives `404
APPLICATION_NOT_FOUND`. GET remains available to the owning tenant if the
listing later becomes unavailable and returns only `question_id`, `answer_text`,
and `updated_at`; it does not return current private question structure.

Request:

```json
{
  "answers": [
    {
      "question_id": "uuid",
      "answer_text": "true"
    },
    {
      "question_id": "uuid",
      "answer_text": "12 months"
    }
  ]
}
```

PUT partially upserts the supplied questions while the application is DRAFT;
omitted questions are unchanged. Duplicate `question_id` entries are rejected.
`answer_text: null`, an empty string, or a whitespace-only string explicitly
clears that question by deleting its answer row. An empty `answers` array is a
valid no-op, so required questions may remain unanswered in a DRAFT.

Backend validates:

* tenant owns application
* application is DRAFT
* listing remains ACTIVE on a non-archived property for mutation
* every question belongs to the application's listing
* TEXT is trimmed and limited to 2,000 characters
* NUMBER is finite and stored in canonical numeric text form
* BOOLEAN is exactly the canonical `true` or `false`
* DATE is a valid `YYYY-MM-DD` value
* SELECT exactly matches current `option_text` for that exact question

SELECT answer text is retained because the existing schema has no option-ID
column. The backend validates it against `application_question_options` before
every write; an option from another question or invented text fails validation.
The unique `(application_id, question_id)` constraint is the final concurrency
guarantee.

Required-answer completeness is not enforced while DRAFT and remains part of
future application submission.

Landlord question mutations coordinate stale DRAFT answer cleanup. A question
type change removes affected DRAFT answers. Replacing SELECT options removes
answers whose text is no longer in the current set, while option reorder/addition
preserves values that remain valid. Question deletion first removes dependent
DRAFT answers. Question wording, display order, and required-state-only changes
preserve valid answers. The existing submitted-application question lock runs
before all of these mutations, so submitted answers remain protected.

---

# 46. Submit Application

```http
POST /api/v1/applications/:applicationId/submit
```

Role:

Authenticated, ACTIVE `TENANT`; the application must belong to the tenant
profile resolved from the verified access token.

The request has no body. Client-supplied ownership, status, and timestamp
fields are ignored. At the transaction boundary the backend requires:

* an `ACTIVE` listing on a non-archived property
* `move_in_date`, `requested_lease_duration_months`, and
  `number_of_occupants`
* an answer for every current required question
* every stored answer still valid for its current question type and SELECT
  option set

Success returns the explicit application serializer with `status:
"SUBMITTED"` and the server-generated `submitted_at`. The same transaction
creates exactly one `DRAFT` to `SUBMITTED` status-history record whose actor is
the authenticated application user. It never changes `withdrawn_at`.

The operation is idempotent. Retrying an already completed submission returns
the same submitted state with `meta.submitted_now: false`; concurrent requests
cannot create another transition or history row. A later application state
returns `409 APPLICATION_NOT_SUBMITTABLE`.

Readiness errors return `422 APPLICATION_INCOMPLETE` with safe field arrays:

```json
{
  "missing_fields": ["move_in_date"],
  "missing_question_ids": ["uuid"],
  "invalid_question_ids": ["uuid"]
}
```

An unavailable listing returns `409 LISTING_NOT_AVAILABLE`. Another tenant's
UUID returns `404 APPLICATION_NOT_FOUND`. Submission does not create a
notification or transition to `UNDER_REVIEW` in TASK-012.

---

# 47. Withdraw Application

```http
POST /api/v1/applications/:applicationId/withdraw
```

Role:

TENANT.

Allowed from:

```text
SUBMITTED
UNDER_REVIEW
SHORTLISTED
```

TASK-015 intentionally does not implement withdrawal from DRAFT, viewing,
accepted, rejected, or already terminal states. Repeating a completed
withdrawal is idempotent and does not create another history row.

The endpoint derives the tenant, target status, and history actor from the
verified authenticated profile. It accepts no client-selected status or actor.
The status update, `withdrawn_at` assignment, and one status-history insert are
atomic. A conflicting transition returns:

```json
{
  "success": false,
  "error": {
    "code": "INVALID_APPLICATION_TRANSITION",
    "message": "This application action is not allowed from its current status."
  }
}
```

---

# 48. Tenant Applications

```http
GET /api/v1/tenant/applications
```

Filters:

```text
status
page
limit
```

Tenant only sees own applications.

Authentication:

Verified identity, ACTIVE account, and `TENANT` role are required. Tenant
ownership is derived from the authenticated application user and cannot be
selected through query parameters.

Pagination defaults to `page=1` and `limit=20`; `limit` is bounded to 100.
Results are ordered by `updated_at DESC, id DESC`. The optional `status` filter
accepts only the approved application states.

Each item contains the tenant-safe application summary plus:

```json
{
  "availability": "AVAILABLE",
  "listing": {
    "id": "uuid",
    "title": "Safe public title",
    "cover_image_url": "short-lived-signed-url"
  }
}
```

The `listing` object is the full approved public card serializer, not a private
database row. When the listing is not public, the item instead returns
`availability: "UNAVAILABLE"` and `listing: null`. This preserves the
application relationship without making it a backdoor to private listing,
property, landlord, address, coordinate, or Storage data.

---

# 49. Landlord Applications

```http
GET /api/v1/landlord/listings/:listingId/applications
```

Authentication:

Verified identity, ACTIVE account, LANDLORD role, and backend-confirmed
ownership of the listing through its property are required. A listing owned by
another landlord returns `404 LISTING_NOT_FOUND` without disclosing applicant
volume.

Optional filters:

```text
status
page
limit
```

Pagination defaults to `page=1` and `limit=20`; the maximum limit is 100.
Ordering is `submitted_at DESC, id DESC`. The only accepted statuses are:

```text
SUBMITTED
UNDER_REVIEW
SHORTLISTED
VIEWING_INVITED
VIEWING_COMPLETED
ACCEPTED
REJECTED
WITHDRAWN
```

`DRAFT` is never landlord-visible and is rejected as a filter. Each list item
contains only the submitted application summary and:

```json
{
  "tenant": {
    "first_name": "Jane",
    "last_name": "Applicant",
    "profile_photo_url": null
  }
}
```

The serializer does not expose tenant/profile IDs, Supabase identity, email,
phone, account status, preferred locations, income range, employer or school,
occupation, bio, or internal Storage fields.

---

# 50. Landlord Application Detail

```http
GET /api/v1/landlord/applications/:applicationId
```

Only the ACTIVE landlord who owns the application's listing may access this
read-only endpoint. A guessed `DRAFT` ID and an application belonging to
another landlord both return `404 APPLICATION_NOT_FOUND`.

The response contains approved submitted application fields, the minimal name
and profile-photo tenant identity, a safe listing/property summary, submitted
answers with question text/type, and a timeline containing only
`from_status`, `to_status`, and `created_at`. It never returns answer IDs,
tenant/landlord ownership IDs, contact/private tenant-profile fields,
`changed_by_user_id`, exact addresses, coordinates, or Storage paths.

Historical submitted applications remain visible to their owning landlord when
the listing becomes PAUSED, CLOSED, RENTED, archived, or otherwise non-public.
TASK-015 adds only the dedicated review, shortlist, and reject actions below.
Acceptance, viewing, messaging, and notification actions remain future
workflow operations.

---

# 51. Explicit Landlord Application Actions

```http
POST /api/v1/landlord/applications/:applicationId/review
POST /api/v1/landlord/applications/:applicationId/shortlist
POST /api/v1/landlord/applications/:applicationId/reject
```

Role:

LANDLORD with an ACTIVE account and backend-confirmed ownership of the
application's listing. A DRAFT application ID and an application owned by
another landlord both return `404 APPLICATION_NOT_FOUND`.

Each endpoint fixes its own target status; request-body status, actor, tenant,
landlord, listing, and ownership fields have no authority. There is no generic
application-status PATCH endpoint.

Success uses:

```json
{
  "success": true,
  "data": { "status": "UNDER_REVIEW" },
  "meta": { "transitioned_now": true }
}
```

An identical retry returns the same status with `transitioned_now: false` and
does not add history. Invalid, stale, contradictory, and terminal transitions
return `409 INVALID_APPLICATION_TRANSITION`.

---

# 52. Allowed Application Transitions

Roadmap matrix. Through TASK-015, the only implemented edges are DRAFT to
SUBMITTED plus the SUBMITTED, UNDER_REVIEW, and SHORTLISTED edges that target
UNDER_REVIEW, SHORTLISTED, REJECTED, or WITHDRAWN. Viewing and acceptance
edges shown below remain future work:

```text
DRAFT
  → SUBMITTED

SUBMITTED
  → UNDER_REVIEW
  → REJECTED
  → WITHDRAWN

UNDER_REVIEW
  → SHORTLISTED
  → REJECTED
  → WITHDRAWN

SHORTLISTED
  → VIEWING_INVITED
  → REJECTED
  → WITHDRAWN

VIEWING_INVITED
  → VIEWING_COMPLETED
  → REJECTED
  → WITHDRAWN

VIEWING_COMPLETED
  → ACCEPTED
  → REJECTED
  → WITHDRAWN
```

`WITHDRAWN` is tenant-controlled.

`UNDER_REVIEW`, `SHORTLISTED`, and `REJECTED` are landlord-controlled. The
database transaction locks the application row and compares the status seen by
the service with the locked current status. Competing different targets cannot
both commit from the same observed state; the winning update and its exactly
one actor-attributed history row commit together.

`ACCEPTED` and viewing states require future dedicated service handling and are
not implemented by TASK-015.

---

# 53. Accept Application

Do not use generic status endpoint for acceptance.

Use:

```http
POST /api/v1/applications/:applicationId/accept
```

This operation has broader business effects.

Backend must atomically:

1. authenticate landlord
2. verify ownership
3. validate transition
4. confirm no accepted application exists
5. set application ACCEPTED
6. set listing RENTED
7. write status history
8. notify accepted tenant
9. handle remaining active applications according to product rules

This operation must run in a transaction.

---

# 54. Remaining Applications After Acceptance

Recommended V1 behavior:

When a listing becomes RENTED:

Other non-final applications should be changed to:

```text
REJECTED
```

with a system reason such as:

```text
LISTING_RENTED
```

If preserving semantic distinction is important, introduce a future status such as:

```text
CLOSED
```

But do not introduce it until the product explicitly supports it.

---

# 55. Viewing Endpoints

```text
POST   /api/v1/landlord/applications/:applicationId/viewings
GET    /api/v1/applications/:applicationId/viewings
GET    /api/v1/viewings/:viewingId
POST   /api/v1/viewings/:viewingId/confirm
POST   /api/v1/viewings/:viewingId/decline
POST   /api/v1/viewings/:viewingId/cancel
POST   /api/v1/viewings/:viewingId/complete
POST   /api/v1/viewings/:viewingId/no-show
```

---

# 56. Create Viewing

```http
POST /api/v1/landlord/applications/:applicationId/viewings
```

Role:

LANDLORD.

Request:

```json
{
  "start_time": "2026-09-12T10:00:00+04:00",
  "end_time": "2026-09-12T10:30:00+04:00",
  "notes": "Meet at the building entrance."
}
```

Backend must:

* verify landlord owns listing
* require a SHORTLISTED or VIEWING_INVITED application
* require no existing PROPOSED or CONFIRMED viewing
* validate a future start, ordered end time, and bounded notes
* create PROPOSED viewing
* atomically update SHORTLISTED to VIEWING_INVITED with one actor-attributed
  status-history row

The application may already be VIEWING_INVITED only when an earlier viewing is
terminal. There is no notification side effect in TASK-016. The application
transition and initial viewing insert occur in one backend-only transaction.

---

# 57. Confirm Viewing

```http
POST /api/v1/viewings/:viewingId/confirm
```

Role:

TENANT.

Tenant must own associated application.

Allowed:

```text
PROPOSED → CONFIRMED
```

---

# 58. Decline Viewing

```http
POST /api/v1/viewings/:viewingId/decline
```

Role:

TENANT.

Allowed:

```text
PROPOSED → DECLINED
```

Application status should not automatically become REJECTED.

Landlord may propose another viewing.

---

# 59. Cancel Viewing

```http
POST /api/v1/viewings/:viewingId/cancel
```

Allowed participant:

* landlord
* tenant

Backend records who cancelled if required for auditability.

TASK-016 permits either participant to cancel a PROPOSED or CONFIRMED viewing.
Cancellation leaves the application at VIEWING_INVITED.

---

# 60. Complete Viewing

```http
POST /api/v1/viewings/:viewingId/complete
```

Role:

LANDLORD.

Allowed:

```text
CONFIRMED → COMPLETED
```

Then application may move:

```text
VIEWING_INVITED → VIEWING_COMPLETED
```

---

# 61. No-Show

```http
POST /api/v1/viewings/:viewingId/no-show
```

Role:

LANDLORD.

Allowed for scheduled confirmed viewing after relevant time.

Do not automatically reject application.

---

TASK-016 additionally requires completion and no-show only after the viewing
start time. Completion atomically updates the viewing, changes the application
from VIEWING_INVITED to VIEWING_COMPLETED, and creates exactly one
actor-attributed application-history row. No-show leaves the application at
VIEWING_INVITED. All actions are explicit POST endpoints; there is no generic
viewing-status PATCH. Identical retries are idempotent and conflicting actions
from the same observed source state allow at most one winner.

---

# 62. Messaging Endpoints

```text
GET  /api/v1/conversations
POST /api/v1/listings/:listingId/conversations
GET  /api/v1/conversations/:conversationId
GET  /api/v1/conversations/:conversationId/messages
POST /api/v1/conversations/:conversationId/messages
POST /api/v1/conversations/:conversationId/read
```

---

# 63. Create/Get Conversation

```http
POST /api/v1/listings/:listingId/conversations
```

Role:

TENANT.

Recommended rule:

Tenant may create conversation only when:

* listing is ACTIVE
* tenant has a legitimate relationship to listing

Product can choose whether an application is required first.

Recommended V1:

Allow tenant to message landlord from an ACTIVE listing before application, but rate-limit abuse.

Backend returns existing conversation if already created.

Make endpoint idempotent.

---

# 64. Send Message

```http
POST /api/v1/conversations/:conversationId/messages
```

Request:

```json
{
  "content": "Hello, is the viewing still available for Saturday?"
}
```

Backend must:

* authenticate user
* ensure user is conversation participant
* validate non-empty content
* enforce message length limit
* insert message
* create recipient notification

---

# 65. Mark Conversation Read

```http
POST /api/v1/conversations/:conversationId/read
```

Updates participant:

```text
last_read_at
```

No need to update every message individually.

---

# 66. Notification Endpoints

```text
GET  /api/v1/notifications
POST /api/v1/notifications/:notificationId/read
POST /api/v1/notifications/read-all
```

Authentication required.

User only sees their own notifications.

---

# 67. Report Endpoints

```text
POST /api/v1/reports
GET  /api/v1/admin/reports
GET  /api/v1/admin/reports/:reportId
POST /api/v1/admin/reports/:reportId/resolve
POST /api/v1/admin/reports/:reportId/dismiss
```

---

# 68. Create Report

```http
POST /api/v1/reports
```

Request example:

```json
{
  "listing_id": "uuid",
  "reason": "FAKE_LISTING",
  "description": "The same images appear under another address."
}
```

or:

```json
{
  "reported_user_id": "uuid",
  "reason": "HARASSMENT",
  "description": "..."
}
```

Backend must require at least one valid target.

---

# 69. Admin User Endpoints

Recommended:

```text
GET  /api/v1/admin/users
GET  /api/v1/admin/users/:userId
POST /api/v1/admin/users/:userId/suspend
POST /api/v1/admin/users/:userId/restore
```

Role:

ADMIN.

Every sensitive admin action should create an audit log.

---

# 70. Admin Listing Endpoints

```text
GET  /api/v1/admin/listings
GET  /api/v1/admin/listings/:listingId
POST /api/v1/admin/listings/:listingId/approve
POST /api/v1/admin/listings/:listingId/reject
POST /api/v1/admin/listings/:listingId/remove
```

If listing moderation is enabled.

---

# 71. Listing Approval

Recommended moderation flow:

```text
DRAFT
  ↓ landlord publish
PENDING_REVIEW
  ↓ admin approve
ACTIVE
```

Private beta may optionally bypass moderation.

This should be controlled by environment/configuration rather than rewriting core logic.

---

# 72. Verification Endpoints

Recommended admin endpoints:

```text
GET  /api/v1/admin/verifications
GET  /api/v1/admin/verifications/:verificationId
POST /api/v1/admin/verifications/:verificationId/approve
POST /api/v1/admin/verifications/:verificationId/reject
```

Public verification output should disclose only verified status, never private verification evidence.

---

# 73. Admin Analytics

Recommended basic endpoint:

```http
GET /api/v1/admin/analytics/overview
```

Return:

```json
{
  "success": true,
  "data": {
    "active_listings": 100,
    "tenants": 500,
    "landlords": 45,
    "submitted_applications": 220,
    "viewings": 70,
    "rented_listings": 20,
    "open_reports": 4
  }
}
```

Do not build advanced analytics infrastructure in V1.

---

# 74. Pagination

All potentially large list endpoints should support pagination.

Parameters:

```text
page
limit
```

Defaults:

```text
page = 1
limit = 20
```

Set maximum:

```text
limit <= 100
```

Response:

```json
{
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 135,
    "total_pages": 7
  }
}
```

---

# 75. Input Validation

Validate all inputs server-side.

Examples:

```text
UUID format
dates
numeric ranges
enum-like values
text lengths
required fields
phone format where applicable
file types
file sizes
```

Recommended validation library:

Codex may use a maintained schema-validation library such as:

```text
Zod
```

or equivalent.

One library should be chosen and used consistently.

---

# 76. Maximum Text Lengths

Recommended initial limits:

```text
first_name: 100
last_name: 100
phone: 30

listing title: 150
listing description: 5000

tenant bio: 1000
introductory_message: 2000

application question: 500
application answer: 3000

message content: 5000

report description: 3000
```

These limits should exist both in validation and where useful in database constraints.

---

# 77. Rate Limiting

Apply rate limiting to sensitive and abuse-prone endpoints.

Examples:

```text
authentication-related operations
message sending
report creation
conversation creation
property image upload
application submission
```

Do not use one extremely restrictive global rate limit that breaks normal use.

---

# 78. Idempotency

Where repeated requests should safely produce the same result, design endpoints accordingly.

Examples:

```text
save listing
create conversation
mark notification read
```

Payments are not part of V1, so formal payment-style idempotency keys are not required.

---

# 79. Ownership Resolution

Never accept ownership parameters like:

```json
{
  "landlord_id": "..."
}
```

for operations where ownership can be derived from authentication.

Similarly, do not trust:

```text
tenant_id
sender_user_id
changed_by_user_id
```

when the authenticated user can be derived server-side.

---

# 80. Soft Deletion

Normal user-facing operations should use state/archival instead of destructive deletes for historical entities.

Examples:

```text
property → archived_at
listing → CLOSED
application → WITHDRAWN
message → deleted_at
```

Hard deletion should be reserved for:

* privacy/legal deletion
* invalid test data
* carefully controlled administration

---

# 81. Public vs Private Data

Public API responses may include:

* listing details
* approximate property location
* property characteristics
* public landlord trust indicators

Private API responses may include:

* application content
* applicant profile data
* conversations
* exact internal address where allowed
* admin notes
* verification details

Codex must not reuse private database objects directly as public responses without explicit serialization.

---

# 82. Serialization Layer

Recommended:

Services/controllers should return explicit response objects.

Do not blindly return:

```text
SELECT *
```

objects to the frontend.

This prevents accidental exposure when new database columns are added later.

---

# 83. Logging Rules

API should log:

* request method
* route
* response status
* server errors
* request correlation ID if implemented

Do not log:

* bearer tokens
* passwords
* full sensitive application documents
* private verification evidence

---

# 84. CORS

Backend should permit only approved frontend origins.

Development example:

```text
http://localhost:5173
```

Production example:

```text
https://<production-domain>
```

Do not use unrestricted:

```text
Access-Control-Allow-Origin: *
```

for authenticated production APIs.

---

# 85. API Documentation

Recommended:

Use an OpenAPI specification.

Codex may maintain:

```text
docs/openapi.yaml
```

or generate from code if done consistently.

The written `API_SPEC.md` remains the product-level contract.

---

# 86. API Testing Requirements

Each endpoint should have integration tests covering at minimum:

```text
happy path
unauthenticated access
wrong role
wrong ownership
invalid input
not found
conflict where relevant
```

Example property endpoint tests:

```text
landlord creates own property → 201
tenant attempts property create → 403
unauthenticated user → 401
negative bedrooms → 400/422
```

---

# 87. Critical Workflow Tests

Codex must eventually test the complete API sequence:

```text
Landlord profile
→ property
→ listing
→ publish

Tenant profile
→ search listing
→ create application
→ answer questions
→ submit

Landlord
→ review
→ shortlist
→ create viewing

Tenant
→ confirm viewing

Landlord
→ complete viewing
→ accept application

System
→ application ACCEPTED
→ listing RENTED
```

---

# 88. API Non-Goals

Do not implement V1 endpoints for:

```text
payments
deposits
escrow
commissions
leases
digital signatures
credit scores
background checks
insurance
property management
tenant scoring
AI tenant ranking
```

---

# 89. Endpoint Summary

## Authentication

```text
POST /api/v1/auth/register-profile
GET  /api/v1/auth/me
```

## Tenant

```text
GET   /api/v1/tenant/profile
PATCH /api/v1/tenant/profile

GET    /api/v1/tenant/preferred-locations
POST   /api/v1/tenant/preferred-locations
DELETE /api/v1/tenant/preferred-locations/:id

GET /api/v1/tenant/saved-listings
GET /api/v1/tenant/saved-listings/:listingId/status
GET /api/v1/tenant/applications
```

## Landlord

```text
GET   /api/v1/landlord/profile
PATCH /api/v1/landlord/profile
GET   /api/v1/landlord/properties
GET   /api/v1/landlord/applications
```

## Properties

```text
POST  /api/v1/properties
GET   /api/v1/properties/:propertyId
PATCH /api/v1/properties/:propertyId
POST  /api/v1/properties/:propertyId/archive

POST   /api/v1/properties/:propertyId/images
PATCH  /api/v1/properties/:propertyId/images/:imageId
DELETE /api/v1/properties/:propertyId/images/:imageId
```

## Listings

```text
GET  /api/v1/listings
GET  /api/v1/listings/:listingId
POST /api/v1/listings

PATCH /api/v1/listings/:listingId
POST  /api/v1/listings/:listingId/publish
POST  /api/v1/listings/:listingId/pause
POST  /api/v1/listings/:listingId/activate
POST  /api/v1/listings/:listingId/close

POST   /api/v1/listings/:listingId/save
DELETE /api/v1/listings/:listingId/save
```

## Questions

```text
GET    /api/v1/landlord/listings/:listingId/application-questions
POST   /api/v1/listings/:listingId/application-questions
PATCH  /api/v1/listings/:listingId/application-questions/:questionId
DELETE /api/v1/listings/:listingId/application-questions/:questionId
GET    /api/v1/listings/:listingId/application-questions
```

## Applications

```text
POST  /api/v1/listings/:listingId/applications
PATCH /api/v1/applications/:applicationId

GET /api/v1/tenant/applications
GET /api/v1/applications/:applicationId

GET /api/v1/landlord/listings/:listingId/applications
GET /api/v1/landlord/applications/:applicationId

PUT  /api/v1/applications/:applicationId/answers
POST /api/v1/applications/:applicationId/submit
POST /api/v1/applications/:applicationId/withdraw

POST /api/v1/landlord/applications/:applicationId/review
POST /api/v1/landlord/applications/:applicationId/shortlist
POST /api/v1/landlord/applications/:applicationId/reject
```

## Viewings

```text
POST /api/v1/applications/:applicationId/viewings

GET  /api/v1/viewings
GET  /api/v1/viewings/:viewingId

POST /api/v1/viewings/:viewingId/confirm
POST /api/v1/viewings/:viewingId/decline
POST /api/v1/viewings/:viewingId/cancel
POST /api/v1/viewings/:viewingId/complete
POST /api/v1/viewings/:viewingId/no-show
```

## Messaging

```text
POST /api/v1/listings/:listingId/conversation
GET  /api/v1/conversations
GET  /api/v1/conversations/:conversationId
```

Conversation creation is restricted to an authenticated ACTIVE TENANT and an
ACTIVE listing whose property is not archived. The tenant and listing
landlord are derived by the backend; participant IDs are never accepted from
the request. Creation is idempotent and concurrency-safe, returning one
conversation with exactly the two participant memberships. Both participants
retain container access after the listing becomes unavailable, while tenant
responses omit private listing fields and expose only minimal counterparty
identity (`first_name`, `last_name`, and `profile_photo_url`). Messages,
read-state mutation, realtime delivery, notifications, and attachments are
deferred to TASK-018 and later tasks.

## Messages (TASK-018)

```text
GET  /api/v1/conversations/:conversationId/messages
POST /api/v1/conversations/:conversationId/messages
POST /api/v1/conversations/:conversationId/read
```

All message endpoints require an ACTIVE authenticated participant. Sender
identity and read-state ownership are derived from the verified session; an
unrelated user receives `404 CONVERSATION_NOT_FOUND`. Message bodies are
trimmed plain text, required, and limited to 4000 characters. History uses
`page` and `limit` query parameters (default 50, maximum 100) with
`created_at ASC, id ASC` ordering. Messages are immutable. Conversation lists
include a safe last-message preview and an unread count containing only
counterparty messages newer than the caller's `last_read_at`; own messages do
not count. `POST /read` updates only the caller's participant row. Direct
publishable-key reads and writes remain blocked by deny-by-default RLS.

## Notifications

```text
GET  /api/v1/notifications
GET  /api/v1/notifications/unread-count
POST /api/v1/notifications/:notificationId/read
POST /api/v1/notifications/read-all
```

All notification endpoints require an authenticated ACTIVE TENANT or
LANDLORD. List supports `page` (default 1), `limit` (default 20, maximum 100),
and `unread_only`; ordering is deterministic `created_at DESC, id DESC`.
Responses expose only safe notification fields and a protected navigation
target. Recipients are derived by the database event transactions. Supported
events are application submission, review, shortlist, rejection, withdrawal;
viewing proposal, confirmation, decline, cancellation, completion, and
no-show; and receipt of a new message. Message notifications never include
message bodies. Read-one and read-all are idempotent and scoped to the
authenticated user's notifications; cross-user IDs return a privacy-safe 404.

## Reports

```text
POST /api/v1/reports
GET  /api/v1/admin/reports
GET  /api/v1/admin/reports/:reportId
POST /api/v1/admin/reports/:reportId/review
POST /api/v1/admin/reports/:reportId/resolve
POST /api/v1/admin/reports/:reportId/dismiss
```

Reports support only `LISTING` and `MESSAGE` targets. Listing reasons are
`FRAUD_OR_SCAM`, `MISLEADING_INFORMATION`, `INAPPROPRIATE_CONTENT`,
`DUPLICATE`, and `OTHER`; message reasons are `HARASSMENT`, `SPAM`,
`FRAUD_OR_SCAM`, `INAPPROPRIATE_CONTENT`, and `OTHER`. Reporter identity is
derived from the verified session. Message reports require conversation
participation and unrelated IDs return `404 MESSAGE_NOT_FOUND`. Details are
trimmed and limited to 1000 characters. An active duplicate by the same
reporter and target is reused, including concurrent requests.

Only ACTIVE ADMIN accounts may access the admin queue/detail/actions. Allowed
transitions are OPEN to UNDER_REVIEW/RESOLVED/DISMISSED and UNDER_REVIEW to
RESOLVED/DISMISSED. There is no generic report status PATCH endpoint. Real
moderation transitions write an `admin_audit_logs` record atomically.

## Admin

```text
GET  /api/v1/admin/users
GET  /api/v1/admin/users/:userId
POST /api/v1/admin/users/:userId/suspend
POST /api/v1/admin/users/:userId/restore

GET  /api/v1/admin/listings
GET  /api/v1/admin/listings/:listingId
POST /api/v1/admin/listings/:listingId/approve
POST /api/v1/admin/listings/:listingId/reject
POST /api/v1/admin/listings/:listingId/remove

GET  /api/v1/admin/reports
GET  /api/v1/admin/reports/:reportId
POST /api/v1/admin/reports/:reportId/resolve
POST /api/v1/admin/reports/:reportId/dismiss

GET  /api/v1/admin/verifications
GET  /api/v1/admin/verifications/:verificationId
POST /api/v1/admin/verifications/:verificationId/approve
POST /api/v1/admin/verifications/:verificationId/reject

GET /api/v1/admin/analytics/overview
```

---

# 90. Final API Principle

The API must protect the business workflow even if the frontend is completely bypassed.

A user manually calling the API must still be unable to:

* access someone else's application
* modify someone else's property
* pretend to be another user
* create an admin account
* manipulate application states
* accept multiple tenants
* bypass listing ownership
* read conversations they do not participate in
* expose private data

The backend is the authoritative enforcement layer for the platform.
