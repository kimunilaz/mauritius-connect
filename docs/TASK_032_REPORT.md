# TASK-032 — Agent Workspace & Managed Property Owners

## Status

Local implementation and checks passed. Hosted rollout is pending explicit shared-environment authorization. Read-only hosted preflight found 19 applied migrations, four pending TASK-031 migrations, three pending TASK-032 migrations and no private property-operations Storage bucket. No hosted schema/data changes were made.

## Architecture and roles

TENANT uses marketplace, application and tenancy-derived operational access. LANDLORD manages properties they own. AGENT manages properties for recorded client owners. ADMIN retains separate moderation access. LANDLORD and AGENT use the same property, leasing, application, viewing, tenancy, maintenance, inspection, finance, document, task, messaging, notification and report modules. The only agent-specific module is Owners CRUD and its presentation.

`property_manager_profiles` represents the authenticated user managing property. Existing `landlord_profiles` remain genuine self-owner identities; their IDs are backfilled unchanged into management profiles. `managed_property_owners` represents an agent's private client record and never creates an Auth account. Existing `properties.landlord_id` values are retained. Landlord properties derive their manager and have no managed owner selector. Agent properties require `managed_owner_id`, set `landlord_id` null, and reference the authenticated manager separately. A composite owner/manager FK, property guard and archive lock prevent cross-agent attachment, reassignment, and adding new properties to an archived owner. Archived owners retain all existing property history.

The agent sidebar adds Owners. Owner directory/detail contains contact details, search, occupancy, outstanding rent records, portfolio and activity. Shared overview identifies client portfolio context; Property 360 links its recorded owner. Property, finance and report screens accept owner filters. Agents select or create an owner during property creation. Landlords continue their original self-owned creation flow. Mobile owner actions stack below the owner identity.

## Authorization, privacy and compatibility

Server-side manager scoping applies to shared properties, listings, applications, viewings and operations. Shared SQL transactions resolve the actual manager role and property manager relationship. Owner directory endpoints are AGENT-only, versioned edits reject stale writes, and another agent's owner or property returns 404. Tenant access continues to derive from active/upcoming tenancies. ADMIN does not gain private client-owner access through these endpoints. The new owner and manager tables have deny-by-default RLS and service-only grants. Public listing and tenant serializers omit client records. LANDLORD_IDENTITY verification remains landlord-only; agents can request PROPERTY_AUTHORITY. Existing private Storage/signed access rules are reused.

No agency organization, team invites, shared portfolios, commissions, management fees, owner payouts, trust accounting or owner portal was introduced. Future property-to-unit support can add a building/unit grouping around existing property IDs; this task does not repurpose a property into a building or rewrite existing tenancy/listing foreign keys. Ownership transfer remains deferred.

## Database and verification

Forward migrations: `202609230001_property_managers.sql`, `202609230002_shared_management_transactions.sql`, `202609230003_managed_owner_directory.sql`. The first adds role, tables, backfill, constraints, guards, indexes and RLS. The second forward-replaces the existing management transaction bodies and extends summary/rent filters by client owner. The third adds a bounded private owner directory with property counts and outstanding rent records. No migration reset or prior migration rewrite.

Local PGlite checks cover legacy landlord backfill, two-agent/client isolation, wrong-role owner access, archived owner history, RLS denial, occupied properties without listings, and the same 22 operational scenarios for LANDLORD and AGENT. An additional real-database agent leasing test covers application review, viewing, conversation, acceptance and wrong-agent rejection. Backend API tests cover wrong/suspended roles, cross-agent access, mass assignment and stale edits. Isolated desktop/mobile browser scenarios cover owner edit, agent creation, property context, finance/report filters and archival; the shared operations browser journey runs for both manager roles. A real hosted agent scenario and cleanup are prepared in `e2e/prototype.spec.js` but have not run.

Full tests passed: 188 frontend, 643 backend, 26 local migrations, 22 landlord operations, 22 agent operations and 12 agent isolation/leasing checks. Lint, build, format, security scan (zero high vulnerabilities) and git diff check passed. Isolated Playwright passed 40 existing/new workspace scenarios, followed by six shared operational journeys including agent/landlord desktop and mobile. Exact logs are recorded in `test-results/task032-*.log` (ignored). Hosted DB, security and real E2E checks must run after the documented environment authorization and ordered forward migration/private-bucket setup. The current task stays in progress until then.
