# Mauritius Rental Platform — Development Rules

## 1. Purpose

This document defines the engineering rules for the Mauritius Rental Platform.

Codex is the primary implementation agent for this project.

Codex must follow this document together with:

```text
docs/PRODUCT_SPEC.md
docs/ARCHITECTURE.md
docs/DATABASE.md
docs/API_SPEC.md
docs/SECURITY.md
docs/TESTING.md
docs/ROADMAP.md
```

before implementing major functionality.

If implementation instructions conflict with these documents, Codex must identify the conflict before changing the architecture.

---

# 2. Primary Engineering Principle

The project should optimize for:

* correctness
* security
* maintainability
* simplicity
* clear ownership
* predictable behavior
* testability
* fast product iteration

Do not optimize prematurely for hypothetical scale.

Do not introduce complexity without a demonstrated requirement.

---

# 3. Approved Technology Stack

## Frontend

Use:

```text
React
JavaScript
HTML
CSS
```

## Backend

Use:

```text
Node.js
Express
```

## Database

Use:

```text
PostgreSQL
Supabase
```

## Authentication

Use:

```text
Supabase Auth
```

## Storage

Use:

```text
Supabase Storage
```

## Future Specialist Services

Reserved for later:

```text
Python
FastAPI
```

---

# 4. Technologies Not Approved for V1

Do not introduce the following without explicit approval:

```text
PHP
another frontend framework
another backend framework
another primary database
GraphQL
MongoDB
Firebase
PlanetScale
Redis
Elasticsearch
Kubernetes
microservices
native Android application
native iOS application
blockchain
```

This does not mean these technologies are bad.

They are simply not part of the approved V1 architecture.

---

# 5. Architecture Changes

Codex must not silently change:

* React
* Node.js
* Express
* PostgreSQL
* Supabase
* authentication provider
* storage provider
* REST API architecture
* repository structure
* role model
* database ownership model
* major workflow state models

If Codex believes a change is necessary, it must document:

```text
Proposed change:
Reason:
Current limitation:
Benefits:
Risks:
Migration impact:
Files affected:
Alternative approaches considered:
```

before implementing the architectural change.

---

# 6. Product Boundary

The platform is rental workflow software.

The V1 platform does not:

* collect rent
* collect deposits
* hold money
* process payments
* charge transaction commission
* negotiate rent
* negotiate rental terms
* manage properties
* act on behalf of landlords
* act on behalf of tenants
* generate legal rental agreements
* sign agreements
* perform credit scoring
* perform background checks
* automatically score tenants
* automatically rank tenants
* automatically choose tenants

Codex must not introduce any of these features unless the product specification is formally updated.

---

# 7. Core Product Principle

The system provides information and workflow tools.

The users make rental decisions.

The landlord decides:

* whom to review
* whom to shortlist
* whom to invite
* whom to reject
* whom to accept

The system must not automatically determine the "best tenant."

---

# 8. Repository Structure

Maintain the approved structure.

```text
mauritius-rental-platform/
│
├── frontend/
├── backend/
├── database/
│   ├── migrations/
│   ├── seeds/
│   └── schema/
│
├── docs/
├── tasks/
│   ├── CURRENT_TASK.md
│   ├── backlog/
│   └── completed/
│
├── python-services/
│
├── .gitignore
├── README.md
└── package.json
```

Do not move major folders without approval.

---

# 9. Task Execution Rule

Codex should normally implement only the task defined in:

```text
tasks/CURRENT_TASK.md
```

Do not start future backlog tasks automatically.

Do not implement unrelated features because they appear convenient.

Example:

If the current task is:

```text
Create landlord property management
```

do not also implement:

```text
applications
messaging
payments
AI recommendations
```

unless explicitly required by the task.

---

# 10. Before Coding

Before implementing a task, Codex must:

1. read `tasks/CURRENT_TASK.md`
2. inspect relevant existing code
3. identify existing reusable components/services
4. inspect related tests
5. review relevant project documentation
6. identify affected database/API contracts
7. check whether a migration is required

Codex should understand existing implementation before modifying it.

---

# 11. Scope Discipline

Codex should make the smallest coherent change that fully solves the assigned task.

Avoid:

* unnecessary refactoring
* unrelated cleanup
* renaming unrelated files
* redesigning unrelated components
* dependency changes unrelated to the task

Small, controlled changes are preferred.

---

# 12. Backend Layering

Backend must follow:

```text
Route
 ↓
Middleware
 ↓
Controller
 ↓
Service
 ↓
Repository
 ↓
Database
```

Each layer has a specific responsibility.

---

# 13. Route Rules

Routes define:

* HTTP method
* path
* middleware
* controller

Routes should not contain significant business logic.

Avoid:

```javascript
router.post('/properties', async (req, res) => {
  // 150 lines of validation, ownership, database logic
});
```

Instead use:

```text
route
→ middleware
→ controller
→ service
→ repository
```

---

# 14. Controller Rules

Controllers handle HTTP-specific concerns.

Controllers should:

* receive request
* extract validated values
* call service
* return response

Controllers should not contain:

* complex database queries
* workflow state rules
* resource ownership logic
* long business operations

---

# 15. Service Rules

Services contain application business rules.

Examples:

```text
propertyService
listingService
applicationService
viewingService
messageService
reportService
adminService
```

Services are responsible for:

* ownership verification
* workflow transitions
* business validation
* coordinated operations
* database transactions

---

# 16. Repository Rules

Repositories handle persistence.

Examples:

```text
findById()
findByOwner()
create()
update()
archive()
```

Repositories should not decide:

* user permissions
* valid workflow transitions
* which user may perform an action
* product policy

Those belong to service logic.

---

# 17. Frontend Structure

Use reusable components.

Avoid giant React components.

A page should coordinate components and data.

Components should generally handle one responsibility.

Examples:

```text
PropertyCard
SearchFilters
ApplicationCard
StatusBadge
ViewingCard
ConversationList
MessageThread
NotificationItem
```

---

# 18. Frontend API Calls

Do not scatter raw API requests across React components.

Use service modules.

Example:

```text
services/
  authService.js
  propertyService.js
  listingService.js
  applicationService.js
  viewingService.js
  messageService.js
```

React page:

```text
ApplicationPage
      ↓
applicationService.submit()
      ↓
Node API
```

---

# 19. Business Logic Location

Do not place authoritative business logic in React.

Examples that belong in backend services:

```text
Can this application be accepted?

Does this landlord own this listing?

Can this tenant withdraw this application?

Can this listing move from PAUSED to ACTIVE?

Can this landlord edit application questions?
```

React may display the expected UI state, but the backend must enforce it.

---

# 20. Authentication Rule

Identity must come from authenticated Supabase sessions.

Never trust:

```text
user_id
tenant_id
landlord_id
role
sender_user_id
```

simply because the frontend includes them.

Where ownership is derivable from authenticated identity, derive it server-side.

---

# 21. Authorization Rule

Every protected action requires appropriate checks.

At minimum consider:

```text
Is user authenticated?
Is account ACTIVE?
Does user have correct role?
Does user own this resource?
Is this operation valid in the current workflow state?
```

Do not rely on frontend route protection alone.

---

# 22. Mass Assignment Rule

Do not write arbitrary request bodies directly into database records.

Never do:

```javascript
repository.update(id, req.body);
```

unless every field has already been explicitly selected and validated.

Use allowlisted fields.

Example:

```text
allowed:
title
description
monthly_rent
available_from
```

Protected:

```text
status
property_id
created_at
published_at
```

when controlled by dedicated workflows.

---

# 23. Validation Rule

All external input must be validated server-side.

Use one consistent validation library.

Recommended:

```text
Zod
```

Validate:

* UUIDs
* strings
* numbers
* booleans
* dates
* enums/check values
* text length
* query parameters
* pagination
* file metadata

Frontend validation improves UX but is never authoritative.

---

# 24. API Contract Rule

Endpoints must follow:

```text
docs/API_SPEC.md
```

Do not invent alternate route structures without updating the specification first.

Example:

Approved:

```text
POST /api/v1/listings/:listingId/applications
```

Codex should not randomly replace this with:

```text
POST /apply
```

---

# 25. API Response Rule

Use:

```json
{
  "success": true,
  "data": {}
}
```

or:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Readable message"
  }
}
```

Do not return inconsistent response structures between modules.

---

# 26. HTTP Status Rule

Use appropriate status codes.

Examples:

```text
200 successful request
201 created
204 successful operation with no response body

400 invalid request
401 unauthenticated
403 unauthorized
404 resource unavailable
409 conflicting state
422 validation failure when appropriate
429 rate limited
500 unexpected server error
```

Do not return `200` for failed operations.

---

# 27. Database Migration Rule

Every schema change requires a migration.

Never:

* modify production database manually without migration
* rely on undocumented dashboard changes
* silently change tables during feature development

Store migrations under:

```text
database/migrations/
```

---

# 28. Migration Safety Rule

Codex must inspect existing schema before creating migrations.

Avoid:

* destructive migrations without review
* dropping columns casually
* renaming production columns without migration plan
* rewriting historical migrations already applied to shared environments

New changes should normally create a new migration.

---

# 29. Database Integrity Rule

Use database constraints for structural invariants.

Examples:

```text
foreign keys
NOT NULL
unique constraints
check constraints
partial unique indexes
```

Important invariants include:

```text
one application per tenant per listing
one accepted application per listing
one live listing per property
one cover image per property
```

Backend business rules complement database constraints.

---

# 30. Database Transaction Rule

Use transactions when multiple database updates form one business action.

Examples:

```text
application status update
+
status history
```

and:

```text
accept application
+
mark listing RENTED
+
status history
+
other application outcomes
```

Partial workflow updates are unacceptable.

---

# 31. Application State Rule

Application states are controlled.

Approved:

```text
DRAFT
SUBMITTED
UNDER_REVIEW
SHORTLISTED
VIEWING_INVITED
VIEWING_COMPLETED
ACCEPTED
REJECTED
WITHDRAWN
```

Do not allow arbitrary transitions.

Transition rules belong to backend service code.

---

# 32. Listing State Rule

Listing states:

```text
DRAFT
PENDING_REVIEW
ACTIVE
PAUSED
RENTED
CLOSED
```

Use dedicated transition methods.

Do not allow generic listing update endpoints to arbitrarily overwrite status.

---

# 33. Viewing State Rule

Viewing states:

```text
PROPOSED
CONFIRMED
DECLINED
COMPLETED
CANCELLED
NO_SHOW
```

Viewing actions must be role and state aware.

---

# 34. Error Handling

Use centralized error handling.

Application errors should use stable internal codes.

Examples:

```text
PROPERTY_NOT_FOUND
FORBIDDEN
INVALID_APPLICATION_TRANSITION
ACTIVE_LISTING_EXISTS
DUPLICATE_APPLICATION
```

Production responses must not contain:

* stack traces
* SQL
* secrets
* storage credentials
* infrastructure paths

---

# 35. Logging Rules

Log useful operational information.

Do log:

```text
request method
route
response status
request ID
unexpected server errors
important admin actions
```

Do not log:

```text
passwords
access tokens
refresh tokens
Supabase secret key
private verification evidence
unnecessary application content
```

---

# 36. Secret Handling

Never hardcode credentials.

Use environment variables.

Backend examples:

```text
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
DATABASE_URL
FRONTEND_URL
NODE_ENV
PORT
```

Frontend:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_API_BASE_URL
```

Never expose:

```text
SUPABASE_SECRET_KEY
DATABASE_URL
```

to browser code.

---

# 37. `.env` Rule

Actual `.env` files must not be committed.

Commit:

```text
.env.example
```

containing variable names and placeholders only.

Codex should never print actual secrets into source files or documentation.

---

# 38. Supabase Rule

The frontend may use Supabase directly for approved functionality such as:

* authentication
* carefully controlled realtime subscriptions

Core rental workflow writes should normally use:

```text
React
→ Node API
→ backend authorization
→ service logic
→ database
```

Do not bypass backend workflow rules using direct browser table writes.

---

# 39. Supabase Secret Key Rule

The Supabase secret key bypasses RLS.

Therefore:

* backend only
* never React
* never `VITE_*`
* never Git
* never logs

Any service using the secret key must still perform explicit backend authorization.

---

# 40. Row Level Security Rule

Use RLS where Supabase-exposed tables require protection.

Default:

> deny unless explicitly permitted

RLS complements backend authorization.

It does not replace backend ownership and workflow checks.

---

# 41. Public Data Rule

Public listing endpoints must expose only approved fields.

Never return raw database records directly.

Create explicit response objects.

Public listing responses should not accidentally expose:

```text
exact private property address
private landlord contact data
verification evidence
tenant data
internal moderation data
```

---

# 42. File Upload Rule

V1 property images:

Allowed:

```text
JPEG
PNG
WebP
```

Initial maximum:

```text
10 MB per image
20 images per property
```

Validate server-side:

* user authentication
* LANDLORD role
* property ownership
* actual file type
* file size
* storage destination

Do not trust original filename or browser MIME type.

---

# 43. Upload Path Rule

Generate storage paths.

Example:

```text
property-images/
  <landlord-user-id>/
    <property-id>/
      <generated-uuid>.jpg
```

Do not let clients provide arbitrary storage paths.

---

# 44. User-Generated Content

Treat all user text as untrusted.

Examples:

* property description
* tenant bio
* application message
* application answers
* messages
* report descriptions

Do not render raw HTML.

Avoid:

```text
dangerouslySetInnerHTML
```

for user-generated V1 content.

---

# 45. Messaging Rule

V1 messaging supports:

```text
text
timestamps
read state
```

Do not implement:

* attachments
* audio
* video
* calls
* HTML messages
* external URL previews

unless separately approved.

---

# 46. Search Rule

Use PostgreSQL search/filtering in V1.

Do not introduce Elasticsearch.

Supported filters should follow `API_SPEC.md`.

Sorting must use a server-side allowlist.

Do not allow arbitrary SQL field names from query parameters.

---

# 47. Pagination Rule

Default:

```text
20
```

Maximum:

```text
100
```

Potentially large endpoints must be paginated.

Do not return unlimited record sets.

---

# 48. Dependency Rule

Before adding a package, determine:

1. Is it necessary?
2. Can existing dependencies solve the problem?
3. Can standard Node/React functionality solve it?
4. Is the package maintained?
5. Does it create security risk?
6. Does it create architectural complexity?

Do not install dependencies merely for convenience.

---

# 49. Package Manager Rule

Use one package manager consistently throughout the JavaScript project.

Recommended:

```text
npm
```

Commit:

```text
package-lock.json
```

Do not mix:

```text
npm
yarn
pnpm
```

within the same project without explicit migration approval.

---

# 50. Coding Style

Prefer:

* descriptive names
* small functions
* explicit behavior
* reusable modules
* clear error handling
* low coupling
* consistent formatting

Avoid:

* clever but difficult code
* unnecessary abstraction
* deeply nested logic
* giant controllers
* giant React components
* magic constants

---

# 51. Naming Conventions

## JavaScript

Use:

```text
camelCase
```

for variables and functions.

Example:

```javascript
applicationService
getListingById
currentUser
```

Use:

```text
PascalCase
```

for React components.

Example:

```text
PropertyCard
ApplicationDetailsPage
```

---

# 52. Database Naming

Use:

```text
snake_case
```

Examples:

```text
property_images
tenant_profiles
created_at
```

---

# 53. Constants

Workflow states and similar repeated values should be centralized.

Example:

```text
constants/applicationStatus.js
constants/listingStatus.js
constants/userRoles.js
```

Avoid repeating literal strings throughout the application.

---

# 54. Comments

Comments should explain:

* why something is done
* unusual business rules
* non-obvious technical decisions

Avoid comments that merely repeat code.

Bad:

```javascript
// increment count
count++;
```

Useful:

```javascript
// Only one accepted application is allowed per listing.
// Database also enforces this through a partial unique index.
```

---

# 55. Documentation Rule

When a feature changes:

* API contract
* database schema
* architecture
* security model
* workflow rules

Codex must update the corresponding documentation.

Code and documentation should not intentionally contradict each other.

---

# 56. Testing Rule

Every meaningful feature should include appropriate tests.

Do not treat tests as optional cleanup after implementation.

Tests are part of the feature.

---

# 57. Unit Tests

Use unit tests for:

* validators
* state-transition logic
* utility functions
* business rules

---

# 58. Integration Tests

Use integration tests for:

* API routes
* database behavior
* authentication
* authorization
* ownership
* validation
* conflicts

At minimum, protected endpoints should test:

```text
happy path
unauthenticated
wrong role
wrong ownership
invalid input
not found
conflict when applicable
```

---

# 59. Security Tests

Security tests must explicitly attempt:

```text
Tenant A accessing Tenant B application
Landlord A changing Landlord B property
Tenant setting role to ADMIN
Landlord self-setting VERIFIED
Tenant setting application status ACCEPTED
Non-participant accessing conversation
```

Tests should demonstrate these actions fail.

---

# 60. End-to-End Testing

The complete core workflow must eventually be automated:

```text
Landlord
→ register
→ create property
→ create listing
→ publish

Tenant
→ register
→ search
→ apply
→ submit

Landlord
→ review
→ shortlist
→ invite to viewing

Tenant
→ confirm viewing

Landlord
→ complete viewing
→ accept

System
→ application ACCEPTED
→ listing RENTED
```

---

# 61. Test Data

Use dedicated test data.

Never run destructive automated tests against production.

Testing environments should contain multiple users so ownership boundaries can be tested properly.

---

# 62. Test Failure Rule

A task is not considered complete when relevant tests fail.

Codex must either:

* fix the failure, or
* clearly report why it cannot be resolved within task scope

Do not hide failing tests.

---

# 63. Linting

The project should use consistent linting.

Recommended:

```text
ESLint
```

Frontend and backend code should pass lint checks before task completion.

---

# 64. Formatting

Use a consistent formatter if introduced.

Recommended:

```text
Prettier
```

Do not introduce competing formatting systems.

---

# 65. CI Rule

Pull requests should eventually run:

```text
lint
unit tests
integration tests
build
```

A broken build should not be merged into `main`.

---

# 66. Git Branch Rule

Use:

```text
main
develop
feature/*
```

Codex should normally work on a dedicated feature branch.

Example:

```text
feature/property-management
```

---

# 67. Commit Rule

Commits should be logically focused.

Preferred style:

```text
feat(properties): add property creation API

feat(properties): build landlord property form

test(properties): add authorization tests

fix(listings): prevent duplicate live listing
```

Avoid:

```text
stuff
changes
updates
final
```

---

# 68. Commit Scope

Do not bundle unrelated major changes into one commit.

A commit should be understandable and reversible.

---

# 69. Production Rule

Codex must not automatically perform destructive production operations.

Do not automatically:

* drop production tables
* reset production database
* delete production storage
* remove production users
* rotate production keys
* run destructive migrations

Production operations require deliberate human control.

---

# 70. Development Environment Rule

Codex should work against:

```text
development
```

or controlled testing environments.

Production should not be the default development target.

---

# 71. Bootstrap Rule

Before feature implementation begins, the project should have:

* frontend setup
* backend setup
* environment examples
* testing framework
* linting
* base routing
* database connection
* Supabase configuration
* centralized error handling
* repository structure

Bootstrap should not implement unrelated product functionality.

---

# 72. Task Completion Report

When Codex completes a task, it should report:

```text
Summary

Files changed

Database migrations added

API endpoints added/changed

Tests added

Tests run

Test results

Security considerations

Known limitations

Documentation updated

Recommended next step
```

Do not begin the next task automatically.

---

# 73. Bug Fix Rule

When fixing a bug:

1. reproduce it
2. identify root cause
3. fix the root cause
4. add regression test where practical
5. verify no related workflow broke

Avoid cosmetic patches that hide the underlying issue.

---

# 74. Refactoring Rule

Refactor when there is a clear reason:

* duplicated logic
* difficult testability
* security concern
* maintainability problem
* feature requirement

Do not perform large refactors simply because an alternative design looks cleaner.

---

# 75. TODO Rule

Do not leave vague TODOs.

Bad:

```text
TODO fix later
```

Better:

```text
TODO: Add email delivery after in-app notification flow is validated.
Tracked outside V1 notification task.
```

Important incomplete work should go into the backlog rather than hidden comments.

---

# 76. AI/ML Rule

Do not introduce Python/ML functionality until required by a defined product task.

Potential future uses:

* duplicate listing detection
* image similarity
* listing recommendations
* fraud signals
* market analytics

Do not build:

```text
tenant suitability score
best tenant score
automatic tenant decision
```

without an explicit future product and legal review.

---

# 77. Privacy Rule

Collect minimum necessary personal information.

Do not add fields for:

* passports
* national IDs
* bank statements
* payslips
* exact salary
* credit data
* background checks

without a separate approved feature and privacy design.

---

# 78. Exact Address Rule

Public APIs should not expose exact property address by default.

Public listing pages should initially use:

```text
district
locality
neighbourhood
```

unless the product specification later explicitly changes this policy.

---

# 79. Admin Rule

Admin functionality exists for:

* moderation
* verification
* reports
* user management
* analytics

Admin must not:

* choose tenants
* negotiate rentals
* change tenant applications to benefit a landlord
* act as rental intermediary

---

# 80. Verification Rule

Do not display vague verification status.

Prefer:

```text
Email verified
Phone verified
Landlord identity reviewed
Property information reviewed
```

Do not claim verification stronger than what was actually performed.

---

# 81. Accessibility Rule

Frontend work should consider:

* semantic HTML
* keyboard accessibility
* form labels
* readable errors
* adequate focus states
* meaningful buttons
* image alt text

Do not rely solely on visual color differences to communicate status.

---

# 82. Mobile-First Rule

All primary user flows must work on mobile browsers.

At minimum test:

* registration
* search
* listing details
* application form
* landlord application review
* viewing confirmation
* messaging

Do not design desktop-only workflows.

---

# 83. Performance Rule

Avoid obvious performance problems.

Examples:

* unbounded queries
* loading all messages at once
* fetching full-resolution images unnecessarily
* repeated API requests in render loops
* N+1 database queries where easily avoidable

Do not introduce complex caching systems before measurement demonstrates need.

---

# 84. Accessibility vs Speed

Do not sacrifice essential accessibility or security merely to ship faster.

Marketplace launch speed matters, but core safety and usability remain requirements.

---

# 85. No Silent Assumptions

When a task contains an unresolved product decision that materially affects architecture or user behavior, Codex should:

1. check project documentation
2. use an existing documented rule where possible
3. if still unresolved, report the assumption needed

Codex should not invent major product policy silently.

---

# 86. Reasonable Implementation Decisions

Codex may independently make low-risk implementation decisions such as:

* internal function names
* component decomposition
* test helper organization
* local utility organization
* minor UI implementation details

provided they remain consistent with project rules.

Not every small decision requires human approval.

---

# 87. Definition of Done

A task is complete only when:

* requested behavior works
* relevant authorization exists
* validation exists
* errors are handled
* database integrity is maintained
* tests exist where appropriate
* relevant tests pass
* lint/build pass where relevant
* documentation is updated if contracts changed
* no unrelated scope was introduced

---

# 88. Codex Startup Instruction

When Codex begins work on a new task, it should be instructed:

```text
Read:
docs/PRODUCT_SPEC.md
docs/ARCHITECTURE.md
docs/DATABASE.md
docs/API_SPEC.md
docs/SECURITY.md
docs/DEVELOPMENT_RULES.md
docs/TESTING.md
docs/ROADMAP.md
tasks/CURRENT_TASK.md

Implement only the current task.

Inspect existing code before changing it.

Follow the existing architecture.

Do not implement future backlog features.

Add required validation, authorization and tests.

Run relevant tests after implementation.

Report changes and stop when the task is complete.
```

---

# 89. Final Development Principle

Codex should behave like a disciplined engineer working inside an established product architecture.

The objective is not to generate the most code.

The objective is to create:

> secure, understandable, tested, maintainable software that implements the approved rental workflow without unnecessary complexity.
