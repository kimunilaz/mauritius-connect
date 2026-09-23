# TASK-029 — Authenticated Workspace UX Refresh

## Summary

Completed the expanded TENANT, LANDLORD and ADMIN scope. Authenticated overviews
now present actual activity and attention queues. The shared sidebar owns primary
navigation. No new rental workflow or database migration was introduced.

## Shared Workspace Pattern

All roles reuse the same responsive workspace shell, blue active navigation,
compact account area, greeting and neutral summary cards. Landlord and admin
overviews share loading, recovery, metric and activity components; the tenant
overview keeps its public-listing-safe saved-home previews in the same visual
system. Contextual detail links and small “View all” links remain useful within
activity lists. There are no oversized destination buttons on returning-user
overviews. Role and account status appear in the compact account area, outside
the primary dashboard; tenant account details also remain in My profile.

## Tenant Workspace

Navigation: Overview, Browse rentals, Saved homes, Applications, Messages,
Notifications, My profile.

The overview shows saved-home and application totals, unread notifications,
viewing invitations ahead of recent applications, and up to three saved homes.
A confirmed empty account shows one concise Browse rentals action.

Unread message counts are explicitly labeled as covering the three most recent
conversations. The previous implementation paged through every conversation;
the overview now makes one bounded conversation request. This is not an
account-wide unread total. The full Messages page remains available in navigation.
Unavailable saved homes and applications do not render private listing details,
even when an unexpected fixture supplies them. Message bodies are not rendered.

## Landlord Workspace

Navigation: Overview, Properties, Listings & applicants, Messages, Notifications,
Verification, My profile. Applicants remain under the existing per-listing
workflow, so navigation does not invent an unsupported global applicant route.

Compact cards show property and active-listing totals, submitted application
totals and the number awaiting review, plus unread messages in the three most
recent conversations. Activity sections show:

- Pending-review, draft and paused listing counts with a bounded preview.
- Recent submitted applications and their existing detail links.
- Proposed or confirmed upcoming viewings and their application links.
- Recent conversation participants and unread counts, without message bodies.
- Pending and under-review verification requests.

A new landlord receives “No properties yet” and a compact Add your first property
link. Independent desktop columns avoid gaps between panels of different heights.
The Verification destination is a read-only paginated view of the existing
owner-scoped API. It adds no upload, approval or other rental workflow.

## ADMIN Workspace

Four compact metrics show pending listings, open/under-review reports,
pending/under-review verifications and suspended users. Bounded previews show
up to three records per queue with links to existing review/moderation pages.
An empty review workload says “Nothing currently needs review.”

The overview never requests conversations, message details or verification
evidence. It does not copy full moderation tables onto the dashboard.

## Copy Cleanup

Removed the authenticated “Your personal workspace” role/account card, landlord
promotional banner, “Make room for what’s next,” “From property to possibility,”
“A better rental journey,” “Your next chapter starts here,” three-step
promotional navigation panel and motivational workspace footer.

Messages and My profile replace inconsistent landlord sidebar terminology.
Unauthenticated public and login marketing is outside this task.

## Status Presentation

The shared status formatter renders sentence-case labels, including Active,
Pending review, Under review, Suspended and Viewing proposed. Applications,
listing labels, admin queues/details, landlord verification and account metadata
use human-readable values. Underlying enum values and semantic styling hooks
remain unchanged.

## Responsive QA

Playwright covers new/returning tenants at 390, 1024 and 1440 pixels, new/active
landlords and empty/pending admin queues at 390, 768 and 1440 pixels. Additional
smoke checks cover 320-pixel layouts, role-specific pages and existing forms.
Assertions cover no horizontal overflow, menu behavior, navigation, activity,
privacy traps, errors/retry and request bounds.

Screenshots are stored in ignored `test-results/`, including
`tenant-{new,returning}-{390,1024,1440}.png`,
`landlord-{empty,active}-{390,768,1440}.png`, and
`admin-{empty,active}-{390,768,1440}.png`.
Representative mobile, tablet and desktop screenshots were visually inspected.
The Browser plugin had no connected browser; local Playwright supplied browser QA.

## Accessibility

The shared shell retains its skip link, labeled navigation, current-page state,
visible focus styles and keyboard-operable menu. Escape closes the mobile menu
and restores button focus. Activity uses headings and semantic lists; all statuses
include text. Loading and error states remain announced, with retry controls.
No status relies on color alone.

## API / Backend Changes

Two read-only endpoints were added:

- `GET /api/v1/overview/landlord`: submitted application totals, waiting count,
  three recent application previews and three upcoming viewing previews.
- `GET /api/v1/overview/admin`: exact counts and three-item previews for the four
  operational queues.

The landlord endpoint avoids per-listing/per-application request fan-out.
The admin endpoint avoids fetching entire user lists to count suspended users and
returns only the operational fields needed by the overview. Other data reuses
existing APIs.

Both endpoints require a verified session, an ACTIVE application profile and the
matching application role. Landlord ownership is derived from the verified user,
enforced through inner joins on every query. Tenant DRAFT applications and
unsubmitted records are excluded from both counts and previews. Explicit database
projections omit answers, message bodies, evidence paths and moderation notes.
There are no mutations or role selections supplied by clients.

Backend tests cover authentication, role escalation attempts, inactive users,
read-only routes, ownership filters, draft exclusions, bounded projections and
failure handling. Read-only hosted verification compared admin totals and three
landlord scopes with SQL, checked preview ownership and unrelated-owner isolation.
No hosted fixtures or account changes were made.

Normal overview loads use five bounded requests for tenants, nine for landlords
and one for admins (excluding authentication). Cancelled development-mode effects
do not issue duplicate summary requests. Failed loads never become false zeros.

## Database

No migration, seed, RLS change or permission change. All existing database
invariants and role/ownership/privacy boundaries remain in place.

## Verification

- `npm run lint`: passed.
- `npm run test`: 188 frontend tests, 593 backend tests, static database checks
  and 26 embedded PostgreSQL runtime checks passed.
- `npm run build`: passed.
- `npm run format:check`: passed.
- `npm run security:check`: static scan passed; dependency audit reported zero
  vulnerabilities after the network-enabled retry.
- `git diff --check`: passed.
- `npm run test:e2e:workspace`: all 31 browser tests passed.
- `node backend/scripts/verify-overview-readonly.mjs`: passed against the
  configured hosted project without writes.

Final presentation adjustments were followed by focused frontend/browser checks
and refreshed lint, formatting and build verification.

## Feature Scope

No new rental workflow, admin action, role-allocation feature, message access or
verification-evidence access was added. This report replaces the earlier
tenant-only TASK-029 report. No subsequent task was started.
