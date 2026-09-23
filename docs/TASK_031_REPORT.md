# TASK-031 — Property Owner Operations Hub

## Status and release gate

Implemented locally; local verification passes. **TASK-031 is not marked complete until hosted migrations, private Storage setup and live verification pass.** No hosted database or Storage changes were applied. The read-only preflight found 19 installed migrations, four pending TASK-031 migrations, and no `property-operations` bucket.

The project requires environment authorization before shared-database migrations (`docs/TESTING.md`, “TASK-025 Playwright E2E and Hosted QA”; also CURRENT_TASK §71). The remaining authorization is for the four reviewed forward migrations and the private bucket in the configured Supabase environment. Never reset hosted Supabase.

## Research-informed product direction

The owner product now starts with portfolio health and individual property records. Listings, applications and viewings sit inside Leasing. The independent occupied-property path works without any listing/application: add property, record tenancy, track rent, maintenance, inspections, documents, tasks and finances.

The architecture draws on connected property operations and narrowly scoped resident access documented by [AppFolio](https://www.appfolio.com/help/online-portal), [Buildium](https://www.buildium.com/), [DoorLoop](https://www.doorloop.com/features), [Yardi Breeze](https://www.yardibreeze.com/residential-features/) and [TenantCloud](https://www.tenantcloud.com/maintenance). No competitor UI, wording, branding, proprietary flow or code was copied.

**Product test: YES locally.** An owner with occupied rentals can use Asserta even with Listings and Applications absent. This is covered by isolated database and desktop/mobile browser tests. Hosted certification remains pending.

## Owner navigation

- Overview: portfolio operations at `/account` and `/owner`.
- Portfolio: Properties, Tenancies.
- Leasing: Listings, Applications, Viewings.
- Operations: Maintenance, Inspections, Tasks.
- Finances: Rent ledger, Income & expenses.
- Records: Documents, Messages, Reports.
- Account: Notifications, Verification, My profile.

Existing LANDLORD identity, authentication and legacy routes remain. The grouped sidebar scrolls on desktop; the existing keyboard-dismissable drawer remains on mobile.

## Portfolio overview

The owner-scoped summary supplies property/occupied/vacant/advertised counts, applications awaiting review, unread messages, open maintenance and overdue rent. Needs attention and Upcoming use real records: rent charges, maintenance, tasks, inspections, tenancy endings, applications and viewings. Financial amounts describe entered records, never guaranteed financial results.

Portfolio rows show property reference/address, locality/type, signed cover image where present, occupancy, current tenant/rent, listing state, maintenance count and a contextual action. Occupancy/location filters run before pagination. Advertising and maintenance remain independent of tenancy-derived occupancy. Archived properties are inactive and reject operational writes.

## Property 360

`/owner/properties/:propertyId` contains:

- Overview: occupancy, tenant, dates, rent receipts/outstanding, expenses, deposit when recorded, advertising, maintenance and recorded net.
- Tenancy: current, upcoming and historical rental relationships.
- Leasing: existing listings, applicant decisions and viewings.
- Maintenance: owner and tenant requests, updates, private costs/vendor references and history.
- Rent ledger and Income & expenses: property-scoped records.
- Inspections: scheduled/completed inspections and checklists.
- Documents: private files, relationships, explicit sharing and archival.
- Tasks: due dates, statuses and notes.
- Private notes: owner reference name, floor area, acquisition/utilities/access/owner notes.
- Property details: existing physical property editor and photos.
- Activity: latest recorded property, tenancy, leasing, rent, maintenance, inspection, document and financial events for the reporting period.

Property tabs scroll horizontally rather than consuming several mobile rows. Lists/cards wrap for small screens. There is no marketing banner or navigation-card dashboard.

## Tenancy management

Tenancies have owner-confirmed tenant name/contact, dates, rent, optional deposit, move-in/out dates and notes, optional accepted application and optional account linkage. States are UPCOMING, ACTIVE, ENDING, ENDED and CANCELLED. Transitions are explicit owner actions. Date checks also revoke expired tenant access before status cleanup.

Existing occupied properties do not require leasing. Owners can issue a one-use private code to link an existing TENANT account; only its hash is stored. Manual contact details alone confer no account access. Accepted applications can create tenancies after the existing acceptance transaction makes the listing RENTED. Identity is derived in the database and the known name can prefill; missing dates/rent/deposit are not invented.

Property locks, overlap checks, one-current-tenancy uniqueness and version checks prevent conflicting current tenancies and stale overwrites. Ended/cancelled relationships cannot reopen. Past tenancies and related operational history remain.

## Rent ledger

Expected charges are entered explicitly per tenancy/month with due date and amount. Offline receipts are immutable, use a request UUID for retries, and lock the charge to reject over-recording. Paid charges cannot be rewritten or waived. Derived states: UPCOMING, DUE, PAID, PARTIALLY_PAID, OVERDUE, WAIVED. An overdue partially paid charge remains OVERDUE and shows its remaining balance.

Rent filters by property, status and due-date period before pagination. Monetary totals aggregate all receipts; the visible receipt history is bounded to the latest 100 receipts per charge. No payment processor, bank connection, custody, escrow or automated collection exists.

## Income & expenses

Owner records support property, optional tenancy, category, amount, date, description, vendor/payee text and optional document/maintenance relationships. Financial amounts cannot be overwritten through PATCH; voiding preserves history. A completed maintenance request can link to one expense, preventing duplicate maintenance expense links. Entered rent income is separate from ledger receipts; the UI warns against entering the same receipt twice.

This is simple record keeping, not accounting. Recorded net means entered income plus offline rent receipts minus recorded expenses. Maintenance cost reporting uses recorded MAINTENANCE expenses, rather than adding estimates/actual costs again.

## Maintenance

Owners can create, filter and manage requests across the portfolio or within Property 360. Statuses: NEW, ACKNOWLEDGED, SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED. Priorities: LOW, NORMAL, HIGH, URGENT. Scheduling requires a date; terminal states cannot reopen.

Current active/ending tenants can submit title, category, description and private maintenance photos. Upcoming tenants can read relevant shared information but cannot submit requests/photos before occupancy. Server-derived actor/status/priority prevent mass assignment. Tenants see status, scheduled date and owner updates; costs, private notes and vendor details are excluded.

Maintenance status/update history and in-app notifications commit with the request change. Source-event keys prevent duplicate notifications. Due/expiry reminders otherwise appear in Needs attention/Upcoming; no background email/reminder scheduler was introduced.

## Inspections and move records

Inspections support MOVE_IN, MOVE_OUT, ROUTINE, OWNER and OTHER, dates, status, condition/meter/access/private notes and next inspection date. The checklist supports up to 30 structured items; the UI starts with nine common areas and Good/Needs attention/Not checked plus notes. Files/photos attach through private Documents, linked to inspection and/or tenancy. No legal deposit deduction or lease signing is calculated.

## Documents

The `property-operations` bucket is private with PDF/JPEG/PNG/WebP and 10 MiB limits. Generated paths never come from client input. Images are decoded/re-encoded; PDFs require signature and end marker. Files download as attachments using authorized 60-second signed URLs. Content checks are not malware scanning.

Owner metadata includes property/category/filename/uploaded-by/time/description and optional tenancy/maintenance/inspection relationships. Sharing names one same-property tenancy; default is private. Tenant uploads are restricted to current-tenancy maintenance images. Failed metadata inserts remove the newly uploaded object. Archival disables new downloads/sharing and retains metadata/history. Previously issued URLs expire within 60 seconds.

## Tasks and upcoming activity

Tasks contain property, optional tenancy, title, due date, OPEN/COMPLETED/CANCELLED and private notes. They join inspections, tenancy endings, maintenance schedules and existing viewing dates in the summary. No separate project-management or calendar engine is added.

## Leasing and messages

All existing listing/application/viewing transitions remain. Global Applications/Viewings and Property 360 use scoped, paginated leasing records; draft applications remain excluded. Accepted-applicant detail links open the tenancy workflow.

The existing conversation/message engine now accepts either a listing or tenancy context, with exactly one context per conversation. Tenancy participants derive from the record. Tenant access and new messages stop when eligibility ends; owners retain past message history. Commit-time message guards cover races with tenancy ending. Listing-based messaging retains its original behavior.

## Reports and calculations

Property/date-filtered reports provide current occupancy, rent summary, entered income/expenses, maintenance expenses, recorded net, recent activity and tenancy history. Financial summary CSV export is available.

- Expected: nonwaived charges whose due dates lie within the filter.
- Received: offline receipts whose received dates lie within the filter.
- Outstanding: unpaid balance of those nonwaived due-period charges using all recorded receipts.
- Overdue: outstanding due-period charges due before today.
- Income: received rent plus nonvoided manually entered income dated within the filter.
- Expenses: nonvoided expenses dated within the filter.
- Maintenance cost: the MAINTENANCE subset of those expenses.
- Occupancy: current eligible tenancy, independent of the financial date filter.

Portfolio and tenancy details are paginated; totals cover the complete scope. Activity is explicitly the latest 30 events in the date range. Forms/property selectors offer up to 100 related choices; larger portfolios remain accessible through the paginated property view and property-specific forms.

## Tenant changes

My home supports account-linked current/upcoming tenancies, terms, safe rent records, maintenance, explicitly shared documents and owner conversation. A connection-code form supports existing tenants. Browsing, saved homes, applications, messages and notifications remain. Owner financial, inspection, task and private-note APIs are inaccessible to tenants.

## Data model and migrations

The pre-migration review is in [TASK_031_PLAN.md](TASK_031_PLAN.md). Existing Property represents one rentable asset; keys and leasing history are preserved. Future buildings can group these assets, or map them to units in a dedicated migration, without rewriting operational references now.

| Migration | Scope |
| --- | --- |
| `202609220001_property_operations.sql` | Ten private operational tables, composite FKs, occupancy/version guards, offline receipt and claim functions, maintenance history/notifications and indexes |
| `202609220002_operations_summary.sql` | Owner-scoped bounded portfolio/report aggregation |
| `202609220003_tenancy_communications.sql` | Tenancy conversation context and commit-time tenant maintenance/document/message authorization |
| `202609220004_rent_records.sql` | Actor-scoped rent aggregation and status/date filtering before pagination |

Tables: property_operational_details, tenancies, rent_ledger_entries, rent_receipts, maintenance_requests, maintenance_updates, property_inspections, property_documents, property_financial_records, property_tasks. The full schema now contains 31 tables, 31 primary keys and 63 foreign keys.

Indexes cover property/version-date lists, tenancy status/account, one current tenancy, invitation hash, charge-month uniqueness, receipt ledger/property dates, maintenance history, shared documents and financial dates. Functions: guard_operational_record, guard_occupied_archive, record_rent_receipt, claim_tenancy, track_maintenance_update, owner_operations_summary, tenancy_conversation, guard_tenant_maintenance, guard_tenant_document, guard_tenancy_message, operations_rent_records.

## API and file changes

New owner/tenant operations routes, controller, validators, repository and service are under `backend/src/`. New owner pages/forms/panels/styles and tenant My home are under `frontend/src/pages/owner/`; the client wrapper is `frontend/src/services/operationService.js`. Existing App/account/navigation/property/application/conversation/notification integration points were updated.

Owner base: `/api/v1/landlord/operations`; tenant base: `/api/v1/tenant/operations`. Full endpoint, pagination and error contracts are in [API_SPEC.md](API_SPEC.md). Private bucket setup and read-only preflight are `backend/scripts/setup-operations-storage.mjs` and `backend/scripts/verify-operations-readonly.mjs`.

## Privacy and security

Owner access joins property -> landlord profile -> authenticated user. All routes require an ACTIVE profile and the correct role. Tenant access derives from an eligible account-linked tenancy; current occupancy is required for submission/uploads. Composite FKs prevent cross-property links. ADMIN receives no blanket owner-record access.

All new tables retain deny-by-default RLS and no browser policies/grants. Backend RPCs use an empty search_path and service-role-only execution. Strict DTOs exclude private operational data from tenant/public responses; existing public listing allowlists remain. Uploads/claims/invitations/receipts receive sensitive rate limiting. Version checks and transactional locks address concurrent changes. No secret material is added to frontend code or reports.

## Existing workflow regression and verification

| Check | Result |
| --- | --- |
| `npm run lint` | PASS, frontend and backend |
| `npm run test` | PASS: 188 frontend, 624 backend; database suite also passed |
| `npm run db:verify` after final SQL regression | PASS: 23 migrations/31 tables, 26 existing runtime checks, 22 operations checks |
| `npm run build` | PASS, frontend production bundle and backend syntax |
| `npm run format:check` | PASS |
| `npm run security:check` | PASS, static credential scan and 0 audit vulnerabilities |
| `git diff --check` | PASS; only existing Windows line-ending notices |
| `npm run test:e2e:workspace` | PASS: 37 isolated browser checks |
| Final affected operations browser rerun | 4 desktop/mobile journeys; see visual verification log |
| Desktop/mobile visual inspection | Property 360 and tenant My home reviewed; gutters/tabs and skip-link clipping corrected |
| `npm run supabase:migrations:sync` | PASS; regenerated only local CLI SQL copies, no hosted action |
| `npm run operations:verify:readonly` | 19 hosted migrations; four pending; private operations bucket absent; no changes made |
| `npx playwright test --list` | PASS: 14 real integration scenarios discovered, including new TASK-031 flow |
| Hosted migrations/bucket/live E2E | NOT RUN — environment authorization pending |

New API security tests cover roles/ownership, tenant scope/DTOs, strict input, missing terms, document access/validation/compensation and optimistic conflicts. Database tests include existing occupied onboarding without leasing, overlapping tenancies, receipts/retries/over-recording, cross-property links, expense deduplication, notifications, messages after tenancy ending, filters, accepted-application identity/missing terms and RLS. PGlite concurrency exercises serialized outcomes, not independent hosted connections.

The prepared real E2E extends the existing leasing lifecycle with occupied onboarding, tenant invitation, offline receipts and a concurrent over-recording attempt, tenant maintenance submission, private expense/inspection/document checks, signed file download, tenancy messaging, accepted-applicant conversion, tenancy ending and reports. Cleanup is restricted to the existing dedicated test identities/properties, including their private objects. It has not been executed against hosted infrastructure yet.

Existing property/listing/discovery/save/application/submission/viewing/message/notification/report/verification/admin/acceptance suites pass locally. This does not claim a fresh live hosted regression pass.

## Documentation updated

README, database README, PRODUCT_SPEC, ARCHITECTURE, DATABASE, API_SPEC, SECURITY, DEVELOPMENT_RULES, TESTING, ROADMAP, UI_RULES, BRAND and DEPLOYMENT now describe the property-operations scope and release gate. Current scope sections supersede historical leasing-only V1 exclusions. The current task remains awaiting hosted authorization, not complete.

## Deliberate boundaries

No payment processing, escrow, bank sync, accounting ledger, tax filing, automated screening, scoring, legal lease generation, e-signatures, vendor marketplace, utility payments, insurance sales, smart-home integrations, AI valuation/ranking, enterprise permissions or external listing syndication. Asserta remains software used by owners/agencies, not their legal intermediary or property manager.

No new task was started. The next action within TASK-031 is authorized forward deployment and hosted verification, followed by any fixes that verification reveals.
