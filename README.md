# Asserta: Property Management for Mauritius

A web application for landlords and property agents to manage properties, rental listings, tenant applications, and ongoing tenancies in Mauritius.

**JavaScript + SQL | React 19 | Express 5 | PostgreSQL/Supabase**

## Screenshots / demo

> Screenshot placeholder: property portfolio, property detail, and tenant application workflow.
> Demo placeholder: a short recording from property creation to listing and application review.

The hosted preview currently runs an older backend and database schema than this repository. Some newer portfolio and agent screens are not available there yet; the features below describe the source code.

## Key features

- **Properties independent of listings:** create, edit, photograph, and archive property records; create rental listings only when a property is available to advertise.
- **Rental discovery and applications:** filter public listings, save favourites, answer landlord-defined application questions, and submit applications with status history.
- **Leasing workflow:** review and shortlist applicants, arrange viewings, and accept an application through a transaction that also marks the listing rented and rejects competing active applications.
- **Property operations:** record tenancies, rent due and receipts, maintenance, inspections, documents, expenses, and tasks. Rent receipts record payments made elsewhere; the app does not process payments.
- **Agent portfolios:** maintain private owner/client records and manage their properties through the same operational workflows used by landlords.
- **Access and communication:** tenant, landlord, agent, and admin roles; property-scoped access, conversations, in-app notifications, listing moderation, and evidence-based verification workflows.

## Tech stack

| Area                  | Implementation                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------------ |
| Browser               | JavaScript, React 19, React Router 7, HTML/CSS, Vite 8                                           |
| API                   | Node.js 24, Express 5, Zod request validation, Helmet and CORS                                   |
| Persistence           | PostgreSQL migrations and PL/pgSQL functions; Supabase client queries, Auth, and private Storage |
| Uploads               | Multer for multipart requests; Sharp for image validation and re-encoding                        |
| Build / tooling       | npm workspaces, package lockfile, ESLint, Prettier                                               |
| Tests                 | Vitest, Testing Library, Supertest, PGlite, Playwright                                           |
| Hosting configuration | Vercel frontend and Render API; Supabase for hosted data and identity                            |

This repository contains no Java code. `python-services/` is a placeholder, not an implemented service.

## Architecture

```text
React pages -> API client -> Express routes and middleware
                                      |
                                 controllers
                                      |
                                   services
                                      |
                                 repositories
                                      |
                         Supabase / PostgreSQL / Storage
```

The browser also talks directly to Supabase Auth for sign-in and session management. Protected API requests carry a bearer token; the backend verifies identity and loads the application role before executing a route.

| Layer                    | Responsibility and starting points                                                                                                                                                                                                                                   |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend entry and state | [main.jsx](frontend/src/main.jsx) mounts React; [App.jsx](frontend/src/App.jsx) defines routes; [AuthContext.jsx](frontend/src/context/AuthContext.jsx) manages sessions, onboarding, and recovery state.                                                            |
| HTTP boundary            | [server.js](backend/src/server.js) starts the process; [app.js](backend/src/app.js) composes middleware and the API. [propertyRoutes.js](backend/src/routes/propertyRoutes.js) combines authentication, role checks, and request validation.                         |
| Controllers and services | [propertyController.js](backend/src/controllers/propertyController.js) handles HTTP responses; [propertyService.js](backend/src/services/propertyService.js) checks ownership, allowlists editable fields, and enforces archive rules.                               |
| Persistence              | [propertyRepository.js](backend/src/repositories/propertyRepository.js) scopes queries to the authenticated property manager. Repository modules keep database queries separate from HTTP handling.                                                                  |
| Schema and transactions  | [database/migrations/](database/migrations/) contains 26 ordered migrations. Foreign keys, constraints, partial unique indexes, and transactional functions enforce relationships and workflow invariants.                                                           |
| Response privacy         | [publicListingSerializer.js](backend/src/serializers/publicListingSerializer.js) explicitly selects public fields. Private image URLs are signed with a 15-minute lifetime by [propertyImageStorageService.js](backend/src/services/propertyImageStorageService.js). |

**Domain model:** a property is the underlying asset; a listing is an advertisement referencing that property. Applications belong to listings, while tenancies and operational records belong to properties. Agent-managed properties also reference a private owner record. This supports occupied or unadvertised properties without requiring a listing.

**Patterns used:** factory functions such as `createPropertyService({ properties, profiles, now })` inject repositories and clocks, making business rules testable with substitutes. Express middleware composes cross-cutting checks. [listingStateService.js](backend/src/services/listingStateService.js) uses an explicit transition table. Inheritance is limited to cases such as [AppError extending Error](backend/src/middleware/AppError.js) and the [React error boundary](frontend/src/components/common/AppErrorBoundary.jsx); most application logic uses functions and object composition.

The backend uses a privileged Supabase client, so ownership checks remain necessary even with row-level security enabled. Sensitive database functions also recheck actors and use locks. For example, `accept_application_transaction` in [the shared management migration](database/migrations/202609230002_shared_management_transactions.sql) locks the listing and applications before updating their states together.

## My contribution

Recent work on the property-management workflow included:

- Clarifying that properties must remain manageable without a published listing.
- Tracing a deployed "Route not found" error from the React portfolio page to its API request, and distinguishing a missing route from missing property data.
- Comparing the deployed API with local routes and the migration ledger to identify an incomplete backend/database rollout.
- Adding a narrowly scoped compatibility path to the existing landlord property list when the portfolio endpoint is missing, with regression tests that preserve authorization and server errors.

See [OwnerHub.jsx](frontend/src/pages/owner/OwnerHub.jsx) and [Properties.test.jsx](frontend/tests/pages/Properties.test.jsx) for that change.

## Getting started

### Prerequisites

- Node.js **24.x**, matching [.nvmrc](.nvmrc) and the package `engines` requirements.
- npm **11.x**, as bundled with Node.js 24.
- A Supabase project for login, persistent data, and uploads. The local automated test suite does not require one.
- Playwright Chromium only if running the browser tests below.

Run commands from the repository root:

```bash
npm ci
```

Copy `frontend/.env.example` to `frontend/.env` and `backend/.env.example` to `backend/.env`. Preserve existing configuration if these files already exist.

For a data-backed application, complete these steps before signing in:

1. Use a development Supabase project and apply **all** SQL files in `database/migrations/` in filename order. The schema expects Supabase's `auth.users` table. See [database setup](database/README.md); use the migration files as the authoritative list.
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the frontend environment. Keep `VITE_API_BASE_URL=http://localhost:3000/api/v1` for local development.
3. Set the matching `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and backend-only `SUPABASE_SECRET_KEY` in `backend/.env`. `DATABASE_URL` is used by hosted database verification tools, not required by the running API.
4. Configure email authentication and local callback URLs using [AUTH_SETUP.md](docs/AUTH_SETUP.md). Provision the private `property-images`, `verification-evidence`, and `property-operations` buckets using the setup scripts described in [DEPLOYMENT.md](docs/DEPLOYMENT.md).

Only browser-safe values belong in `VITE_*` variables. Environment files are ignored by Git.

```bash
npm run dev
```

- Frontend: `http://localhost:5173`
- API: `http://localhost:3000/api/v1`
- Health check: `http://localhost:3000/api/v1/health`

Without Supabase configuration, the dev servers and health check can start, but login and database-backed features cannot be used. There is no automatic sample-data or offline application mode.

### Verify and build

```bash
npm run lint
npm test
npm run build
```

`npm test` runs frontend and backend Vitest suites, then SQL verification in disposable PGlite databases. These tests cover ownership isolation, validation, state transitions, retries, migrations, and database constraints. They use test doubles or local databases rather than the hosted application.

`npm run build` writes the frontend to `frontend/dist/` and syntax-checks the backend entry points. The backend is JavaScript and runs directly; it has no compilation step.

For browser interaction tests with mocked Auth/API responses:

```bash
npx playwright install chromium
npm run test:e2e:workspace
```

This suite starts its own Vite server on port 5180. The separate `test:e2e` script uses real Supabase fixtures and requires a dedicated test project; it is not part of the offline review path. See [playwright.config.js](playwright.config.js) before running it.

## Project structure

```text
frontend/
  src/                 React pages, components, auth context, API clients
  tests/               Component, page, configuration, and client tests
backend/
  src/
    routes/            HTTP routes and middleware composition
    controllers/       Request/response handling
    services/          Business rules and workflow orchestration
    repositories/      Supabase queries and database RPC calls
    validators/        Zod input schemas
    serializers/       Explicit API response shapes
  tests/               Unit, API integration, and security tests
  scripts/             Hosted verification and private Storage setup
database/             SQL migrations, seeds, and PGlite tests
e2e/                  Playwright workflows and UI fixtures
scripts/              Development, security, and deployment checks
supabase/             Supabase CLI configuration
docs/                 API, authentication, schema, and deployment details
tasks/                Development task history
python-services/      Reserved directory; no runtime implementation
```

## What I learned / challenges solved

- **Model assets separately from advertisements.** Linking operations to properties allows tenancy and maintenance records to exist even when nothing is listed for rent.
- **Put multi-record transitions in a transaction.** Application acceptance changes application state, listing availability, competing applications, and history together; row locks and repeat-call handling protect the workflow from conflicting requests.
- **Treat authorization as a data-access concern.** Role checks alone cannot establish ownership. Manager-scoped repository queries, linked-record checks, and explicit serializers limit access across portfolios and tenant views.
- **Verify deployment compatibility as well as local correctness.** A passing local route test did not establish that the deployed API exposed that route. Comparing actual requests and the migration ledger explained the portfolio failure.

## Possible improvements

- Complete and verify the coordinated database, API, and frontend rollout before using the hosted preview as a recruiter demo.
- Add CI for lint, application tests, database checks, and a production build; include a deployment check that detects API/schema version mismatches.
- Make the hosted Playwright configuration portable beyond Windows and run its real integration workflow against a dedicated test project.
- Split the larger operations modules into smaller domain modules and replace abbreviated names where they obscure business rules.
- Move process-local rate limiting to a shared store before running multiple API instances.
