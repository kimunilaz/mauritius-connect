# TASK-031 implementation plan and architecture decision

## Approved direction
TASK-031 supersedes the leasing-only exclusions in PRODUCT_SPEC, DEVELOPMENT_RULES,
DATABASE, ROADMAP and BRAND. Asserta provides property operations software, never
managed services. Existing LANDLORD identity, REST, React/Express and Supabase stay.

## Schema inspection and domain map (before migrations)
The 19 existing migrations define 21 tables. properties belongs to
landlord_profiles, linked to profiles/auth.users. Each property is currently one
rentable asset (including ROOM), with one live listing and one accepted applicant
per listing. Applications reference tenant_profiles; conversations require listings.
No tenancy, ledger or operational tables currently exist. Public serializers are
explicit allowlists. Keep all existing rows, keys, routes and workflow functions.

Add property_operational_details (private reference, floor area and notes),
tenancies (manual tenant name/contact, optional verified tenant relationship and
accepted application, dates, rent, deposit, move records), rent_ledger_entries
(expected charges) and rent_receipts (immutable offline receipt records),
property_financial_records (income/expense, no double entry), maintenance_requests,
maintenance_updates, property_inspections (bounded structured checklist),
property_documents (private object metadata and explicit tenancy sharing),
property_tasks. Every record is property-scoped; compound foreign keys protect
cross-property links. Current occupancy is derived from tenancy dates/status;
marketing derives independently from listings. Past tenancies remain.

## Privacy and integrity
Owner API checks ACTIVE LANDLORD plus property ownership on every request.
Tenant API requires ACTIVE/UPCOMING/ENDING tenancy linked to authenticated profile;
requests require current active occupancy. Manual records grant no account access.
A one-use, owner-issued invitation code can link an existing tenant account without
an applicant workflow. Accepted applications derive tenant identity server-side.
Never guess lease dates or amounts. Serialize tenant operational fields explicitly.
Documents default private; sharing targets one tenancy, never a property-wide flag.
Inspection/owner notes and costs never enter tenant/public DTOs. Storage stays
private, file content validated, paths generated, signed URLs short-lived.
RLS enabled with no browser policies; backend-only transactional functions have
empty search_path and revoked PUBLIC/anon/authenticated execution. State changes
use locks or optimistic versions. Receipts and maintenance expenses are idempotent.

## Delivery and compatibility
Implement migrations, strict schemas, scoped repository/service/controller/routes,
then operational overview, portfolio, Property 360 and tenant My Home. Reuse existing
leasing, property forms, message engine and private image processing. Add context
links rather than a second message engine. Reports use bounded SQL aggregates and
paginated details, date/property filters and CSV. Notifications use source keys.
Future buildings can group current rentable property rows under a parent building;
new records continue pointing at the rentable property key. A later dedicated unit
migration can map those keys without rewriting leasing history.

## Verification and hosting
Test schema and races in isolated PostgreSQL/PGlite, API ownership and tenant
privacy, frontend behaviors, and desktop/mobile E2E. Run all required project checks.
Do not reset or migrate hosted Supabase without the established explicit environment
authorization. Prepare migration SQL and passing local evidence first.

## Research principles
Use connected property records, separate leasing/operations and narrowly scoped
resident access, not another product's UI or wording. References reviewed:
- https://www.appfolio.com/help/online-portal
- https://www.buildium.com/
- https://www.doorloop.com/features
- https://www.yardibreeze.com/residential-features/
- https://www.tenantcloud.com/maintenance
Payment processing, screening, signatures, bank sync, tax, accounting and enterprise
permission features on those products remain excluded from Asserta TASK-031.
