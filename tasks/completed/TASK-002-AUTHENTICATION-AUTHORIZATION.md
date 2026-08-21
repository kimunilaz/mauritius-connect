# TASK-002 — Authentication & Authorization

## Status

READY

## Priority

P0 — Foundation / Security

## Objective

Implement the authentication and authorization foundation for the Mauritius Rental Platform.

This task establishes:

- Supabase Auth frontend flows
- secure server-side access-token verification
- application profile onboarding
- authenticated-user resolution
- role authorization
- ACTIVE/SUSPENDED account enforcement
- frontend authentication state
- protected frontend route infrastructure
- authentication and authorization tests

This task establishes identity and access control only.

Do not implement rental product features.

---

# 1. Required Reading

Before changing code, read:

docs/PRODUCT_SPEC.md
docs/ARCHITECTURE.md
docs/DATABASE.md
docs/API_SPEC.md
docs/SECURITY.md
docs/DEVELOPMENT_RULES.md
docs/TESTING.md
docs/ROADMAP.md
docs/UI_RULES.md
database/README.md
tasks/CURRENT_TASK.md

Also inspect the implementation produced by:

TASK-000
TASK-001

before modifying anything.

Do not silently contradict the governing documentation.

---

# 2. Approved Authentication Architecture

Use:

Supabase Auth

for:

- email/password signup
- email verification
- login
- logout
- password reset
- session lifecycle

Do not build a custom password authentication system.

Do not store passwords in the application database.

Do not create custom authentication tokens.

---

# 3. Authentication Responsibility

Architecture:

Browser
   ↓
Supabase Auth
   ↓
Supabase access token
   ↓
React
   ↓
Authorization: Bearer <access_token>
   ↓
Node API
   ↓
verify Supabase token
   ↓
derive authenticated user UUID
   ↓
resolve application profile
   ↓
role + account-status authorization
   ↓
business endpoint

Supabase establishes authentication identity.

The Node application remains authoritative for:

- application roles
- account status
- ownership
- product authorization
- workflow permissions

---

# 4. Critical Identity Rule

Never trust these values from client input:

user_id
tenant_id
landlord_id
admin_id
sender_user_id
changed_by_user_id
role

when they can be derived from the authenticated identity.

Authenticated identity must come from the verified Supabase access token.

---

# 5. Application Roles

Approved V1 roles:

TENANT
LANDLORD
ADMIN

Public onboarding may create only:

TENANT
LANDLORD

A normal user must never be able to create:

ADMIN

through:

- registration
- profile onboarding
- frontend requests
- user metadata
- request-body manipulation

---

# 6. Role Source of Truth

The authoritative application role is:

public.profiles.role

Do NOT authorize users based on editable Supabase:

user_metadata

or frontend state.

User metadata may contain harmless presentation information if needed later, but it must not be trusted for application authorization.

---

# 7. Admin Provisioning

TASK-002 must NOT implement public ADMIN registration.

ADMIN accounts will later be provisioned through a controlled administrative/operations process.

Any request such as:

{
  "role": "ADMIN"
}

to public profile registration must fail.

---

# 8. Frontend Authentication Routes

Implement foundation routes:

/register
/login
/forgot-password
/reset-password
/auth/callback
/onboarding
/account

The `/account` page is only a simple authenticated foundation page.

Do not build tenant or landlord dashboards yet.

Future dashboards belong to later tasks.

---

# 9. Registration Page

Implement:

/register

Support:

- email
- password
- password confirmation

Use Supabase Auth directly from the browser.

Do not send passwords through the Node application.

Do not create a custom:

POST /api/v1/auth/register

password endpoint.

---

# 10. Registration Flow

Recommended flow:

User enters email/password
        ↓
React calls Supabase Auth signup
        ↓
Supabase creates auth identity
        ↓
Email confirmation where enabled
        ↓
User obtains authenticated session
        ↓
User completes /onboarding
        ↓
Node creates application profile

The application profile must not be treated as successfully registered until the authenticated user completes profile onboarding.

---

# 11. Signup Messaging

Do not assume a session always exists immediately after signup.

Supabase email-confirmation configuration may require the user to verify their email before receiving a normal authenticated session.

UI must handle both cases safely.

If verification is required, display a clear message such as:

Check your email to confirm your account.

Do not leak unnecessary information about unrelated accounts.

---

# 12. Auth Callback

Implement:

/auth/callback

according to the authentication flow supported by the installed Supabase client version.

The callback must:

- allow Supabase to establish/restore the authenticated session
- handle success
- handle failure
- avoid displaying raw token values
- redirect appropriately after authentication

If the installed Supabase client uses an authorization-code/PKCE exchange, handle it correctly.

If session handling is automatically supported by the configured browser client, avoid unnecessary duplicate token handling.

Do not invent a custom callback protocol.

---

# 13. Login Page

Implement:

/login

Support:

email
password

Use Supabase Auth:

signInWithPassword

or the current equivalent supported by the installed Supabase JavaScript client.

On successful login:

1. establish frontend auth state
2. call the Node `/api/v1/auth/me` endpoint
3. determine whether application onboarding exists
4. navigate appropriately

---

# 14. Login Destination

If authenticated Supabase user has no application profile:

redirect to:

/onboarding

If application profile exists and is ACTIVE:

redirect to:

/account

Do not create tenant/landlord dashboards yet.

---

# 15. Logout

Implement logout through Supabase Auth.

After logout:

- clear application auth/profile state
- protected frontend screens become inaccessible
- return user to appropriate public/login screen

Do not manually manipulate raw access tokens unless required by the supported Supabase client lifecycle.

---

# 16. Forgot Password

Implement:

/forgot-password

Use Supabase Auth password recovery.

User submits:

email

The page should display a neutral confirmation such as:

If an account is associated with that email, check your inbox for password reset instructions.

Avoid unnecessary account enumeration.

---

# 17. Reset Password

Implement:

/reset-password

Use the authenticated recovery flow provided by Supabase.

Allow:

new password
confirm new password

Validate:

- password exists
- password confirmation matches
- password meets the chosen minimum application policy

Do not implement custom password hashing.

---

# 18. Password Validation

Use a reasonable initial minimum length consistent with Supabase's configured requirements.

Do not invent complex password composition rules such as mandatory:

uppercase
lowercase
symbol
number

unless required by actual Supabase configuration or approved product policy.

The frontend may display Supabase Auth errors safely.

Do not expose internal server details.

---

# 19. Supabase Browser Client

Continue using the existing frontend Supabase client foundation.

Frontend variables:

VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY

Never expose:

SUPABASE_SECRET_KEY

to frontend code.

---

# 20. Frontend Session State

Create a centralized authentication state mechanism.

Recommended concept:

AuthContext

or an equivalent lightweight architecture.

It should expose concepts such as:

session
authUser
profile
loading
isAuthenticated
onboardingRequired
signOut
refreshProfile

Do not introduce Redux or another state-management library solely for authentication.

---

# 21. Frontend Session Initialization

On application startup:

- restore Supabase session
- subscribe to supported auth-state changes
- update local auth state
- retrieve application profile when appropriate

Avoid multiple competing auth-state implementations.

---

# 22. Frontend Trust Rule

Frontend authentication state exists for:

- UI
- routing
- user experience

It is NOT security enforcement.

Backend endpoints must independently verify every protected request.

---

# 23. API Authentication Header

Authenticated frontend requests to the Node API must send:

Authorization: Bearer <supabase_access_token>

Centralize this behavior in the frontend API service layer.

Do not manually duplicate bearer-token logic throughout React components.

---

# 24. API Client Foundation

Create or extend a reusable frontend API client/helper.

It should:

- use VITE_API_BASE_URL
- attach current access token for authenticated requests
- parse standard API responses
- handle standard errors consistently

Do not add Axios unless there is a genuine need.

Native fetch is sufficient for V1 unless the existing implementation already chose otherwise.

---

# 25. Server Token Verification

Implement backend authentication middleware.

Recommended:

authenticateUser

It must:

1. read Authorization header
2. require Bearer scheme
3. extract access token
4. cryptographically/server-validate the Supabase-issued token using the current supported Supabase API
5. derive the authenticated auth user UUID
6. attach only safe authenticated identity information to request context
7. reject invalid tokens

Do not simply decode JWT payload without verification.

Do not trust `getSession()` as server authorization proof.

---

# 26. Preferred Supabase Verification Method

Use the current supported Supabase server-side token verification mechanism.

For the installed Supabase JavaScript client, prefer:

supabase.auth.getClaims(token)

when supported and suitable.

It verifies Supabase-issued JWT claims using the project's signing configuration.

If project/client compatibility requires:

supabase.auth.getUser(token)

instead, document why.

Do not implement handwritten JWT cryptography unless there is a compelling requirement.

---

# 27. Backend Auth Client

Token verification should use a non-privileged Supabase server client configured with:

SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY

where supported.

Do not use the privileged secret key merely to verify normal user identity unless Supabase's supported implementation requires it.

---

# 28. Backend Supabase Session Configuration

Backend Supabase clients must not behave like browser clients.

Disable inappropriate server-side session persistence where supported.

Backend clients should not:

- persist user sessions to local storage
- automatically expose sessions between requests
- accidentally reuse one user's authentication state for another user

Each request must be independently authorized.

---

# 29. Authenticated Request Context

After successful token validation, make available a controlled request identity object.

Example concept:

req.auth = {
  userId: "<verified-uuid>"
}

Additional verified claims may exist internally if needed.

Do not attach or trust arbitrary client profile data.

---

# 30. Application Profile Resolution

Create middleware/service infrastructure to resolve:

profiles

using:

profiles.id = verified Supabase auth user ID

Recommended separation:

authenticateUser
        ↓
loadApplicationProfile
        ↓
requireActiveAccount
        ↓
requireRole(...)

`register-profile` is the important exception because an authenticated auth user may legitimately not yet have an application profile.

---

# 31. Missing Application Profile

For normal authenticated application endpoints, a valid Supabase session without a `profiles` row means onboarding is incomplete.

Use a stable application error code such as:

PROFILE_NOT_FOUND

or:

ONBOARDING_REQUIRED

Choose one consistent code and document it.

Preferred for frontend flow:

ONBOARDING_REQUIRED

HTTP status should be selected consistently with the project's error conventions.

Do not treat the user as anonymous if their Supabase token is valid.

---

# 32. Register Application Profile Endpoint

Implement:

POST /api/v1/auth/register-profile

Authentication:

required Supabase auth identity

Application profile:

not required beforehand

Request:

{
  "role": "TENANT",
  "first_name": "Jane",
  "last_name": "Doe",
  "phone": "+230..."
}

Allowed role values:

TENANT
LANDLORD

Never:

ADMIN

---

# 33. Profile Registration Identity

The endpoint must derive:

profiles.id

from the verified access token.

Never accept:

id
user_id

from the request as ownership authority.

Payload attempts to supply another user ID must not affect the created profile.

---

# 34. Profile Registration Validation

Validate:

role
first_name
last_name
phone

according to API/document rules.

At minimum:

- first_name required
- last_name required
- role required
- role allowlisted
- string lengths bounded
- phone bounded and safely normalized/validated at a reasonable level

Do not introduce an external phone-validation service during TASK-002.

---

# 35. Profile Registration Behavior

Create:

public.profiles

for the authenticated Supabase user.

Initial:

account_status = ACTIVE

phone_verified = FALSE

unless another trusted mechanism explicitly establishes phone verification.

Do not allow the request to control:

account_status
phone_verified
created_at
updated_at

---

# 36. Role-Specific Profiles

TASK-002 should NOT build the complete tenant or landlord profile feature.

That belongs to TASK-003.

Therefore:

register-profile

creates the base:

profiles

record only.

Do not implement full:

tenant_profiles
landlord_profiles

onboarding forms in TASK-002.

TASK-003 will create/manage the role-specific profile records.

---

# 37. Duplicate Profile Registration

If an authenticated user already has a profile:

do not create another profile.

Return a stable conflict response.

Recommended:

409 Conflict

code:

PROFILE_ALREADY_EXISTS

Do not permit the endpoint to change an existing user's role by calling registration again.

---

# 38. Role Immutability

Normal users must not change:

profiles.role

through authentication/profile endpoints.

No endpoint in TASK-002 may offer role updates.

Role changes require future controlled administration.

---

# 39. GET Current User Endpoint

Implement:

GET /api/v1/auth/me

Authentication:

required

Application profile:

required

Response should use the standard API envelope.

Example:

{
  "success": true,
  "data": {
    "id": "uuid",
    "role": "TENANT",
    "first_name": "Jane",
    "last_name": "Doe",
    "phone": "+230...",
    "profile_photo_url": null,
    "phone_verified": false,
    "account_status": "ACTIVE"
  }
}

Do not return:

password
access token
refresh token
Supabase secret
internal database metadata

---

# 40. Account Status Enforcement

Approved statuses:

ACTIVE
SUSPENDED
DELETED

Implement middleware such as:

requireActiveAccount

Normal protected application operations should require:

ACTIVE

A user with:

SUSPENDED

must not remain authorized for normal platform operations simply because their Supabase JWT is still valid.

---

# 41. Suspended Account Response

Use a stable error.

Recommended:

403 Forbidden

code:

ACCOUNT_SUSPENDED

message:

This account is suspended.

Do not expose unnecessary internal moderation reasoning through generic authentication middleware.

---

# 42. Deleted Account Response

If account_status is:

DELETED

block normal product access.

Use a stable application error.

Do not silently treat the profile as ACTIVE.

Exact future anonymization/deletion behavior remains outside TASK-002.

---

# 43. Role Authorization Middleware

Implement reusable:

requireRole(...roles)

Examples:

requireRole('TENANT')
requireRole('LANDLORD')
requireRole('ADMIN')

Middleware must use the application profile loaded by the backend.

It must not use:

request body role
query role
frontend role
user_metadata role

as authorization authority.

---

# 44. Multi-Role Middleware Support

Although users have one primary V1 role, middleware may support:

requireRole('TENANT', 'LANDLORD')

or equivalent if useful.

Do not redesign the database into multi-role accounts.

---

# 45. Authorization Error

Authenticated user with wrong role:

403 Forbidden

Recommended code:

FORBIDDEN

or:

ROLE_REQUIRED

Use one consistent convention.

Do not return 401 for an authenticated user merely because their role lacks permission.

---

# 46. No Product Test Routes

Do not add permanent endpoints such as:

/tenant-test
/landlord-test
/admin-test

solely to demonstrate role middleware.

Test middleware using:

- unit tests
- controlled test-only Express applications
- existing authentication endpoints

Do not pollute production API with demonstration routes.

---

# 47. Privileged Database Access

Because TASK-001 RLS is deny-by-default and the Node API is the trusted application layer, controlled server operations may use the existing privileged Supabase client.

The privileged client uses:

SUPABASE_SECRET_KEY

and must remain backend-only.

---

# 48. Privileged Client Safety

Any operation using the privileged Supabase client must first perform the required application checks.

For `register-profile`:

- token verified
- identity derived from token
- role allowlisted
- payload validated
- duplicate profile checked

Secret-key access must never mean:

"skip authorization."

---

# 49. Repository Layer

Follow the approved backend layering.

Recommended additions:

repositories/profileRepository.js

services/authService.js

controllers/authController.js

routes/authRoutes.js

middleware/authenticateUser.js

middleware/loadApplicationProfile.js

middleware/requireActiveAccount.js

middleware/requireRole.js

validators/authValidators.js

Exact filenames may follow the existing TASK-000 conventions.

Do not collapse everything into the route file.

---

# 50. API Route Structure

Mount under:

/api/v1/auth

Required:

POST /api/v1/auth/register-profile
GET  /api/v1/auth/me

Supabase handles password authentication directly.

Do not add unnecessary backend:

POST /login
POST /register
POST /logout

endpoints.

---

# 51. Standard Responses

Success:

{
  "success": true,
  "data": {}
}

Errors:

{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Readable message."
  }
}

Continue using centralized error handling from TASK-000.

---

# 52. Authentication Error Codes

Add stable codes where appropriate:

AUTH_REQUIRED
INVALID_TOKEN
ONBOARDING_REQUIRED
PROFILE_ALREADY_EXISTS
ACCOUNT_SUSPENDED
ACCOUNT_DELETED
FORBIDDEN
VALIDATION_ERROR
INTERNAL_ERROR

Do not expose raw Supabase or database errors directly.

---

# 53. Bearer Header Tests

Explicitly test:

no Authorization header
empty Authorization header
wrong authentication scheme
empty Bearer token
invalid token
valid verified token

Invalid authentication must fail safely.

---

# 54. Token Manipulation Test

A merely decodable but unverified/fake JWT must not authenticate.

Do not write tests that only test Base64 decoding.

Mock the Supabase verification boundary appropriately where real Supabase Auth is unavailable.

---

# 55. Profile Registration Tests

Required:

authenticated user creates TENANT profile
authenticated user creates LANDLORD profile

Reject:

ADMIN role
missing first name
missing last name
invalid role
oversized values
duplicate profile

Also test attempts to submit:

id
user_id
account_status
phone_verified

cannot override protected values.

---

# 56. Identity Ownership Test

Create/mock:

Auth User A

Submit payload attempting:

{
  "user_id": "<User-B>",
  ...
}

Expected database profile ID:

User A

Never User B.

Prefer rejecting unknown protected fields if validation configuration supports strict objects.

---

# 57. Current User Tests

GET /api/v1/auth/me

Test:

valid ACTIVE profile → 200
missing token → 401
invalid token → 401
valid auth identity with no application profile → onboarding/profile error
SUSPENDED profile → 403
DELETED profile → blocked

---

# 58. Role Middleware Tests

Test:

TENANT accepted for TENANT requirement
TENANT rejected for LANDLORD requirement
TENANT rejected for ADMIN requirement

LANDLORD accepted for LANDLORD requirement
LANDLORD rejected for ADMIN requirement

ADMIN accepted for ADMIN requirement

Do not require production test routes.

---

# 59. Role Escalation Tests

Explicitly prove:

normal user cannot register ADMIN
normal user cannot change own role
Supabase user_metadata role does not override profiles.role
request-body role does not override authorization middleware

These are release-critical tests.

---

# 60. Account Status Tests

Explicitly prove:

ACTIVE → permitted

SUSPENDED → normal protected access denied

DELETED → normal protected access denied

Do not rely on frontend route hiding.

---

# 61. Frontend Protected Routes

Create a reusable protected-route mechanism.

It should handle:

loading
unauthenticated
authenticated but onboarding required
authenticated and onboarded

Do not implement tenant/landlord/admin product dashboards yet.

---

# 62. Protected Account Page

Implement:

/account

as a minimal foundation screen.

It may show:

name
role
account status
logout button

This is not the final account/profile UX.

It exists to prove authenticated frontend/backend integration.

---

# 63. Onboarding Route

Implement:

/onboarding

Accessible when:

Supabase user is authenticated
AND
application profile does not yet exist

Form:

role
first name
last name
phone optional

Allowed roles:

Tenant
Landlord

Do not show:

Admin

as an option.

---

# 64. Onboarding Submission

On submit:

React
  ↓
POST /api/v1/auth/register-profile
Bearer access token
  ↓
backend verifies token
  ↓
creates application profile
  ↓
frontend refreshes `/auth/me`
  ↓
redirects to /account

Do not trust the selected role until backend validation succeeds.

---

# 65. Existing Profile Onboarding Access

If authenticated user already has application profile and manually navigates to:

/onboarding

redirect to:

/account

Do not allow profile re-registration.

---

# 66. Unauthenticated Protected Access

If unauthenticated user navigates to:

/account
/onboarding where auth is required

redirect appropriately to:

/login

Preserve destination only if implementation is simple and safe.

Do not overbuild routing infrastructure.

---

# 67. Auth Page Access

If an already authenticated and fully onboarded user navigates to:

/login
/register

the application may redirect to:

/account

This is a UX behavior only.

Backend security remains authoritative.

---

# 68. Loading State

Auth initialization is asynchronous.

Do not briefly render protected content before session/profile state is known.

Show a controlled loading state during initialization.

Avoid authentication UI flashing.

---

# 69. Error Handling

Authentication UI must safely handle:

invalid credentials
network error
email not confirmed where surfaced
expired recovery flow
profile onboarding failure
API unavailable

Do not show raw stack traces.

---

# 70. Session Tokens

Do not:

- print access tokens
- print refresh tokens
- put tokens in application logs
- include tokens in error messages
- manually persist duplicate copies in arbitrary localStorage keys
- send tokens as query parameters to the Node API

Allow the supported Supabase client to manage browser session persistence.

---

# 71. Request Logging

Existing request logger must not log:

Authorization

header contents.

Add a regression test if practical.

---

# 72. RLS

TASK-001 enabled RLS with no broad policies.

Do not weaken this posture during TASK-002 simply to make frontend access easier.

Core application profile reads/writes should go through the Node API.

No:

USING (true)

or:

WITH CHECK (true)

private-table policies.

---

# 73. Database Migrations

TASK-002 should not require schema changes if TASK-001 is sufficient.

If a genuine schema correction is required:

- create a NEW migration
- do not edit applied TASK-001 migrations
- explain why
- update DATABASE.md if the contract changes materially

Do not modify the initial migration history casually.

---

# 74. Real Supabase Integration

If valid development Supabase configuration is available:

perform real authentication integration verification.

If not available:

do not invent credentials
do not commit credentials
do not fake real Supabase verification

Use mocks/test doubles around the Supabase boundary while preserving realistic contracts.

Report the limitation clearly.

---

# 75. Supabase Project Configuration Documentation

Create or update concise documentation explaining manual Supabase Auth configuration required for development.

Recommended:

docs/AUTH_SETUP.md

Include:

- required environment variable names
- email/password provider requirement
- email confirmation behavior
- redirect/callback URL requirements
- password recovery redirect
- frontend/backend key separation
- how to create a test user safely
- no ADMIN public signup

Do not include actual credentials.

---

# 76. Email Verification

Do not falsely claim email is verified merely because an application profile exists.

Supabase Auth remains responsible for email confirmation state.

Do not add:

profiles.email_verified

unless architecture explicitly requires it.

If the UI displays email-verification state, derive it from trusted Supabase Auth information.

---

# 77. phone_verified

TASK-002 does not implement phone OTP verification.

Therefore newly registered profiles must remain:

phone_verified = FALSE

even if a phone number is supplied.

Do not display:

Phone verified

unless an actual verification workflow later establishes it.

---

# 78. Frontend Styling

Follow:

docs/UI_RULES.md

Keep authentication UI:

- simple
- responsive
- accessible
- mobile-first

Do not spend TASK-002 building elaborate visual design.

---

# 79. Accessibility

Auth forms must include:

proper labels
keyboard-accessible controls
meaningful buttons
field-level errors
visible focus states

Password fields should use appropriate input types.

---

# 80. Security Boundaries

TASK-002 must prove that:

Supabase authenticated
≠
application-authorized

A valid auth user still requires:

application profile
ACTIVE status
correct role

before accessing role-controlled application functionality.

---

# 81. Testing Strategy

Add:

backend unit tests
backend integration tests
frontend component/integration tests

Focus on behavior and security.

Do not depend on visual browser inspection for all correctness.

---

# 82. Frontend Tests

At minimum test:

registration form behavior
login form behavior
onboarding role options exclude ADMIN
onboarding submits bearer-authenticated request
protected account route redirects unauthenticated user
authenticated onboarded user can access account foundation page
logout clears protected UI
forgot-password confirmation behavior

Mock Supabase responsibly.

---

# 83. Backend Tests

At minimum test:

Bearer token parsing
verified identity resolution
invalid token rejection
register-profile success
ADMIN registration rejection
protected-field mass assignment
duplicate profile conflict
GET /auth/me
missing profile/onboarding behavior
SUSPENDED account blocking
DELETED account blocking
role middleware

---

# 84. Existing Security Regression

Explicitly confirm no new code exposes:

SUPABASE_SECRET_KEY

in frontend build/configuration.

If practical, retain/add static verification ensuring secret-key variable names are not consumed in frontend runtime code.

---

# 85. Existing TASK-000 Regression

After TASK-002:

health endpoint must still work

CORS tests must still pass

404 handling must still pass

frontend bootstrap functionality must remain valid where intentionally retained

Do not regress foundation behavior.

---

# 86. Existing TASK-001 Regression

Database tests must still pass.

Do not modify critical database invariants.

Run the complete existing test suite.

---

# 87. No Rental Product Features

Do NOT implement:

tenant detailed profile
landlord detailed profile
properties
property images
listings
search
saved listings
applications
application questions
viewings
messaging
notifications
reports
admin dashboard
verification workflow

Those belong to later tasks.

---

# 88. No OAuth Yet

Do not implement:

Google
Apple
Facebook
GitHub
Microsoft

social login during TASK-002.

Email/password is sufficient for V1 foundation.

---

# 89. No MFA User Feature Yet

Do not implement full end-user MFA during TASK-002.

Administrative MFA may be addressed before public launch according to SECURITY.md.

Do not expand scope.

---

# 90. No Custom Auth Microservice

Do not create:

separate authentication service
custom JWT issuer
password database
authentication microservice

Supabase Auth remains the identity provider.

---

# 91. Dependencies

Do not add another authentication library unless genuinely necessary.

Prefer existing:

@supabase/supabase-js
zod
React
Express

Do not introduce:

Passport
Auth0
Clerk
Firebase Auth

or another identity provider.

---

# 92. Required Root Verification

Before completion run:

npm run lint
npm run test
npm run build
npm run format:check

Also run:

git diff --check

All existing database checks must remain passing.

---

# 93. Manual Verification

Where environment permits, manually verify:

frontend starts
backend starts
register route loads
login route loads
forgot-password route loads
onboarding route loads
account protection works
backend health endpoint works

If actual Supabase credentials are available, additionally verify:

signup
email confirmation behavior
login
application profile onboarding
/auth/me
logout
password-reset request

Do not claim these live Supabase flows passed unless they were actually executed.

---

# 94. Acceptance Criteria

TASK-002 is complete only when:

- [ ] Supabase email/password registration frontend exists.
- [ ] Login frontend exists.
- [ ] Logout works.
- [ ] Forgot-password flow exists.
- [ ] Reset-password flow exists.
- [ ] Auth callback handling exists where required.
- [ ] Centralized frontend auth state exists.
- [ ] Frontend API requests can attach current Supabase access token.
- [ ] Backend securely verifies Supabase-issued access tokens.
- [ ] Backend does not trust decoded-unverified JWTs.
- [ ] Verified auth user ID is derived server-side.
- [ ] POST /api/v1/auth/register-profile exists.
- [ ] register-profile allows TENANT.
- [ ] register-profile allows LANDLORD.
- [ ] register-profile rejects ADMIN.
- [ ] register-profile cannot create a profile for another auth user.
- [ ] protected fields cannot be mass-assigned.
- [ ] duplicate application profile creation is prevented.
- [ ] role cannot be changed through normal auth endpoints.
- [ ] GET /api/v1/auth/me exists.
- [ ] application profile is authoritative for application role.
- [ ] user_metadata is not trusted for role authorization.
- [ ] ACTIVE account enforcement exists.
- [ ] SUSPENDED accounts are blocked.
- [ ] DELETED accounts are blocked.
- [ ] reusable requireRole middleware exists.
- [ ] wrong-role requests are rejected with 403.
- [ ] /onboarding exists.
- [ ] onboarding never offers ADMIN.
- [ ] /account is protected.
- [ ] frontend does not expose Supabase secret key.
- [ ] RLS deny-by-default posture is not weakened.
- [ ] AUTH_SETUP documentation exists.
- [ ] authentication/authorization tests pass.
- [ ] TASK-000 tests still pass.
- [ ] TASK-001 database tests still pass.
- [ ] lint passes.
- [ ] build passes.
- [ ] format check passes.
- [ ] no rental-domain product functionality was implemented.
- [ ] no secrets were committed.

---

# 95. Definition of Done

TASK-002 requires:

Supabase Auth frontend
+
verified backend identity
+
application onboarding
+
role authorization
+
account-status enforcement
+
protected routing
+
security tests
+
documentation

A login form alone does not complete TASK-002.

---

# 96. Completion Report

When finished report:

## Summary

Describe the authentication and authorization foundation.

## Frontend Auth

Report:

registration
login
logout
forgot password
reset password
callback handling
auth state
protected routes
onboarding

## Backend Authentication

Explain:

how bearer tokens are verified
which Supabase verification method is used
why that method was selected
what identity is attached to request context

## Application Profile Onboarding

Report:

POST /api/v1/auth/register-profile

and its protection rules.

## Current User

Report:

GET /api/v1/auth/me

behavior.

## Authorization Middleware

List:

authentication middleware
profile-loading middleware
account-status middleware
role middleware

## Role Security

Explicitly confirm:

ADMIN cannot self-register
role does not come from user_metadata
role cannot be mass-assigned
role cannot be changed through normal auth routes

## Account Status

Report ACTIVE/SUSPENDED/DELETED behavior.

## Files Created

List important files.

## Files Modified

List important files.

## Database Changes

Expected:

none

If migrations were necessary, list and justify them.

## Tests Added

Report important auth/security tests.

## Test Results

Tests added:
Tests run:
Tests passed:
Tests failed:
Tests skipped:

## Supabase Verification

Clearly distinguish:

mocked/local authentication tests

from:

real Supabase authentication verification

If real Supabase environment was unavailable, state so.

## Root Verification

Report:

npm run lint
npm run test
npm run build
npm run format:check
git diff --check

## Security Notes

Confirm:

no passwords stored
no secret key exposed
no tokens logged
RLS not weakened
ADMIN self-registration impossible

## Dependencies Added

List any dependency additions and why.

## Documentation Updated

List relevant documentation.

## Known Limitations

Report genuine remaining limitations.

## Recommended Next Task

TASK-003 — Tenant & Landlord Profiles

Then stop.

Do not implement TASK-003 automatically.