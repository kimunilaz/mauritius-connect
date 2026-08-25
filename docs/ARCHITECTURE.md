# Mauritius Rental Platform — Architecture

## 1. Architecture Goal

The system should be simple enough to launch quickly while being structured enough to support:

* real users
* future scaling
* verification
* analytics
* additional services
* secure rental workflows
* Codex-driven development

The architecture must prioritize:

* clear separation of responsibilities
* security
* maintainability
* mobile-first design
* simple deployment
* easy debugging
* minimal unnecessary infrastructure
* future extensibility

The project should avoid premature complexity.

---

# 2. Core Technology Stack

## Frontend

Use:

* React
* JavaScript
* HTML
* CSS

React is responsible for:

* page rendering
* routing
* forms
* state management
* API communication
* dashboard interfaces
* search UI
* application workflow UI
* messaging UI
* notifications UI

Do not introduce another frontend framework in V1.

---

# 3. Backend

Use:

* Node.js
* Express

The backend is responsible for:

* REST API routes
* authentication validation
* authorization
* business rules
* input validation
* ownership checks
* application state transitions
* listing state transitions
* viewing workflows
* messaging rules
* reports
* admin operations
* notification triggers
* communication with PostgreSQL and Supabase services

The frontend must never contain authoritative business or authorization rules.

---

# 4. Database

Use:

* PostgreSQL
* hosted through Supabase

PostgreSQL stores:

* profiles
* tenant profiles
* landlord profiles
* properties
* property images metadata
* listings
* saved listings
* rental applications
* custom application questions
* application answers
* application status history
* viewings
* conversations
* conversation participants
* messages
* notifications
* reports
* verification records
* admin audit logs

---

# 5. Authentication

Use:

* Supabase Auth

V1 authentication should support:

* email registration
* email verification
* login
* logout
* password reset

Potential later additions:

* Google sign-in
* phone authentication

Supabase Auth establishes user identity.

The Node.js backend remains responsible for application-level:

* roles
* ownership
* resource permissions
* business workflow rules

---

# 6. Supabase API Keys

Use Supabase's current key model.

## Frontend

The React application may receive:

```text
SUPABASE_PUBLISHABLE_KEY
```

In a Vite frontend this may be exposed as:

```text
VITE_SUPABASE_PUBLISHABLE_KEY
```

The publishable key is designed for public/client use.

It does not provide privileged backend access.

---

## Backend

Privileged Supabase operations may use:

```text
SUPABASE_SECRET_KEY
```

The secret key must:

* remain server-side
* never be exposed to React
* never be committed to Git
* never be included in a `VITE_*` environment variable

The secret key bypasses Row Level Security and must therefore only be used by trusted backend code.

---

# 7. Legacy Supabase Keys

Some Supabase projects may still expose older key names:

```text
anon
service_role
```

If encountered:

* `anon` corresponds conceptually to client/public access
* `service_role` is privileged server access

For new project documentation and environment configuration, prefer:

```text
SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
```

---

# 8. Storage

Use:

* Supabase Storage

Store:

* property images
* profile images
* future verification files

Do not store image binaries directly inside PostgreSQL.

PostgreSQL stores:

* storage path
* metadata
* relationship to property/user
* display order
* cover-image information

---

# 9. Realtime Functionality

Use Supabase Realtime only where it provides clear value.

Potential V1 uses:

* new messages
* unread message indicators
* application status updates
* notifications

Do not make every database operation realtime.

Standard API requests remain the default application interaction model.

---

# 10. Future Python Services

Python is not required for the core V1 application.

Reserve:

* Python
* FastAPI

for future specialized services.

Possible future services:

* duplicate property image detection
* duplicate listing detection
* fraud signals
* listing quality analysis
* rental market analytics
* property recommendations
* demand forecasting
* geographic analysis

These services should communicate with the main platform through APIs.

They must not automatically choose tenants.

---

# 11. PHP

PHP is not part of V1.

Do not introduce PHP unless a future integration creates a clear technical requirement.

Node.js remains the primary application backend.

---

# 12. High-Level Architecture

```text
                        USER BROWSER

                    React Web Application

              Tenant | Landlord | Administrator

                              |
                              |
                            HTTPS
                              |
                              v

                       Node.js Backend
                           Express

               -----------------------------
               |             |             |
               |             |             |
            Routes       Middleware      Services
               |             |             |
               --------------------------------
                              |
                              v

                       Repository Layer
                              |
                              v

                       Supabase Platform

        ------------------------------------------------
        |                    |                         |
        |                    |                         |
    PostgreSQL           Supabase Auth          Supabase Storage
                                                   
        |
        |
  Optional Realtime
  subscriptions

                              |
                              |
                     Future Specialist APIs
                              |
                              v

                     Python + FastAPI
```

---

# 13. Primary Application Request Flow

The default flow for rental workflow operations is:

```text
React
   ↓
Node.js REST API
   ↓
Authentication
   ↓
Authorization
   ↓
Validation
   ↓
Service Layer
   ↓
Repository Layer
   ↓
PostgreSQL
```

This applies to:

* properties
* listings
* applications
* viewings
* reports
* admin operations
* important state transitions

---

# 14. Direct Supabase Browser Access

The React application may directly use Supabase for approved capabilities such as:

* authentication
* carefully controlled realtime subscriptions

Direct browser writes to core rental workflow tables should not be the default.

Core rental operations should go through the Node.js API.

---

# 15. Frontend Architecture

Recommended:

```text
frontend/
│
├── src/
│   ├── components/
│   │   ├── common/
│   │   ├── forms/
│   │   ├── property/
│   │   ├── listings/
│   │   ├── applications/
│   │   ├── viewings/
│   │   ├── messaging/
│   │   └── admin/
│   │
│   ├── pages/
│   │   ├── public/
│   │   ├── tenant/
│   │   ├── landlord/
│   │   └── admin/
│   │
│   ├── hooks/
│   ├── services/
│   ├── context/
│   ├── utils/
│   ├── constants/
│   └── App.jsx
│
├── public/
├── package.json
└── .env.example
```

---

# 16. Frontend Components

Reusable components should include:

* Button
* Input
* Select
* Modal
* PropertyCard
* ApplicationCard
* StatusBadge
* ViewingCard
* NotificationItem
* EmptyState
* LoadingIndicator
* Pagination

Components should not contain large amounts of business logic.

---

# 17. Frontend Pages

Examples:

```text
public/
HomePage.jsx
SearchPage.jsx
PropertyDetailsPage.jsx
LoginPage.jsx
RegisterPage.jsx

tenant/
TenantDashboard.jsx
TenantProfile.jsx
TenantApplications.jsx
TenantApplicationDetails.jsx
SavedListings.jsx
TenantViewings.jsx
TenantMessages.jsx

landlord/
LandlordDashboard.jsx
PropertiesPage.jsx
CreatePropertyPage.jsx
ListingsPage.jsx
CreateListingPage.jsx
ApplicationsPage.jsx
ApplicationDetailsPage.jsx
LandlordViewings.jsx
LandlordMessages.jsx

admin/
AdminDashboard.jsx
UsersPage.jsx
ListingsPage.jsx
ReportsPage.jsx
VerificationPage.jsx
```

---

# 18. Frontend API Service Layer

React components should not repeat API request logic.

Create:

```text
services/
authService.js
propertyService.js
listingService.js
applicationService.js
viewingService.js
messageService.js
notificationService.js
adminService.js
```

Example:

```text
React Page
    ↓
applicationService.submitApplication()
    ↓
Node.js API
```

---

# 19. Backend Architecture

Recommended:

```text
backend/
│
├── src/
│   ├── config/
│   ├── controllers/
│   ├── routes/
│   ├── services/
│   ├── repositories/
│   ├── middleware/
│   ├── validators/
│   ├── constants/
│   ├── utils/
│   └── server.js
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
│
├── package.json
└── .env.example
```

---

# 20. Backend Layer Responsibilities

Use:

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

Each layer has a distinct responsibility.

---

# 21. Routes

Routes define:

* endpoint
* HTTP method
* middleware
* controller

Example:

```text
POST /api/v1/properties
```

Routes must not contain major business logic.

---

# 22. Middleware

Middleware handles reusable concerns such as:

```text
authenticateUser
requireRole
validateRequest
rateLimit
errorHandler
requestLogger
```

Example:

```text
POST /api/v1/properties
        ↓
authenticateUser
        ↓
requireRole("LANDLORD")
        ↓
validatePropertyInput
        ↓
propertyController.create
```

---

# 23. Controllers

Controllers should:

* read request data
* call services
* return HTTP responses
* map errors to status codes

Controllers should remain small.

---

# 24. Services

Services contain business rules.

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

Example:

```text
applicationService.updateStatus()
```

must determine whether a requested state transition is valid.

This logic must not live inside React.

---

# 25. Repositories

Repositories handle persistence.

Examples:

```text
propertyRepository.create()
propertyRepository.findById()
propertyRepository.update()
```

Repositories should not determine:

* authorization
* ownership permissions
* valid application transitions
* business workflow decisions

Those belong to services.

---

# 26. API Design

Use REST for V1.

Do not introduce GraphQL.

Base URL:

```text
/api/v1
```

Examples:

```text
GET    /api/v1/listings
GET    /api/v1/listings/:id

POST   /api/v1/properties
PATCH  /api/v1/properties/:id

POST   /api/v1/listings/:id/applications

GET    /api/v1/tenant/applications
GET    /api/v1/landlord/applications

PATCH  /api/v1/applications/:id/status

POST   /api/v1/viewings

GET    /api/v1/conversations
POST   /api/v1/conversations/:id/messages

POST   /api/v1/reports
```

---

# 27. API Response Format

Success:

```json
{
  "success": true,
  "data": {}
}
```

Error:

```json
{
  "success": false,
  "error": {
    "code": "APPLICATION_NOT_FOUND",
    "message": "Application not found."
  }
}
```

Do not return raw database errors.

---

# 28. Authentication Flow

Recommended:

```text
User logs in
      ↓
Supabase Auth verifies credentials
      ↓
Access token issued
      ↓
React sends token with API request
      ↓
Node authentication middleware validates token
      ↓
Backend resolves authenticated Supabase user
      ↓
Application profile resolved
      ↓
Role + ownership checks occur
      ↓
Business operation performed
```

---

# 29. Identity Rule

Never trust these values simply because the frontend sends them:

```text
user_id
tenant_id
landlord_id
sender_user_id
changed_by_user_id
role
```

Where possible, derive them from the authenticated user.

---

# 30. Authorization Model

Two distinct checks are required.

## Role Authorization

Example:

Only:

```text
LANDLORD
```

may create properties.

## Resource Authorization

Being a landlord alone is insufficient.

The landlord must own the property being changed.

Example:

```text
Landlord A
```

must never modify:

```text
Landlord B's property
```

even if the API URL is manually changed.

---

# 31. Database Access

The Node backend is the primary access layer for important business data.

Core workflows must not rely on frontend permissions alone.

Privileged Supabase access should only happen after the backend has completed required:

* authentication
* role checks
* ownership checks
* validation
* business rules

---

# 32. Environment Variables

Backend:

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

to React.

---

# 33. Development Environments

At minimum:

```text
development
production
```

Recommended before launch:

```text
development
staging
production
```

Development data must never affect production.

---

# 34. Database Migration Strategy

All database schema changes must use migrations.

Store migrations in:

```text
database/migrations/
```

Do not manually alter production schema without a corresponding migration.

---

# 35. Database Seed Strategy

Store development seed scripts in:

```text
database/seeds/
```

Development data should include:

* landlord
* multiple tenants
* properties
* listings
* applications
* viewing
* conversation
* messages

Never automatically seed production.

---

# 36. File Upload Architecture

Recommended V1:

```text
Landlord chooses image
        ↓
React sends upload
        ↓
Node API
        ↓
authenticate landlord
        ↓
verify property ownership
        ↓
validate image
        ↓
Supabase Storage
        ↓
store path + metadata in PostgreSQL
```

Validate:

* actual file type
* file size
* property ownership
* image count
* storage path

---

# 37. Messaging Architecture

Conversation belongs to:

* one listing
* one landlord
* one tenant

Users may access conversation only if they are participants.

V1 messages support:

* text
* created timestamp
* participant-level read state

Do not implement:

* voice
* video
* calls
* attachments

in initial V1.

---

# 38. Application State Architecture

Application state transitions are controlled by backend services.

Example:

```text
DRAFT
  ↓
SUBMITTED
  ↓
UNDER_REVIEW
  ↓
SHORTLISTED
  ↓
VIEWING_INVITED
  ↓
VIEWING_COMPLETED
  ↓
ACCEPTED
```

Alternative paths:

```text
SUBMITTED → REJECTED
UNDER_REVIEW → REJECTED
SHORTLISTED → REJECTED
```

Tenant may withdraw from approved states.

Not every state can transition to every other state.

---

# 39. Listing State Architecture

Example:

```text
DRAFT
  ↓
PENDING_REVIEW
  ↓
ACTIVE
```

From active:

```text
ACTIVE → PAUSED
ACTIVE → RENTED
ACTIVE → CLOSED
```

Paused:

```text
PAUSED → ACTIVE
```

Historical rented and closed listings remain stored.

---

# 40. Notification Architecture

Model notifications around domain events such as:

```text
ApplicationSubmitted
ApplicationShortlisted
ApplicationRejected
ApplicationAccepted
ViewingProposed
ViewingConfirmed
MessageReceived
```

An event may create:

* in-app notification
* later email notification

Business logic should not be tightly coupled to one notification channel.

---

# 41. Admin Architecture

Admin endpoints:

```text
/api/v1/admin/*
```

All require:

```text
ADMIN
```

Important admin actions should create audit logs.

Examples:

* user suspension
* listing removal
* verification approval
* report resolution

---

# 42. Error Handling

Use centralized backend error handling.

Error codes may include:

```text
AUTH_REQUIRED
FORBIDDEN
PROPERTY_NOT_FOUND
LISTING_NOT_FOUND
APPLICATION_NOT_FOUND
INVALID_STATUS_TRANSITION
VALIDATION_ERROR
UPLOAD_FAILED
INTERNAL_ERROR
```

Do not expose:

* stack traces
* SQL
* secrets
* internal infrastructure details

in production responses.

---

# 43. Logging

Backend logs should record:

* request failures
* server errors
* suspicious authentication attempts
* important admin actions
* unexpected database failures

Do not log:

* passwords
* access tokens
* refresh tokens
* Supabase secret key
* sensitive verification documents

---

# 44. Testing Architecture

## Unit Tests

Test:

* validators
* business logic
* status transition rules

## Integration Tests

Test:

* API routes
* database behavior
* authorization
* role restrictions
* resource ownership

## End-to-End Tests

Test complete workflows.

Primary E2E:

```text
Landlord registers
↓
Creates property
↓
Creates listing
↓
Publishes listing

Tenant registers
↓
Searches
↓
Applies

Landlord reviews
↓
Shortlists
↓
Invites to viewing

Tenant confirms

Landlord completes viewing
↓
Accepts tenant
```

---

# 45. Security Architecture

Security includes:

* authenticated API access
* server-side authorization
* role checks
* ownership checks
* input validation
* rate limiting
* controlled CORS
* secure headers
* protected secrets
* safe file uploads
* database constraints
* RLS where appropriate
* safe public serialization

---

# 46. Mobile-First Architecture

Use one responsive React application.

Primary workflows must work on:

* smartphones
* tablets
* desktops

Do not create separate mobile and desktop applications.

---

# 47. Deployment Architecture

Recommended:

```text
Frontend
   ↓
Vercel

Backend
   ↓
Railway / Render / Fly.io

Database/Auth/Storage
   ↓
Supabase
```

TASK-026 selects Render for the controlled private-beta Node backend. The
service runs exactly one application instance because TASK-023 rate limiting is
process-local. `render.yaml` is the authoritative topology; horizontal scaling
requires a later approved shared-limiter design. See `docs/DEPLOYMENT.md` for
the environment and release procedure. The backend remains deployable to
another Node-compatible provider without major application rewrites.

---

# 48. CI/CD

GitHub should run at minimum:

```text
lint
unit tests
integration tests
build
```

on pull requests.

Failing tests or builds should block production merges.

---

# 49. Git Architecture

Recommended:

```text
main
develop
feature/*
```

Flow:

```text
feature/*
   ↓
develop
   ↓
main
```

`main` contains production-ready code.

---

# 50. Codex Architecture Rule

Codex must not silently change:

* React
* Node.js
* Express
* PostgreSQL
* Supabase
* authentication provider
* storage provider
* repository structure
* major product boundaries

If a major change appears necessary, Codex must document:

```text
Proposed change
Reason
Impact
Migration requirement
Risks
```

before implementing it.

---

# 51. Dependency Rule

Before introducing another dependency, Codex must consider:

* whether existing tools solve the problem
* whether native Node/React functionality is sufficient
* package maintenance
* security impact
* architectural complexity

Avoid unnecessary dependency growth.

---

# 52. Scalability Strategy

Do not prematurely optimize for millions of users.

Scale based on measured bottlenecks.

Likely future areas:

* search
* database indexing
* image delivery
* realtime messaging
* notification volume
* analytics workloads

---

# 53. Search Architecture

Start with PostgreSQL filtering.

Do not introduce Elasticsearch in V1.

Search fields include:

* district
* locality
* rent
* bedrooms
* bathrooms
* property type
* furnished
* available date
* pets
* parking

Add specialized search infrastructure only if PostgreSQL becomes insufficient.

---

# 54. Location Architecture

Store structured location fields:

```text
country
district
locality
neighbourhood
address
latitude
longitude
```

Coordinates enable future:

* map search
* nearby listings
* distance calculations
* geographic analytics

---

# 55. Privacy Architecture

Apply data minimization.

Do not collect sensitive data simply because it might be useful later.

Every personal field should support an existing product requirement.

Future sensitive verification information requires:

* restricted storage
* explicit access policies
* retention rules
* deletion procedures

---

# 56. Architectural Non-Goals

V1 does not require:

* microservices
* Kubernetes
* Elasticsearch
* multiple databases
* blockchain
* event-streaming infrastructure
* distributed caches
* dedicated ML infrastructure
* custom authentication infrastructure

---

# 57. Final Architecture Principle

The project should follow:

> Simple core architecture, strong security boundaries, controlled workflows, explicit ownership, and room to expand later.

The architecture should make it easy for Codex to build predictable, testable features without redesigning the system during every task.
