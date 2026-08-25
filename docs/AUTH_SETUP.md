# Supabase Auth development setup

TASK-002 uses Supabase Auth for browser-managed email/password identity and the
Node API for application authorization. Do not create custom password records or
tokens.

## Required environment variables

Frontend (`frontend/.env`):

```text
VITE_API_BASE_URL
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

Backend (`backend/.env`):

```text
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
```

The publishable key is used by the browser and by backend token verification.
The secret key is used only by the backend for controlled profile persistence
while the public tables remain protected by RLS. Never place the secret key or
`DATABASE_URL` in a `VITE_*` variable.

## Supabase dashboard configuration

1. Enable the Email provider under Authentication providers.
2. Decide whether email confirmation is required for the development project.
   The registration UI supports both immediate sessions and confirmation-first
   behavior; an application profile is not created until onboarding completes.
3. Set the local Site URL to `http://localhost:5173`.
4. Add these development redirect URLs:

   ```text
   http://localhost:5173/auth/callback
   http://localhost:5173/auth/callback?next=%2Freset-password
   ```

   Add equivalent exact URLs for each controlled preview or production origin.
   Do not use an unrestricted production redirect wildcard.
5. Ensure the project password minimum is compatible with the application
   minimum of eight characters, or raise the frontend policy to match the
   project setting.

The frontend is a client-only SPA and uses Supabase's supported implicit browser
flow with automatic session detection. This allows confirmation and recovery
links to open in the user's normal browser without depending on a PKCE verifier
stored in the exact browser profile that initiated signup. `/auth/callback`
also retains authorization-code exchange support for compatible existing links,
then sends password-recovery users to `/reset-password`. Supabase consumes the
URL fragment into its managed session; the application never displays or logs
raw tokens.

## Creating a test user

Use the public `/register` flow or create a development-only identity through
the Supabase Auth dashboard. Confirm the email through the configured Auth flow,
then complete `/onboarding` as either Tenant or Landlord. The Node endpoint
creates `public.profiles.id` from the verified token subject.

Do not insert arbitrary rows directly into `auth.users`, reuse production users,
or put test passwords in source control. Public onboarding cannot create an
`ADMIN`; administrators require a future controlled operations process.

## Hosted integration verification

TASK-002A uses two developer-controlled, email-confirmed accounts. Store their
credentials only in ignored `backend/.env.integration` variables:

```text
SUPABASE_TEST_TENANT_EMAIL
SUPABASE_TEST_TENANT_PASSWORD
SUPABASE_TEST_LANDLORD_EMAIL
SUPABASE_TEST_LANDLORD_PASSWORD
```

After registering and confirming both accounts through the real frontend, run:

```bash
npm run auth:verify:hosted
```

The verifier uses normal Supabase sessions and the real Node middleware. It
temporarily exercises user metadata and account suspension, restores both test
accounts, verifies RLS denial, and never prints credential or token values.
Delete the integration env file when it is no longer needed.

## Verification without live credentials

Automated tests replace the Supabase network boundary with contract-compatible
test doubles. They verify bearer parsing, `getClaims` identity handling, profile
authorization, frontend session behavior, callback exchange, and recovery flows.
These tests do not claim that a specific remote Supabase project's email delivery
or dashboard configuration has been verified.

## Private-beta production URLs

Use the canonical Vercel HTTPS origin as the Supabase Auth Site URL and add exact
redirect entries for:

```text
https://<canonical-frontend-origin>/auth/callback
https://<canonical-frontend-origin>/auth/reset-password
```

Do not use a production wildcard. Localhost entries may remain only for the
separate development workflow. Re-test registration, confirmation, login,
logout, recovery, reset, and callback session handling after any domain change.
