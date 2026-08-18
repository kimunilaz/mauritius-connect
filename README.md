# Mauritius Rental Platform

A mobile-first web platform for landlords and tenants in Mauritius to manage the rental application process directly. This repository currently contains the TASK-000 development foundation only; rental product features and the database schema are intentionally not implemented yet.

## Stack

- Frontend: React, Vite, JavaScript, HTML, and CSS
- Backend: Node.js and Express
- Platform: PostgreSQL, Supabase Auth, and Supabase Storage
- Package manager: npm workspaces
- Testing: Vitest, Testing Library, and Supertest

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

The health endpoint and bootstrap page work without Supabase credentials. Supabase client creation fails clearly only when a client is requested without its required configuration.

Never put `SUPABASE_SECRET_KEY` or `DATABASE_URL` in frontend environment files. Vite exposes `VITE_*` variables to the browser.

## Development commands

Run these commands from the repository root:

```bash
npm run dev          # start the Vite frontend and Express backend
npm run lint         # lint both workspaces
npm run test         # run frontend and backend tests
npm run build        # build the frontend and validate backend entry points
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
database/        Migration, seed, and schema placeholders for TASK-001
docs/            Product, architecture, security, UI, and testing specifications
tasks/           Current task and roadmap task history
python-services/ Reserved future specialist services
```

See [`docs/`](docs/) for detailed requirements and [`tasks/CURRENT_TASK.md`](tasks/CURRENT_TASK.md) for the active work package.
