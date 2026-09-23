# TASK-030 — Asserta Brand System & Product Rebrand

Completed 22 September 2026. The task is complete in the local workspace; no deployment was performed.

## Brand Strategy

Asserta is the master brand. Property management describes a software category, not the company name. The initial audience is property owners managing their own rentals in Mauritius. Tenants remain the secondary public audience, with search, saves, applications, viewings and communication supported.

## Brand Identity

Created an open A mark, Asserta wordmark exports, light variants and an SVG favicon. Assets are centralized in `frontend/public/brand/`; the shared `Brand` component supplies an accessible home link. Full branding appears in public/auth headers and workspace sidebars; a compact A appears on narrow workspace topbars. The public footer and all role workspace footers use Asserta.

Blue `#0A66C2` remains primary, with `#004182` for hover/deep surfaces, warm neutral backgrounds and the existing semantic colors. No secondary accent was added. The typography remains system sans-serif, with a restrained tightly spaced wordmark and a responsive public heading. Brand rules, identity sizing, correct/incorrect usage and terminology are documented in [BRAND.md](BRAND.md).

## Messaging

Internal positioning: “Asserta helps property owners manage the journey from listing a property to finding and managing the right tenant.” Public owner copy describes the implemented tools and keeps the owner responsible for decisions.

The homepage leads with “Your rental process. From available to rented.” It presents the owner action, a clearly labelled workflow illustration, property/listing/application/viewing/message benefits, a four-listing public inventory preview, tenant search and account entry, then the owner action and footer. No fabricated activity, metrics or endorsements were added. Marketplace filtering remains available through the existing search page.

Authentication and onboarding copy names Asserta and explains owner/tenant usage. Generic motivational copy was removed. Authenticated overviews retain real activity and existing navigation; branding did not introduce promotional dashboard cards.

## Product Rebrand

Updated public homepage, shared public navigation, public footer, authentication layout, login, registration, onboarding, all three role workspace shells, mobile workspace header, error recovery, not-found link, browser title, description, social metadata and favicon. Shared branding also covers password recovery/reset and auth status screens. Existing notification and empty-state content was audited; it contained no old brand requiring business-data changes.

## Mauritius Connect Audit

Repeated a case-insensitive scan of tracked and nonignored untracked repository files for all four requested naming variants. No literal matches remain in frontend source, shipped assets or backend source. The browser suite also rejects the former brand in rendered pages, including whitespace-separated variants.

Every retained source occurrence is accounted for below (line numbers at completion):

| File                    | Lines / occurrences                                                                     | Reason                                                                                                                                                                                                  |
| ----------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `render.yaml`           | 3; one                                                                                  | Existing Render service identifier. Renaming could create or detach a deployment resource.                                                                                                              |
| `supabase/config.toml`  | 5; one                                                                                  | Existing local Supabase project identifier; preserve tooling compatibility.                                                                                                                             |
| `docs/DEPLOYMENT.md`    | 28; one                                                                                 | Operator instructions must match the retained Render identifier exactly.                                                                                                                                |
| `.idea/modules.xml`     | 5; two                                                                                  | Both the file URL and file path reference the existing local IDE module. Not product branding. The corresponding `.idea` module filename and local checkout directory are also intentionally unchanged. |
| `tasks/CURRENT_TASK.md` | 15, 554, 555, 556, 557, 595, 669, 957, 1038, 1039, 1040, 1041, 1079, 1130; one per line | Original rebrand brief, explicit search terms, acceptance requirement and required audit heading. Preserved as task history, not current product messaging.                                             |
| This report             | Audit heading; one                                                                      | Required historical audit label; does not name the current product.                                                                                                                                     |

Total: 20 literal occurrences across six files, of which two are local IDE references. No unexplained user-facing occurrence remains. Git internals/history, dependencies, local secrets and generated test/build output are excluded from the source audit. Generated production HTML/JS/CSS/SVG were separately checked for old branding.

Also replaced the older descriptive platform name in current README, product, architecture, database, API, security, testing, development and UI documentation. Completed task records retain historical language. Technical npm package names and repository/directory identifiers remain compatible.

## Domain

The intended domain is `https://asserta-mu.com`, documented in BRAND, README and deployment guidance. Domain registration, DNS, TLS and deployment were not verified. No authentication redirects, environment values, provider resources or support/contact details were invented or changed.

## Technical Changes

- Frontend: shared brand rendering, responsive mark placement, owner-first homepage, concise auth/onboarding and recovery copy, identity CSS.
- Metadata/assets: branded browser/social metadata and five centralized SVG assets.
- Documentation: brand source of truth, current product names and positioning, deployment domain guidance, browser verification instructions, this report and task completion status.
- Tests: updated homepage expectations and added browser checks for role branding, owner/tenant entry routes, asset loading and favicon/header sizes.

Existing unrelated workspace changes were retained. No commit, deployment or new task was initiated.

## Backend

No backend code or API contract changes were needed for TASK-030. Existing safe public listing APIs provide the homepage inventory; no aggregate endpoint was added.

## Database

No schema, RLS, migration, stored notification or hosted data changes. No destructive database work.

## Dependencies

No dependencies added or updated for this task. SVG artwork and existing React/CSS implement the identity. Only the root package's human-readable description changed for branding; its technical name remains intact.

## Verification

| Check                        | Result                                                                                   |
| ---------------------------- | ---------------------------------------------------------------------------------------- |
| `npm run lint`               | Passed                                                                                   |
| `npm run test`               | Passed: 188 frontend, 593 backend tests; 19 migrations and 26 embedded PostgreSQL checks |
| `npm run build`              | Passed: Vite production output and backend syntax checks                                 |
| `npm run format:check`       | Passed                                                                                   |
| `npm run security:check`     | Passed: static scan and npm audit, zero known vulnerabilities                            |
| `git diff --check`           | Passed                                                                                   |
| `npm run test:e2e:workspace` | Passed: 33 Chromium browser tests                                                        |

Browser coverage includes public homepage/authentication at 320/768/1440 px; tenant new/returning at 390/1024/1440 px; landlord new/active and ADMIN empty/pending at 390/768/1440 px. Additional role smoke checks cover profiles, properties, listings, applications, messages, notifications, moderation and verification surfaces. Tests check overflow, navigation, logout, focus, semantic colors, protected content boundaries, brand accessibility, asset loading and favicon sizes of 16/24/32/48 px. Representative homepage, authentication, tenant, landlord, ADMIN and identity screenshots were visually reviewed.

The suite uses isolated Auth/API fixtures. It does not certify live email, DNS, hosted provider configuration or cross-browser behavior beyond Chromium. No hosted mutation suite was run for this presentation-only change. Screenshots are in ignored `test-results/`, including `asserta-home-*.png`, `asserta-identity.png`, `workspace-login.png` and role screenshots.

The first dependency-audit attempt could not reach the registry from the sandbox; its authorized rerun passed. An initial browser launch was not executed because automatic approval review hit a usage limit; the resumed authorized run passed. A CSS cleanup error was caught by formatting, recovered from the preceding successful build's equivalent rules, and validated by the production build and full browser suite.

## Scope Confirmation

No rental workflow, role, ownership rule, permission, API contract or RLS policy changed. Tenant draft applications remain private; public inventory still uses public-safe fields; ADMIN overviews receive no additional private message or verification evidence access. No rental functionality was added. TASK-030 only; stopped after completion.
