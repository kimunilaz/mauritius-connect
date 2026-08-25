# Private-Beta Checklist

This is the operator checklist for the controlled beta. Credential values,
tokens, database URLs, and account passwords belong in approved secret storage,
never in this file.

## Release approval

- [ ] Feature set remains frozen; no TASK-027 work is included.
- [ ] Release commit and tag are recorded.
- [ ] Vercel, Render, and Supabase owners are recorded privately.
- [ ] Render `starter` cost and one-instance topology are approved.
- [ ] Separate private-beta Supabase project and recovery posture are approved.
- [ ] All local, security, database, hosted-QA, E2E, build, format, and diff gates
      pass.

## Supabase

- [ ] Production project is not the destructive development/QA target.
- [ ] Migration ledger exactly matches the repository; changes were forward-only.
- [ ] Tables, indexes, constraints, RLS, and function grants pass catalog checks.
- [ ] Privileged `SECURITY DEFINER` functions are service-role-only.
- [ ] `property-images` is private with expected size/MIME restrictions.
- [ ] `verification-evidence` is private with expected size/MIME restrictions and
      backend-mediated signed access.
- [ ] Auth Site URL is the canonical frontend HTTPS origin.
- [ ] Exact confirmation/callback and reset-password redirect URLs are configured.
- [ ] A recovery baseline, retention, and restore owner are recorded privately.

## Backend and frontend

- [ ] Render has one application instance and health path `/api/v1/health`.
- [ ] Render secrets are server-side; logs and errors expose no sensitive content.
- [ ] CORS allows exactly the canonical Vercel origin, never `*`.
- [ ] Vercel contains only the three documented browser-safe application values.
- [ ] Production bundle uses the intended HTTPS `/api/v1` backend URL and contains
      no backend credential or database URL.
- [ ] HTTPS, SPA deep links, security headers, and no-index beta headers work.
- [ ] Production smoke passes for health, public access, Auth/session behavior,
      role protection, representative role access, application draft, and
      participant messaging.
- [ ] No unexpected browser console, network, CORS, or mixed-content errors occur.

## Daily operations

- [ ] Check Vercel frontend availability.
- [ ] Check Render health and recent deploy/runtime errors.
- [ ] Check Supabase service status, database capacity, Auth anomalies, and Storage.
- [ ] Review new reports and time-sensitive abuse concerns.
- [ ] Review pending listing approvals and verification submissions.
- [ ] Review suspended accounts and any scheduled reactivation decision.
- [ ] Triage user-reported defects by BLOCKER/HIGH/MEDIUM/LOW severity.
- [ ] Record material actions in the private operator log without sensitive data.

## Incident basics

- Backend unavailable: verify Render status/health/log metadata, halt a bad deploy,
  and redeploy the last known-good commit. Do not bypass Auth or rate limits.
- Frontend unavailable: verify Vercel status/domain, promote the last known-good
  deployment, then smoke API connectivity and Auth callbacks.
- Supabase unavailable: confirm provider status, pause risky operator mutations,
  preserve evidence, and resume only after health and consistency checks pass.
- Suspected secret exposure: revoke/rotate first, update server-side stores,
  redeploy, review access logs, and never copy the compromised value into notes.
- Abusive account: use existing ADMIN suspension controls, preserve the report and
  audit record, and document the decision privately.
- Incorrect public listing: use existing ADMIN removal or landlord pause controls,
  verify public disappearance, and retain the audit trail.

## Rollback verification

- [ ] Previous Vercel and Render deployments are identifiable by Git commit.
- [ ] Operators can promote/redeploy the last known-good application version.
- [ ] Any database correction will be a new forward migration; reset and migration
      history rewriting are prohibited.
- [ ] Health, CORS, Auth, public listing privacy, and protected access are re-smoked
      after rollback.

The authoritative procedure is [DEPLOYMENT.md](DEPLOYMENT.md).
