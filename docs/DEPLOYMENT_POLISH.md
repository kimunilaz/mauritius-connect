# Deployment polish — 19 September 2026

This pass builds on the existing marketplace and workspace changes without
replacing them. No deployment or hosted data changes were performed.

## Changes

- Standardized navigation and supporting text sizes using shared typography
  tokens; enlarged navigation touch targets and improved search input borders.
- Kept the established blue palette and replaced the marketplace's separate
  hard-coded shadow color with the shared palette.
- Kept the mobile workspace menu's close button visible; Escape dismisses the
  menu and restores focus to its button.
- Split account, tenant, landlord, and admin pages into on-demand bundles.
  Initial JavaScript decreased from about 630 KB to 500 KB (about 21%);
  compressed size decreased from about 166 KB to 142 KB (about 14%).
- Added a shared account/page loading state, inventory placeholders, broken-photo
  fallback, and recovery screen for rendering or route-loading failures.
- Added request deadlines: 30 seconds normally and 120 seconds for multipart
  uploads. Existing navigation cancellation remains supported; timers/listeners
  are cleaned up. Requests are not automatically retried. Mutation timeouts ask
  users to check whether their changes were saved before retrying.
- Deduplicated overlapping homepage listing results and corrected the trust
  indicator separator.
- Updated multer to 2.4.0, sharp to 0.35.4, and transitive qs to 6.16.0;
  updated the lockfile and removed obsolete transitive dependencies.

## Validation

- Frontend suite: 178 tests passed; after the upload-deadline refinement,
  the focused API suite passed all 4 tests (including the additional upload test).
- Backend suite after dependency updates: 578 tests passed, including image and
  upload coverage.
- Browser suite: 13 checks passed, covering tenant, landlord, admin, public
  browsing, authentication, notification/message actions, mobile menus, and
  overflow. Role screens were checked at 390 and 1440 px, with additional public
  layout checks at 320 and 768 px. Representative screenshots were inspected.
- Database verification: 19 migrations and 26 embedded PostgreSQL runtime checks
  passed.
- Lint, production build, deployment configuration verification, static security
  scan, formatting of edited files, and whitespace checks passed.
- Dependency audit after fixes: zero known vulnerabilities.

## Release scope

Browser checks use isolated API/auth fixtures; these results do not certify the
live provider configuration, real email delivery, hosted storage, or production
latency. Run the hosted integration checks against the intended release
environment before launch. The local Windows browser runner needed its own Vite
process stopped after all checks finished to complete teardown successfully.
