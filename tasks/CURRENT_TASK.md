# TASK-026 — Deployment & Private-Beta Readiness

## Status

IN PROGRESS — awaiting production-provider authorization and login

## Priority

P0 — Release

## Objective

Prepare and deploy the completed prototype for a controlled private beta.

The feature set remains FROZEN.

This task covers:

- production-ready environment configuration
- frontend deployment
- backend deployment
- Supabase production configuration
- Auth redirect configuration
- production CORS
- health checks
- deployment smoke testing
- release/rollback documentation
- private-beta operational checklist

Do NOT implement new product functionality.

---

# 1. Required Reading

Read all governing documentation and inspect TASK-000 through TASK-025.

Especially:

docs/ARCHITECTURE.md
docs/SECURITY.md
docs/TESTING.md
docs/DEVELOPMENT_RULES.md
README.md

Review all environment-variable usage before deployment.

---

# 2. Feature Freeze

Allowed:

- deployment configuration
- environment fixes
- production-only configuration fixes
- deployment bug fixes
- broken URL/path fixes
- CORS/Auth callback fixes
- health/readiness fixes
- documentation
- release scripts/checks

Not allowed:

- new rental features
- redesigns
- new workflow states
- analytics product features
- payments
- contracts
- AI recommendations

---

# 3. Deployment Architecture

Target architecture:

Frontend:
Vercel

Backend:
use the existing documented supported platform selected for this repository
(Railway, Render, or Fly.io)

Database/Auth/Storage:
Supabase

Do not introduce new infrastructure unnecessarily.

---

# 4. Environment Separation

Do not expose development secrets in production.

Ensure clear separation between:

development
test/integration
production

Frontend production variables may include only browser-safe values such as:

VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_API_BASE_URL

Backend production variables may include:

SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
DATABASE_URL
frontend/CORS origin configuration
environment/runtime settings

Never expose backend secrets through VITE variables.

---

# 5. Secret Audit

Before deployment verify:

- no `.env` files tracked
- no secret keys in source
- no DB credentials in frontend
- no credentials in build output
- no credentials in deployment documentation
- no secrets printed during deployment

Run:

npm run security:check

before release.

---

# 6. Production Supabase

Prefer a production/private-beta Supabase project isolated from destructive development testing.

Do not reset or destroy the existing development project.

If a separate production project is used:

apply all migrations forward-only using the established migration workflow.

Verify the complete migration ledger.

Do not manually recreate tables through the dashboard.

---

# 7. Migration Gate

Before production deployment confirm:

all TASK-001 through TASK-025 migrations are present and ordered correctly.

Run database/catalog verification.

Production schema must match the repository migration ledger.

No migration rewriting.

No database reset.

---

# 8. Supabase Storage

Verify required buckets exist/configure reproducibly:

property-images
verification-evidence

Confirm:

- private configuration
- expected file limits
- browser direct restrictions
- signed/backend-mediated access behavior

Verification evidence must remain private.

---

# 9. Supabase Auth URLs

Configure production:

Site URL
Redirect URLs

for the deployed frontend.

Ensure these flows work on production URLs:

registration
login
logout
email confirmation
forgot password
reset password
PKCE callback

Do not leave production dependent only on localhost callback URLs.

---

# 10. Production CORS

Configure the backend allowlist for the actual deployed frontend origin.

Production startup must fail safely if required CORS configuration is absent or invalid.

Do not use wildcard `*` for private API access.

Retain localhost development configuration separately.

---

# 11. Frontend API Configuration

Production frontend must communicate with the deployed backend using configuration.

Do not hard-code localhost API URLs.

Confirm production build contains the intended backend base URL.

---

# 12. Backend Health

Ensure production exposes:

GET /api/v1/health

Health endpoint should confirm the process is alive without leaking:

credentials
database URLs
internal configuration
stack traces

Do not expose privileged diagnostics publicly.

---

# 13. Backend Instance Count

TASK-023 rate limiting is process-local.

For the private beta, deploy the backend in a topology consistent with that limitation.

Prefer:

one application instance

unless the rate limiter is intentionally redesigned later.

Document this limitation.

Do not add Redis during TASK-026.

---

# 14. HTTPS

Production frontend and backend must be served via HTTPS.

No mixed-content requests.

Supabase callbacks must use HTTPS production URLs.

---

# 15. Backend Production Behavior

Verify:

NODE_ENV=production

Production errors must remain sanitized.

No development stack traces.

Logging must remain metadata-focused and must not log:

tokens
passwords
messages
application answers
verification evidence
secret keys

---

# 16. Build

Production builds must succeed:

frontend
backend startup/runtime

Run:

npm run build

No build-breaking warnings/errors.

The existing Vite bundle >500 kB advisory may remain documented as LOW.

Do not expand scope purely to remove that warning.

---

# 17. Production Database Verification

Against the deployment database verify:

migration ledger
tables
indexes
constraints
RLS
function grants
Storage configuration

All privileged SECURITY DEFINER functions must remain service-role-only.

---

# 18. Production Smoke Test

After deployment run a bounded production/private-beta smoke test.

At minimum:

public homepage/listings load

login works

protected route works

TENANT can browse listing

LANDLORD can access own dashboard

ADMIN can access ADMIN area

backend health works

frontend reaches backend

Supabase Auth session works

No CORS failure

No obvious browser console error

Do not create destructive workflow data unless using controlled beta fixtures.

---

# 19. Critical Workflow Smoke

Using controlled production/private-beta fixtures where safe, verify representative:

listing access
application creation
message/conversation access

Do not rerun destructive concurrency/load tests against production.

Full heavy verification remains against the development/QA environment.

---

# 20. Security Production Gate

Run:

npm run security:check

Confirm:

zero HIGH/CRITICAL production vulnerabilities

no tracked secrets

no unexpected privileged function grants

no public verification evidence

no permissive RLS drift

---

# 21. Rate Limit Smoke

Verify normal production usage is not incorrectly rate-limited.

Do not intentionally flood the deployed service.

Confirm expected 429 behavior using bounded controlled requests if safe.

---

# 22. Error Smoke

Verify representative invalid request produces:

safe product error

not:

stack trace
PostgreSQL error
filesystem path
Supabase internal details

---

# 23. ADMIN Bootstrap

Ensure the private-beta environment has at least one controlled ACTIVE ADMIN account.

Do not make ADMIN publicly self-registerable.

Do not commit ADMIN credentials.

Document the secure manual bootstrap process without passwords.

---

# 24. Beta Test Accounts

If controlled LANDLORD/TENANT accounts are needed for smoke testing:

create them through normal Auth flows or approved operational tooling.

Never commit test credentials.

Clearly distinguish controlled test records from real beta users.

---

# 25. Private-Beta Access

This is a controlled beta.

Do not add a large new invitation system.

Document how initial participants will be onboarded.

Use existing registration/account controls unless a manual operational process is needed.

---

# 26. Operational Checklist

Create a concise private-beta checklist covering:

daily health check
Supabase availability
backend availability
frontend availability
new reports
pending listing reviews
pending verifications
suspended accounts
user-reported defects

Do not build an operations dashboard.

---

# 27. Incident Basics

Document what to do if:

backend unavailable
frontend unavailable
Supabase unavailable
secret suspected exposed
abusive account identified
incorrect listing becomes public

Keep this as operational documentation.

Do not introduce full incident-management infrastructure.

---

# 28. Rollback Plan

Document deployment rollback.

At minimum:

frontend rollback/redeploy
backend rollback/redeploy
application commit rollback strategy

Database migrations remain forward-only.

Do NOT recommend destructive database rollback/reset.

If a migration causes a defect:

create a forward corrective migration.

---

# 29. Release Identification

Document the Git commit/tag deployed to private beta.

Create a release tag if consistent with repository workflow, for example:

private-beta-v0.1.0

Do not tag until all release gates pass.

---

# 30. Documentation

Update:

README.md

with production-safe setup/deployment overview.

Create/update:

docs/DEPLOYMENT.md

Include:

architecture
environment-variable names without values
frontend deployment
backend deployment
Supabase migration process
Auth URLs
CORS
Storage
health check
rollback
known limitations

Create/update:

docs/PRIVATE_BETA_CHECKLIST.md

Do not include credentials.

---

# 31. Known Limitations

Document clearly:

- process-local rate limiting
- no payments
- no lease generation
- no digital signatures
- no escrow
- manual verification
- no MFA
- no external penetration test
- no email/SMS/push notifications
- Vite bundle-size advisory
- private-beta status

Do not hide these limitations.

---

# 32. Release Gate

Before declaring private-beta ready:

npm run lint
npm run test
npm run test:e2e
npm run build
npm run format:check
npm run security:check
git diff --check

Database verification must pass.

Hosted development regression must remain healthy.

Production/private-beta smoke checks must pass.

---

# 33. No Destructive Production Operations

Never:

db reset
drop production schema
delete hosted user data
rewrite migration history
run destructive fixture cleanup against real users

Forward-only corrections only.

---

# 34. Acceptance Criteria

TASK-026 is complete only when:

- [ ] Frontend is deployed over HTTPS.
- [ ] Backend is deployed over HTTPS.
- [ ] Frontend communicates with backend.
- [ ] Production CORS is correct.
- [ ] Production environment variables configured securely.
- [ ] No backend secret exposed to frontend.
- [ ] Supabase production/private-beta project is configured.
- [ ] All migrations applied forward-only.
- [ ] Database verification passes.
- [ ] RLS/grants remain correct.
- [ ] Private Storage remains private.
- [ ] Production Auth URLs work.
- [ ] Login/session flow works.
- [ ] Password reset callback works or is verified.
- [ ] Health endpoint works.
- [ ] ADMIN access works.
- [ ] Normal tenant/landlord access works.
- [ ] Production errors are sanitized.
- [ ] Production logging remains safe.
- [ ] Process-local rate-limit deployment limitation documented.
- [ ] Security check passes.
- [ ] E2E suite remains passing in QA environment.
- [ ] Production smoke tests pass.
- [ ] Rollback process documented.
- [ ] Operational checklist documented.
- [ ] Known beta limitations documented.
- [ ] No destructive production database action occurred.
- [ ] No secrets committed or exposed.
- [ ] Release commit/tag identified.

---

# 35. Completion Report

Report:

## Summary

## Deployment Architecture

## Frontend Deployment

Include deployed environment/domain but no secrets.

## Backend Deployment

Include deployed environment/domain but no secrets.

## Supabase Environment

Explain migration/Auth/Storage configuration.

## Environment Variables

List names only.

Do not report values.

## CORS

## Authentication Smoke

## Production Smoke Tests

## Database Verification

## Security Gate

## Operational Readiness

## Rollback Plan

## Release Tag / Commit

## Known Limitations

## Tests

Unit/integration:
E2E:
Hosted QA:
Production smoke:
Failed:
Skipped:

## Final Verification

npm run lint
npm run test
npm run test:e2e
npm run build
npm run format:check
npm run security:check
git diff --check

## Private-Beta Verdict

State one:

READY FOR PRIVATE BETA

or

NOT READY FOR PRIVATE BETA

If not ready, list exact blockers.

Then stop.
