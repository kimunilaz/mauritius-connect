# TASK-002A — Real Supabase Integration Verification

## Status

READY

## Priority

P0 — Integration Gate

## Objective

Verify the database and authentication foundations from TASK-001 and TASK-002 against an actual development Supabase project before implementing additional product functionality.

This task is an integration verification task.

Do not implement TASK-003 or any rental product functionality.

---

## Required Reading

Read:

docs/ARCHITECTURE.md
docs/DATABASE.md
docs/API_SPEC.md
docs/SECURITY.md
docs/AUTH_SETUP.md
docs/DEVELOPMENT_RULES.md
docs/TESTING.md
database/README.md
tasks/CURRENT_TASK.md

Inspect the TASK-001 and TASK-002 implementation.

---

## 1. Environment

Use the developer-provided Supabase DEVELOPMENT project.

Required frontend variables:

VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY

Required backend variables:

SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
DATABASE_URL

Do not print, commit, copy into documentation, or expose any credential values.

Confirm .env files remain Git-ignored.

---

## 2. Do Not Create Credentials

If required environment variables are missing:

STOP and report exactly which variable names are missing.

Do not fabricate values.

Do not substitute fake credentials.

---

## 3. Apply Database Migrations

Apply the TASK-001 migrations to the real development Supabase database using a supported reproducible workflow.

Do not manually recreate tables in the dashboard.

The migration files in:

database/migrations/

must remain the source of truth.

Do not rewrite existing TASK-001 migrations simply because the hosted database is empty.

---

## 4. Verify Real Schema

Against the actual Supabase development database, verify:

- all 21 application tables exist
- profiles.id references auth.users.id
- required foreign keys exist
- RLS is enabled
- no unintended broad RLS policies exist
- required indexes exist
- updated_at triggers exist
- partial unique indexes exist

Critical invariants:

- one cover image per property
- one live listing per property
- one application per tenant/listing
- one accepted application per listing

---

## 5. Auth Configuration Review

Verify the development Supabase project supports:

- email/password signup
- email confirmation according to chosen development configuration
- login
- password recovery

Verify Site URL and redirect allowlist match the frontend implementation.

Expected development origin:

http://localhost:5173

Review the actual implementation before configuring callback URLs.

Likely routes include:

/auth/callback
/reset-password

Do not change the app merely to match an incorrectly configured dashboard.

---

## 6. Real Registration Verification

Using a test email address controlled by the developer:

1. open the real frontend
2. register with email/password
3. verify actual Supabase Auth behavior
4. complete email confirmation if enabled
5. confirm a real auth.users identity exists

Do not use production or sensitive credentials.

---

## 7. Real JWT Verification

After login:

1. obtain the normal browser-managed Supabase session
2. call the Node API through the frontend
3. verify authenticateUser accepts the real Supabase token
4. verify getClaims succeeds
5. verify req.auth user identity corresponds to the actual auth.users UUID

Do not log the access token.

---

## 8. Real Onboarding Verification

Complete:

/onboarding

as TENANT.

Verify:

POST /api/v1/auth/register-profile

creates:

public.profiles

with:

id = authenticated auth.users.id
role = TENANT
account_status = ACTIVE
phone_verified = FALSE

Confirm no ADMIN privilege is introduced.

---

## 9. Real /auth/me Verification

Verify:

GET /api/v1/auth/me

returns the application profile for the real user.

Verify safe fields only.

---

## 10. Logout/Login Verification

Verify:

logout
→ protected route unavailable

then:

login again
→ session restored correctly
→ /auth/me succeeds
→ /account accessible

---

## 11. Duplicate Onboarding

Attempt to access or submit onboarding again.

Expected:

- frontend redirects appropriately, and/or
- backend returns PROFILE_ALREADY_EXISTS

Existing role must not change.

---

## 12. LANDLORD Verification

Create a second development account and complete onboarding as:

LANDLORD

Verify:

profiles.role = LANDLORD

Do not build landlord profile functionality.

---

## 13. ADMIN Escalation Verification

Using a normal authenticated account, attempt API manipulation requesting:

ADMIN

Expected:

rejected.

Also confirm user_metadata containing:

role: ADMIN

does not provide ADMIN application authorization.

Do not create permanent unsafe metadata merely for testing if another controlled test method exists.

---

## 14. Suspended Account Verification

Using the development database/admin tooling, set a development test profile to:

SUSPENDED

without changing Supabase Auth identity.

Verify the same still-valid authentication identity cannot access normal protected application functionality.

Expected:

403 ACCOUNT_SUSPENDED

Restore the development account after verification.

---

## 15. RLS Verification

Using the publishable-key/user context, confirm private application tables are not broadly readable or writable directly from the frontend.

The Node privileged path may operate only after application authorization.

Do not weaken RLS to make this test pass.

---

## 16. Password Recovery

Trigger the real forgot-password flow using a development account.

Verify:

- request succeeds
- redirect URL is accepted by Supabase
- recovery link reaches the intended application route
- new password can be established
- login with the new password succeeds

Do not log recovery tokens.

---

## 17. Email Confirmation

If development email confirmation is enabled, verify:

signup
→ confirmation email
→ allowed redirect
→ authenticated/onboarding flow

If confirmation is intentionally disabled in development, document that configuration and do not claim confirmation was tested.

Production email confirmation policy remains a later deployment decision.

---

## 18. Existing Automated Tests

Run:

npm run lint
npm run test
npm run build
npm run format:check

Also run:

git diff --check

All TASK-000, TASK-001 and TASK-002 automated tests must continue passing.

---

## 19. No Product Development

Do not implement:

tenant detailed profile
landlord detailed profile
properties
listings
applications
messaging
viewings
admin features

This task is integration verification only.

---

## Acceptance Criteria

- [ ] Development Supabase project successfully connected.
- [ ] TASK-001 migrations successfully applied to real Supabase PostgreSQL.
- [ ] Real Supabase schema inspected.
- [ ] RLS confirmed enabled.
- [ ] Critical database indexes/constraints confirmed.
- [ ] Real email/password signup exercised.
- [ ] Real Supabase access token accepted by backend getClaims verification.
- [ ] Real TENANT onboarding succeeds.
- [ ] Real LANDLORD onboarding succeeds.
- [ ] /auth/me succeeds with real Supabase identity.
- [ ] Logout/login succeeds.
- [ ] Duplicate onboarding cannot change role.
- [ ] ADMIN escalation fails.
- [ ] SUSPENDED user is blocked despite valid Auth identity.
- [ ] Direct publishable-key private-table access remains denied.
- [ ] Password recovery tested if development email delivery permits it.
- [ ] Email confirmation behavior documented and tested where enabled.
- [ ] No secrets committed or logged.
- [ ] Full automated suite still passes.
- [ ] No TASK-003 functionality implemented.

---

## Completion Report

Report:

### Supabase Project Integration

Do not reveal project secrets.

Report whether connectivity succeeded.

### Database Deployment

List migrations applied.

### Database Verification

Report real Supabase checks separately from PGlite checks.

### Real Authentication Tests

Report:

signup
email confirmation
login
JWT verification
onboarding
/auth/me
logout
password recovery

Clearly mark anything not tested.

### Role Tests

Report:

TENANT
LANDLORD
ADMIN escalation
SUSPENDED

### RLS Verification

Report real publishable-key behavior.

### Automated Verification

Report:

npm run lint
npm run test
npm run build
npm run format:check
git diff --check

### Code Changes

Prefer none or minimal integration fixes.

List any changes and why.

### Security

Confirm no credentials were committed, printed, or exposed.

### Known Limitations

List genuine remaining integration limitations.

### Recommended Next Task

TASK-003 — Tenant & Landlord Profiles

Then stop.

Do not begin TASK-003.