# Mauritius Rental Platform

A mobile-first private-beta prototype for landlords and tenants in Mauritius to manage the rental application process directly. The feature set is frozen while deployment and operational readiness are completed.

## Stack

- Frontend: React, Vite, JavaScript, HTML, and CSS
- Backend: Node.js and Express
- Platform: PostgreSQL, Supabase Auth, and Supabase Storage
- Package manager: npm workspaces
- Testing: Vitest, Testing Library, Supertest, Playwright, and hosted Supabase verification
- Private-beta hosting: Vercel frontend, one Render Node instance, and an isolated Supabase project

## Prerequisites

- Node.js 24 LTS (the repository includes an `.nvmrc`)
- npm 11 or a compatible npm release bundled with Node.js 24

## Installation

From the repository root:

```bash
npm install
```

## Environment setup

Copy the example files before supplying local values:

```bash
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env
```

On PowerShell:

```powershell
Copy-Item frontend/.env.example frontend/.env
Copy-Item backend/.env.example backend/.env
```

Local development and the health endpoint can run without Supabase credentials. Production backend startup fails closed unless the exact HTTPS frontend origin and required Supabase configuration are present. Vercel builds also fail closed when their three browser-safe production values are missing.

Authentication routes require a configured Supabase project. See
[`docs/AUTH_SETUP.md`](docs/AUTH_SETUP.md) for provider, callback, password
recovery, and test-user setup.

Never put `SUPABASE_SECRET_KEY` or `DATABASE_URL` in frontend environment files. Vite exposes `VITE_*` variables to the browser.

For the production variable matrix, forward-only Supabase workflow, Vercel and Render configuration, smoke test, and rollback procedure, see [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md). Operators should use [`docs/PRIVATE_BETA_CHECKLIST.md`](docs/PRIVATE_BETA_CHECKLIST.md) for each release and daily beta operations.

## Development commands

Run these commands from the repository root:

```bash
npm run dev          # start the Vite frontend and Express backend
npm run lint         # lint both workspaces
npm run test         # run frontend and backend tests
npm run build        # build the frontend and validate backend entry points
npm run db:verify    # inspect and execute database migrations and invariants
npm run deployment:check # validate private-beta manifests and environment boundaries
npm run format       # format project files
npm run format:check # check formatting without changing files
```

Development defaults:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`
- Health endpoint: `http://localhost:3000/api/v1/health`

## Directory overview

```text
frontend/        React/Vite browser application
backend/         Express REST API
database/        Ordered migrations, development seed, and database verification
docs/            Product, architecture, security, UI, and testing specifications
tasks/           Current task and roadmap task history
python-services/ Reserved future specialist services
```

See [`database/README.md`](database/README.md) for migration and seed workflows,
[`docs/`](docs/) for detailed requirements, and
[`tasks/CURRENT_TASK.md`](tasks/CURRENT_TASK.md) for the active work package.
