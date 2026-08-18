# TASK-000 — Project Bootstrap

## Status

READY

## Priority

P0 — Foundation

## Objective

Initialize the technical foundation of the Mauritius Rental Platform.

This task establishes the React frontend, Node.js/Express backend, development tooling, testing infrastructure, Supabase configuration structure, and root development commands.

This task must **not implement rental product features**.

---

# 1. Required Reading

Before changing any code, read:

```text
docs/PRODUCT_SPEC.md
docs/ARCHITECTURE.md
docs/DATABASE.md
docs/API_SPEC.md
docs/SECURITY.md
docs/DEVELOPMENT_RULES.md
docs/TESTING.md
docs/ROADMAP.md
docs/UI_RULES.md
tasks/CURRENT_TASK.md
```

These documents define the approved project architecture.

Do not silently contradict them.

---

# 2. Approved Technology Stack

Use:

## Frontend

```text
React
Vite
JavaScript
HTML
CSS
```

## Backend

```text
Node.js
Express
```

## Database / Platform

```text
PostgreSQL
Supabase
```

## Package Manager

```text
npm
```

---

# 3. Recommended Foundation Dependencies

Use only where required.

## Frontend

```text
react
react-dom
react-router-dom
@supabase/supabase-js
```

Development:

```text
vite
eslint
prettier
vitest
@testing-library/react
@testing-library/jest-dom
```

## Backend

```text
express
cors
helmet
dotenv
zod
@supabase/supabase-js
```

Development/testing:

```text
nodemon
eslint
prettier
vitest
supertest
```

If current stable package compatibility requires a minor adjustment, make the smallest reasonable adjustment and document it.

Do not introduce additional libraries without a clear need.

---

# 4. Repository Structure

Preserve/create the following structure:

```text
mauritius-rental-platform/
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── context/
│   │   ├── utils/
│   │   ├── constants/
│   │   ├── App.jsx
│   │   └── main.jsx
│   │
│   ├── public/
│   ├── tests/
│   ├── .env.example
│   └── package.json
│
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── repositories/
│   │   ├── middleware/
│   │   ├── validators/
│   │   ├── constants/
│   │   ├── utils/
│   │   ├── app.js
│   │   └── server.js
│   │
│   ├── tests/
│   │   ├── unit/
│   │   ├── integration/
│   │   ├── security/
│   │   ├── fixtures/
│   │   └── helpers/
│   │
│   ├── .env.example
│   └── package.json
│
├── database/
│   ├── migrations/
│   ├── seeds/
│   └── schema/
│
├── docs/
│
├── tasks/
│   ├── CURRENT_TASK.md
│   ├── backlog/
│   └── completed/
│
├── python-services/
│   └── README.md
│
├── .gitignore
├── package.json
├── README.md
└── package-lock.json
```

Do not create Python application services yet.

---

# 5. Root Workspace

Configure the repository as an npm workspace containing:

```text
frontend
backend
```

The root `package.json` should allow common development commands.

Desired behavior:

```bash
npm install
npm run dev
npm run test
npm run lint
npm run build
```

The implementation may use a lightweight development dependency such as `concurrently` at the root if necessary to run frontend and backend together.

Do not introduce monorepo frameworks such as:

```text
Nx
Turborepo
Lerna
```

for V1.

They are unnecessary for the current architecture.

---

# 6. Frontend Bootstrap

Initialize the frontend using React with Vite.

Create the base application.

The initial interface should remain deliberately simple.

Required initial routes:

```text
/
```

and:

```text
/404 fallback
```

Do not create tenant, landlord, property, application, or admin pages yet.

---

# 7. Initial Homepage

The initial homepage is only a development bootstrap screen.

It should display:

```text
Mauritius Rental Platform
```

and a short development-status message.

Example:

```text
Platform foundation is running.
```

Do not attempt to create the final marketing homepage during this task.

---

# 8. React Router

Install and configure React Router.

The router should be structured so future route groups can later support:

```text
public
tenant
landlord
admin
```

Do not implement those protected route groups yet.

---

# 9. Frontend CSS Foundation

Create a minimal global CSS foundation.

Include:

```text
box-sizing reset
body margin reset
font-family
basic background
basic text styling
```

Create a small set of CSS variables for:

```text
spacing
border radius
text
background
surface
border
```

Do not build the complete design system yet.

Do not introduce Tailwind CSS, Bootstrap, Material UI, or another UI framework.

The approved frontend styling approach is:

```text
CSS
```

---

# 10. Backend Bootstrap

Create an Express backend.

Separate:

```text
app.js
```

from:

```text
server.js
```

`app.js` should configure and export the Express application.

`server.js` should start the HTTP server.

This makes integration testing easier.

---

# 11. API Base Path

Use:

```text
/api/v1
```

for application API routes.

Create the initial health route:

```http
GET /api/v1/health
```

Expected response:

```json
{
  "success": true,
  "data": {
    "status": "ok"
  }
}
```

Status:

```text
200
```

No authentication is required for this endpoint.

---

# 12. Health Endpoint Scope

The health endpoint should confirm the Node application is running.

Do not require Supabase or the database to be available for the basic:

```text
/api/v1/health
```

response.

A dependency-aware health check may be introduced later.

This prevents temporary external-service issues from making the backend impossible to inspect.

---

# 13. Backend Middleware Foundation

Configure:

```text
express.json()
helmet
cors
```

Add centralized:

```text
not-found handling
error handling
```

Create middleware folders/modules rather than placing everything directly inside `server.js`.

---

# 14. CORS

Use environment configuration.

Development should allow the frontend origin, for example:

```text
http://localhost:5173
```

Do not use unrestricted production CORS assumptions.

Use:

```text
FRONTEND_URL
```

from backend environment configuration.

---

# 15. Environment Configuration

Create:

```text
backend/.env.example
```

containing placeholders:

```text
NODE_ENV=development
PORT=3000

FRONTEND_URL=http://localhost:5173

SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
DATABASE_URL=
```

Do not place actual credentials in this file.

---

# 16. Frontend Environment Configuration

Create:

```text
frontend/.env.example
```

containing:

```text
VITE_API_BASE_URL=http://localhost:3000/api/v1

VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

Never include:

```text
SUPABASE_SECRET_KEY
DATABASE_URL
```

in frontend configuration.

---

# 17. Gitignore

Ensure `.gitignore` excludes at minimum:

```text
node_modules/
.env
.env.*
!.env.example

dist/
coverage/

*.log

.DS_Store
```

Do not ignore `.env.example`.

---

# 18. Supabase Frontend Configuration

Create a frontend Supabase client configuration module.

Example location:

```text
frontend/src/services/supabaseClient.js
```

It should use:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

Do not implement authentication functionality yet.

Do not attempt to access product database tables yet.

---

# 19. Supabase Backend Configuration

Create backend Supabase configuration modules with clear separation between public/user-context and privileged access concepts.

At minimum, establish configuration structure without implementing rental operations.

Privileged configuration may use:

```text
SUPABASE_SECRET_KEY
```

but must remain strictly backend-only.

Do not expose or print the secret.

If environment variables are missing during normal local startup, fail clearly only when a module actually requires those credentials unless the chosen configuration design intentionally validates them at startup.

The basic health endpoint should still be testable without real Supabase credentials.

---

# 20. Configuration Validation

Create centralized environment/configuration handling.

Do not access:

```javascript
process.env.SOMETHING
```

randomly throughout the backend.

Prefer:

```text
src/config/env.js
```

or equivalent.

Sensitive values must never be logged.

---

# 21. Backend Error Architecture

Create centralized error handling.

Establish a reusable application error representation.

Example concept:

```text
AppError
```

with:

```text
statusCode
code
message
```

Expected production API error structure:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Readable message"
  }
}
```

Do not expose stack traces to production clients.

---

# 22. Not-Found API Behavior

Unknown API routes should return:

```text
404
```

using the standard API error format.

Example:

```json
{
  "success": false,
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Route not found."
  }
}
```

---

# 23. Request Logging

Add minimal development-safe request logging.

At minimum it may include:

```text
method
route/path
status
duration
```

Do not log:

```text
Authorization headers
tokens
secrets
request passwords
```

Do not introduce a large observability platform during bootstrap.

---

# 24. Validation Foundation

Install and configure:

```text
Zod
```

for future API request validation.

Create the appropriate validator folder/foundation.

Do not invent product schemas during this task.

A small example/test validator may be created if needed to prove the setup works.

---

# 25. Frontend Testing Foundation

Configure:

```text
Vitest
Testing Library
jest-dom
```

Add at least one meaningful bootstrap test.

Example:

```text
renders the platform bootstrap page
```

The test should actually run successfully.

---

# 26. Backend Testing Foundation

Configure:

```text
Vitest
Supertest
```

Add integration tests for:

```http
GET /api/v1/health
```

Test:

```text
returns HTTP 200
returns success=true
returns status=ok
```

Also test an unknown API route returns the expected `404` response format.

---

# 27. ESLint

Configure ESLint for both:

```text
frontend
backend
```

Use a consistent, uncomplicated configuration.

Avoid overly strict rules that obstruct normal development without providing value.

---

# 28. Prettier

Configure Prettier consistently across the JavaScript project.

Avoid competing formatter rules.

Add appropriate ignore configuration where required.

---

# 29. Root Scripts

Root scripts should provide a simple developer experience.

Expected commands:

```bash
npm run dev
```

Runs frontend and backend.

```bash
npm run test
```

Runs frontend and backend tests.

```bash
npm run lint
```

Runs frontend and backend linting.

```bash
npm run build
```

Builds the production frontend and performs whatever backend production validation is appropriate.

Additional scripts may exist where useful.

---

# 30. Frontend Development Port

Use Vite's normal development port unless there is a conflict.

Expected:

```text
5173
```

---

# 31. Backend Development Port

Default:

```text
3000
```

with environment override through:

```text
PORT
```

---

# 32. Frontend-to-Backend Verification

During bootstrap, verify the frontend can reach:

```http
GET /api/v1/health
```

A simple development status component may call the endpoint and display:

```text
API connected
```

or:

```text
API unavailable
```

This is acceptable for bootstrap.

Keep the implementation simple.

---

# 33. Database Folder

Create:

```text
database/migrations/
database/seeds/
database/schema/
```

Do not implement the full schema in TASK-000.

That belongs to the next database task.

Placeholder `.gitkeep` files may be used if necessary to preserve empty directories.

---

# 34. Python Services

Create:

```text
python-services/README.md
```

with a short statement:

```text
Python/FastAPI services are reserved for future specialist functionality.
No Python service is required for V1 bootstrap.
```

Do not install Python dependencies.

---

# 35. README

Update the root:

```text
README.md
```

Include:

* project name
* short product description
* approved stack
* prerequisites
* installation instructions
* environment setup
* development commands
* testing commands
* directory overview

Do not duplicate the entire product specification.

Link developers to:

```text
docs/
```

for detailed requirements.

---

# 36. Node Version

Specify a supported modern Node.js version.

Prefer a currently supported Node LTS release compatible with the chosen dependencies.

Document it in:

```text
README.md
```

and optionally:

```text
.nvmrc
```

if useful.

Do not silently depend on an obsolete Node version.

---

# 37. No Product Features

TASK-000 must not implement:

```text
authentication flows
tenant profiles
landlord profiles
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
admin
verification
payments
AI
```

Those belong to later tasks.

---

# 38. No Database Schema Yet

Do not create the complete V1 database schema during this task.

Database schema implementation is:

```text
TASK-001
```

TASK-000 only prepares:

```text
configuration
folders
tooling
Supabase client foundations
```

---

# 39. No Deployment Yet

Do not configure production Vercel, Railway, Render, Fly.io, or production Supabase deployment during TASK-000.

Local development foundation comes first.

Deployment belongs to a later roadmap phase.

---

# 40. No CI/CD Yet Unless Trivial

Do not spend TASK-000 implementing extensive CI/CD.

If a very small GitHub Actions workflow naturally fits without expanding scope, document it as a recommendation rather than implementing it unless explicitly requested.

Formal CI/CD belongs to a later task.

---

# 41. Security Requirements

TASK-000 must already follow these rules:

* no secrets committed
* no secret key in frontend
* Helmet enabled
* controlled CORS configuration
* standard error responses
* request bodies parsed safely
* dependency choices kept minimal
* `.env` ignored
* production stack traces not exposed

---

# 42. Code Quality Requirements

Do not:

* place all backend code in one file
* place all React code in one component
* use giant configuration files
* add unused dependencies
* leave unexplained generated code
* add product functionality outside this task

---

# 43. Required Tests

At minimum:

## Frontend

```text
bootstrap page renders
```

## Backend

```text
GET /api/v1/health → 200
GET unknown API route → 404 standard error
```

All tests must actually be executed.

---

# 44. Required Verification Commands

Before reporting completion, run from the repository root:

```bash
npm install
npm run lint
npm run test
npm run build
```

If any command fails:

* investigate
* fix if within task scope
* report unresolved failure honestly

Do not state that checks pass unless they were executed.

---

# 45. Manual Verification

Also verify:

```text
frontend starts
backend starts
health endpoint responds
frontend can reach backend health endpoint
```

Do not require real production Supabase credentials for this bootstrap verification.

---

# 46. Acceptance Criteria

TASK-000 is complete only when all of the following are true:

* [ ] Root npm workspace exists.
* [ ] React/Vite frontend starts.
* [ ] Express backend starts.
* [ ] `/api/v1/health` returns standard success response.
* [ ] Unknown API route returns standard 404 error response.
* [ ] Frontend can communicate with backend health endpoint.
* [ ] React Router is configured.
* [ ] Basic CSS foundation exists.
* [ ] Supabase frontend configuration structure exists.
* [ ] Supabase backend configuration structure exists.
* [ ] Secret key is backend-only.
* [ ] `.env.example` files exist.
* [ ] `.gitignore` protects secrets and build artifacts.
* [ ] Central backend error handling exists.
* [ ] CORS is environment-controlled.
* [ ] Helmet is enabled.
* [ ] Zod validation foundation exists.
* [ ] Frontend tests run.
* [ ] Backend tests run.
* [ ] ESLint passes.
* [ ] Production frontend build succeeds.
* [ ] README contains setup instructions.
* [ ] No rental product features were implemented.
* [ ] No real secrets were committed.

---

# 47. Definition of Done

Do not consider the task complete merely because the servers start.

Completion requires:

```text
implementation
+
tests
+
lint
+
build
+
documentation
+
security review
```

for the bootstrap scope.

---

# 48. Completion Report

When finished, report:

## Summary

What was implemented.

## Files Created

List important files/directories created.

## Files Modified

List important existing files changed.

## Dependencies Added

Separate frontend, backend, and root dependencies.

## Environment Variables

List variable names only.

Never reveal values.

## Tests Added

List tests.

## Verification Performed

Report results for:

```text
npm run lint
npm run test
npm run build
```

## Manual Verification

Report whether:

```text
frontend started
backend started
health endpoint worked
frontend/backend connection worked
```

## Database Changes

Expected for TASK-000:

```text
No product database migrations.
```

If this differs, explain why.

## Security Notes

Confirm:

```text
No secrets committed.
Supabase secret key is backend-only.
```

## Known Limitations

List genuine bootstrap limitations.

## Recommended Next Task

Expected:

```text
TASK-001 — Database Foundation
```

Then stop.

Do not implement TASK-001 automatically.
