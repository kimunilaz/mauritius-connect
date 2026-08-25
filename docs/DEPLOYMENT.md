# Private-Beta Deployment

## Target and release policy

The supported private-beta topology is:

- Vercel static hosting for the React/Vite frontend
- one Render Node web-service instance for the Express API
- a dedicated Supabase project for PostgreSQL, Auth, and Storage

The single Render instance is intentional. TASK-023 rate limits are held in
process memory, so multiple instances would enforce separate counters. Do not
scale the API horizontally until the limiter is redesigned around a shared
store. Redis is not part of this release.

Production and private-beta changes are manually promoted. `render.yaml`
disables automatic backend deploys. Vercel must use the repository root as its
project root, `vercel.json`, and the production branch chosen by the release
owner.

## Required access

The release operator needs authenticated access to:

- the production/private-beta Supabase project
- the Render workspace that will own `mauritius-connect-api`
- the Vercel team/project that will own the frontend
- the Git remote and protected production branch, if provider Git imports are
  used

Do not paste credentials into commands, tickets, screenshots, documentation,
or chat. Use provider secret settings or a local ignored environment file.

## Environment contract

Only these application values may be exposed by Vite:

| Vercel variable | Scope | Purpose |
| --- | --- | --- |
| `VITE_API_BASE_URL` | Browser-safe | HTTPS Render URL ending in `/api/v1` |
| `VITE_SUPABASE_URL` | Browser-safe | HTTPS production Supabase project origin |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Browser-safe | Production publishable key |

Configure all three for Vercel Production. Configure them for Preview only if
preview deployments are allowed to contact an explicitly selected nonproduction
environment. Never create a `VITE_` variable containing a database URL, secret
key, service-role key, password, private key, or access token. Vercel builds fail
closed when the hosted production configuration is incomplete or uses HTTP.

The Render service requires:

| Render variable | Purpose |
| --- | --- |
| `NODE_ENV=production` | Sanitized production behavior |
| `FRONTEND_URL` | Exact Vercel HTTPS origin, with no path or wildcard |
| `SUPABASE_URL` | Production Supabase HTTPS origin |
| `SUPABASE_PUBLISHABLE_KEY` | Server-side Supabase client configuration |
| `SUPABASE_SECRET_KEY` | Privileged backend-only Supabase access |

`DATABASE_URL` is intentionally not required by the running API and should not
be granted to Render unless an approved operational command needs it. The
migration/verifier operator may hold it in an ignored local environment. Render
supplies `PORT`. The committed rate-limit values are safe configuration, not
credentials.

Production backend startup fails if its frontend origin or Supabase credentials
are absent. Both `FRONTEND_URL` and `SUPABASE_URL` must use HTTPS, and
`FRONTEND_URL` must be exactly one origin. CORS does not allow a wildcard.

## Deployment order

1. Create or select an isolated private-beta Supabase project. Do not repurpose
   a destructive QA project without an explicit release decision.
2. Record a provider backup or point-in-time recovery baseline according to the
   selected Supabase plan. Confirm restore ownership and retention in the
   private operational record.
3. Link the CLI to the production project without echoing its reference or
   credentials into logs. Inspect the migration list before changing anything.
4. Apply only pending repository migrations with the established forward-only
   `supabase db push` workflow. Never reset the hosted database and never edit a
   historical migration.
5. Run `npm run supabase:migrations:sync`, `npm run db:verify`, and
   `npm run db:verify:hosted`. Run the hosted catalog and Storage checks against
   the production project using controlled, non-destructive verification.
6. Reproducibly create/verify `property-images` and `verification-evidence` with
   the repository setup scripts. Both buckets must remain private with their
   documented MIME and size restrictions. Evidence access remains backend
   mediated through short-lived signed URLs.
7. In Supabase Auth, set the Site URL to the canonical Vercel HTTPS origin. Add
   exact redirect URLs for `/auth/callback` and `/auth/reset-password`. Keep
   localhost entries only for local development; do not use broad production
   wildcards.
8. Create the Render service from `render.yaml`. Review the paid `starter` plan,
   confirm `numInstances: 1`, set the required variables in Render's secret
   store, and deploy the approved release commit.
9. Confirm `GET /api/v1/health` returns the standard safe response over HTTPS.
10. Create/import the Vercel project from the repository root. Set the three
    browser-safe variables and deploy the same approved release commit.
11. Set Render `FRONTEND_URL` to the final canonical Vercel origin and redeploy
    if the originally reserved origin differs. Verify an unapproved Origin does
    not receive an allow-origin header.
12. Run the bounded production smoke checklist below. Do not run the full E2E,
    concurrency, load, or destructive fixture suite against production.

No schema operation in this procedure uses `db reset`, destructive SQL, or
hosted data deletion.

## Bounded production smoke

Use controlled private-beta accounts and minimal records clearly marked as
smoke data. Do not print account credentials or session tokens.

- health returns 200 and contains no diagnostic secrets
- public homepage and listing discovery load over HTTPS
- frontend requests reach the Render `/api/v1` origin without mixed content or
  CORS errors
- registration/login/logout, confirmation, password recovery, reset, and the
  callback route return to the canonical frontend origin
- an unauthenticated protected API request is denied safely
- ACTIVE TENANT, LANDLORD, and ADMIN accounts can reach their representative
  protected areas; cross-role access remains denied
- a tenant can open an ACTIVE public listing and create a draft application
- controlled conversation/message access works for its participants
- an invalid request returns a product error without a stack, SQL, filesystem,
  or Supabase detail
- normal requests are not rate limited; a small bounded check may confirm 429
  behavior only when it cannot affect beta users
- browser console contains no unexpected errors and critical requests contain
  no unexpected 4xx/5xx responses

Delete smoke records only through an approved, ownership-scoped cleanup. Do not
reset the database.

## ADMIN and beta-account bootstrap

Create the first controlled account through the normal Auth flow. Promote it to
ADMIN only through the established trusted operator procedure, then confirm its
profile is ACTIVE. ADMIN self-registration is not enabled. Create controlled
LANDLORD and TENANT users through normal registration, label their records in
the private operations log, and store passwords only in the approved password
manager.

Invite initial beta participants individually through the existing registration
and account controls. This prototype does not add an invitation product. Keep
the participant list and account owner outside the repository.

## Rollback

- Frontend: use Vercel's deployment history to promote the last known-good
  frontend built from an identified commit. Recheck its API URL and Auth routes.
- Backend: use Render's deploy history to redeploy the last known-good commit
  with the same server-side variables. Confirm health before restoring traffic.
- Application source: revert the faulty code in a new Git commit and pass all
  gates; do not rewrite shared release history.
- Database: never reset, delete production data, or reverse-edit migration
  history. Repair a faulty schema change with a reviewed forward corrective
  migration and verify the catalog again.
- Secret exposure: revoke/rotate the affected provider credential immediately,
  update only server-side secret stores, redeploy, inspect access logs, and
  document the incident without recording the secret.

Record the deployed Git commit, release tag, Vercel deployment identifier,
Render deployment identifier, Supabase project classification, operator, and
UTC time in the private release record. Do not put credentials in that record.

## Release gates

From the repository root, run:

```bash
npm run lint
npm run test
npm run test:e2e
npm run build
npm run format:check
npm run security:check
npm run deployment:check
git diff --check
```

Full Playwright and hosted mutation-heavy verification run only against the
development/QA Supabase project. Production receives the bounded smoke above.
Tag (for example `private-beta-v0.1.0`) only after every gate and production
smoke passes.
