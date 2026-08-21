# Mauritius Rental Platform — API Specification

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
4. ignore any submitted `landlord_id`
5. attach property to authenticated landlord
6. validate numeric values
7. create property

Response:

```text
201 Created
```

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
created_at
```

---

# 23. Archive Property

```http
POST /api/v1/properties/:propertyId/archive
```

Backend should reject archival if an active rental listing still exists unless product rules explicitly permit the listing to be closed first.

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

* allowed MIME types
* maximum file size
* image count
* safe path generation

Response:

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "storage_path": "properties/...",
    "is_cover": false,
    "display_order": 2
  }
}
```

---

# 26. Listing Endpoints

Management:

```text
POST   /api/v1/listings
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
* ensure no conflicting live listing exists
* create as DRAFT
* ignore any submitted status other than allowed initial state

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

---

# 29. Publish Listing

```http
POST /api/v1/listings/:listingId/publish
```

Backend validates listing completeness.

Possible transition:

```text
DRAFT → PENDING_REVIEW
```

or, if moderation is disabled during private beta:

```text
DRAFT → ACTIVE
```

The behavior must be controlled by configuration/product policy.

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
ACTIVE
PAUSED
```

to:

```text
CLOSED
```

Do not physically delete listing history.

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
minimum_lease_months
pets_allowed
parking
page
limit
sort
```

Example:

```text
/api/v1/listings?locality=Moka&max_rent=20000&bedrooms=2&page=1
```

---

# 34. Search Sorting

Initial allowed sorts:

```text
NEWEST
RENT_LOW_TO_HIGH
RENT_HIGH_TO_LOW
AVAILABLE_SOONEST
```

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
      "cover_image": "..."
    }
  ],
  "meta": {}
}
```

Do not expose exact private address unless product policy explicitly allows it.

---

# 36. Get Public Listing Details

```http
GET /api/v1/listings/:listingId
```

Public if listing is ACTIVE.

May return additional:

* images
* landlord trust indicators
* application questions
* amenities
* listing details

Must not expose:

* landlord private phone unless intentionally part of product
* private tenant data
* internal moderation notes
* verification documents

---

# 37. Saved Listing Endpoints

```text
GET    /api/v1/tenant/saved-listings
POST   /api/v1/listings/:listingId/save
DELETE /api/v1/listings/:listingId/save
```

Role:

TENANT.

---

# 38. Save Listing

```http
POST /api/v1/listings/:listingId/save
```

Backend must:

* ensure listing exists
* ensure listing is visible
* prevent duplicates

Possible conflict:

```text
409 DUPLICATE_SAVED_LISTING
```

Alternatively make this endpoint idempotent and return `200` if already saved.

Recommended:

Use idempotent behavior.

---

# 39. Application Question Management

```text
GET    /api/v1/listings/:listingId/application-questions
POST   /api/v1/listings/:listingId/application-questions
PATCH  /api/v1/application-questions/:questionId
DELETE /api/v1/application-questions/:questionId
```

Management role:

LANDLORD.

Public/tenant read:

Allowed for active listing.

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
    "6 months",
    "12 months",
    "18 months"
  ]
}
```

---

# 41. Question Edit Restriction

If the listing already has a SUBMITTED application:

The backend must prevent destructive edits to existing questions.

Return:

```text
409 CONFLICT
```

with code:

```text
APPLICATION_QUESTION_LOCKED
```

---

# 42. Rental Application Endpoints

```text
POST   /api/v1/listings/:listingId/applications
PATCH  /api/v1/applications/:applicationId
POST   /api/v1/applications/:applicationId/submit
POST   /api/v1/applications/:applicationId/withdraw

GET    /api/v1/tenant/applications
GET    /api/v1/applications/:applicationId
GET    /api/v1/landlord/applications
PATCH  /api/v1/applications/:applicationId/status
```

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

* ensure listing is ACTIVE
* ensure user is TENANT
* ensure no existing application exists for same tenant/listing
* create status DRAFT

Response:

```text
201 Created
```

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

---

# 45. Submit Application Answers

Recommended:

```text
PUT /api/v1/applications/:applicationId/answers
```

Request:

```json
{
  "answers": [
    {
      "question_id": "uuid",
      "answer": "true"
    },
    {
      "question_id": "uuid",
      "answer": "12 months"
    }
  ]
}
```

Use PUT because this replaces/updates the application's current answer set while still DRAFT.

Backend validates:

* tenant owns application
* application is DRAFT
* question belongs to listing
* answer type is valid
* required questions are complete at submission

---

# 46. Submit Application

```http
POST /api/v1/applications/:applicationId/submit
```

Role:

TENANT.

Backend must:

1. confirm tenant owns application
2. confirm status is DRAFT
3. confirm listing still ACTIVE
4. validate required application fields
5. validate required custom answers
6. set status SUBMITTED
7. populate submitted_at
8. insert application status history
9. create landlord notification

Use transaction where appropriate.

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
VIEWING_INVITED
```

Product decision may allow withdrawal after viewing.

Do not allow withdrawal after:

```text
ACCEPTED
REJECTED
WITHDRAWN
```

unless future business rules change.

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

---

# 49. Landlord Applications

```http
GET /api/v1/landlord/applications
```

Role:

LANDLORD.

Optional filters:

```text
listing_id
status
page
limit
```

Backend must return only applications for listings owned by authenticated landlord.

---

# 50. Get Application Details

```http
GET /api/v1/applications/:applicationId
```

Allowed:

* tenant who owns application
* landlord who owns listing
* authorized admin when necessary

Response should differ by role where privacy requires.

---

# 51. Update Application Status

```http
PATCH /api/v1/applications/:applicationId/status
```

Role:

LANDLORD.

Request:

```json
{
  "status": "SHORTLISTED"
}
```

Backend must:

* verify listing ownership
* validate transition
* update application
* create status history
* create tenant notification

Do not allow arbitrary transitions.

---

# 52. Allowed Application Transitions

Recommended V1 matrix:

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

`REJECTED` and most progress states are landlord-controlled.

`ACCEPTED` requires special service handling.

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
POST   /api/v1/applications/:applicationId/viewings
GET    /api/v1/viewings
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
POST /api/v1/applications/:applicationId/viewings
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
* ensure application is in suitable state
* create PROPOSED viewing
* update application to VIEWING_INVITED when appropriate
* create status history
* notify tenant

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
GET    /api/v1/listings/:listingId/application-questions
POST   /api/v1/listings/:listingId/application-questions
PATCH  /api/v1/application-questions/:questionId
DELETE /api/v1/application-questions/:questionId
```

## Applications

```text
POST  /api/v1/listings/:listingId/applications
PATCH /api/v1/applications/:applicationId

PUT  /api/v1/applications/:applicationId/answers
POST /api/v1/applications/:applicationId/submit
POST /api/v1/applications/:applicationId/withdraw
POST /api/v1/applications/:applicationId/accept

GET   /api/v1/applications/:applicationId
PATCH /api/v1/applications/:applicationId/status
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
GET  /api/v1/conversations
POST /api/v1/listings/:listingId/conversations
GET  /api/v1/conversations/:conversationId
GET  /api/v1/conversations/:conversationId/messages
POST /api/v1/conversations/:conversationId/messages
POST /api/v1/conversations/:conversationId/read
```

## Notifications

```text
GET  /api/v1/notifications
POST /api/v1/notifications/:notificationId/read
POST /api/v1/notifications/read-all
```

## Reports

```text
POST /api/v1/reports
```

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
