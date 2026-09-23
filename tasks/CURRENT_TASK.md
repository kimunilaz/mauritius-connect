# TASK-032 — Agent Workspace & Managed Property Owners

## Status

IN PROGRESS — local implementation and verification; hosted environment authorization pending.

## Priority

P0 — Core User Model

## Objective

Add first-class support for PROPERTY AGENTS using Asserta.

Agents should be able to use essentially the same property-management workspace as property owners, while gaining one additional capability:

AGENTS MANAGE PROPERTIES ON BEHALF OF PROPERTY OWNERS.

An agent therefore needs to:

- maintain records of the property owners they represent
- attach every managed property to the appropriate owner
- view properties grouped/filterable by owner
- operate the normal property-management, leasing and operational workflows for those properties

Do NOT build a completely separate duplicate product for agents.

The landlord/owner and agent experiences should share the same property-management architecture wherever possible.

---

# 1. Core Product Model

Use this principle:

PROPERTY OWNER:

User
→ Own properties
→ Manage those properties

AGENT:

User
→ Manage owner/client records
→ Owner/client records have properties
→ Agent manages those properties

The property-management experience after that should be largely shared.

---

# 2. Architecture Principle

DO NOT copy/paste the existing landlord workspace into a new agent workspace.

Instead:

- reuse shared layouts
- reuse shared property components
- reuse listing workflows
- reuse applications
- reuse viewings
- reuse maintenance
- reuse finances
- reuse documents
- reuse inspections
- reuse tasks
- reuse reports
- reuse messages

Introduce role-aware differences only where needed.

Preferred concept:

Shared Owner Operations UI
+
Role-specific permissions/navigation

LANDLORD:
manages own portfolio

AGENT:
manages portfolio on behalf of multiple owners

This should reduce implementation complexity and future maintenance.

---

# 3. New Role

Introduce:

AGENT

alongside the existing roles:

TENANT
LANDLORD
ADMIN

Do not rename existing LANDLORD backend role unless separately required.

AGENT must have its own authorization behavior.

---

# 4. Agency Boundary

TASK-032 supports an individual AGENT account.

Do NOT yet implement a full agency organization system such as:

- agency companies
- agency team members
- employee invitations
- branch offices
- shared agency accounts
- team roles
- manager/agent permissions
- commission splits
- agency billing
- owner portals

These can be introduced later.

For now:

one authenticated AGENT
→ manages their own portfolio of owner clients and properties.

This provides the foundation for future agency/team functionality.

---

# 5. Agent Workspace

The AGENT workspace should use the same general shell and information architecture as the property-owner workspace.

Recommended navigation:

Overview

PORTFOLIO
- Properties
- Owners
- Tenancies

LEASING
- Listings
- Applications
- Viewings

OPERATIONS
- Maintenance
- Inspections
- Tasks

FINANCES
- Rent ledger
- Income & expenses

RECORDS
- Documents
- Messages
- Reports

ACCOUNT
- Verification
- My profile

The primary addition compared with the property-owner workspace is:

Owners

---

# 6. Landlord / Owner Workspace

Existing LANDLORD users should continue using essentially the same property-management workspace.

They should NOT suddenly gain:

Owners

because they manage their own properties.

The shared workspace should adapt navigation based on authenticated role.

---

# 7. Owner Client Records

Agents must be able to create property-owner/client records.

Create a first-class managed owner record.

Suggested fields:

- id
- agent/user relationship
- first name
- last name
- optional company name
- phone
- email
- optional address
- optional notes
- created_at
- updated_at
- archived_at where appropriate

Use the clearest schema naming based on existing conventions.

Possible concepts:

managed_property_owners
agent_clients
property_owner_clients

Choose one clear name and document it.

Do NOT automatically create authentication accounts for these owners.

---

# 8. Authenticated LANDLORD vs Agent Client Owner

This distinction is critical.

An existing LANDLORD user:

is an authenticated Asserta account managing their own properties.

An agent-managed OWNER record:

is a client/property-owner record belonging to the agent's portfolio.

These are NOT automatically the same thing.

Do not silently create:

profiles
auth users
LANDLORD accounts

when an agent records a client.

Future invitation/linking can be a separate task.

---

# 9. Owners Page

Create an agent-only:

Owners

page.

The agent should be able to see:

- owner name
- company name where applicable
- number of properties
- occupied properties
- vacant properties
- relevant outstanding activity
- contact information where appropriate

Support:

- search
- create
- view
- edit
- archive

Do not permanently hard-delete owners with property history unless architecture safely allows it.

---

# 10. Add Owner

Provide a clean:

Add property owner

workflow.

Required minimum:

Name

Useful optional information:

Email
Phone
Company
Notes

Do not force unnecessary personal information.

---

# 11. Owner Detail Page

Each owner should have a page such as:

/agent/owners/:ownerId

Show:

Owner details

Portfolio summary

Properties

Tenancies

Outstanding issues

Relevant activity

Documents where owner-specific documents are later supported

The primary purpose is to answer:

"What am I currently managing for this owner?"

---

# 12. Property Creation — Agent

When AGENT creates a property, require:

Property owner

The agent must select an existing owner or create a new owner.

Example:

Property owner
[ Jean Dupont ▼ ]

+ Add new owner

A property managed by an agent must not exist without a clearly identified owner.

---

# 13. Property Creation — LANDLORD

When a LANDLORD creates a property:

do NOT ask them to select an owner.

The owner is themselves.

Keep the current flow simple.

The system should derive this from the authenticated role.

---

# 14. Ownership vs Management

The data model must clearly distinguish:

LEGAL / RECORDED PROPERTY OWNER

from:

PLATFORM USER MANAGING THE PROPERTY

For LANDLORD:

owner = authenticated landlord
manager = authenticated landlord

For AGENT:

owner = managed owner/client record
manager = authenticated agent

Do not overload one database column to mean both concepts if that would create ambiguity.

---

# 15. Schema Review First

Before database changes:

inspect the current properties table and existing ownership model.

Determine what the existing:

landlord_id
owner_id
user_id

or equivalent currently means.

Do NOT blindly rename or repurpose existing columns.

Produce a short implementation plan before migrations.

---

# 16. Preferred Compatibility Approach

Preserve existing LANDLORD property ownership behavior.

Introduce the minimum additional relationship needed for agent-managed properties.

Possible architecture:

property
→ managed_by_user_id
→ owner_client_id

or an equivalent normalized relation.

However:

do not implement this exact structure blindly.

Choose the safest design after inspecting the existing schema.

Existing landlord properties must remain valid without destructive migration.

---

# 17. Property 360 — Agent Context

The existing Property 360 experience should be reused.

For AGENT users, additionally show:

Property owner

Example:

Owner
Jean Dupont

Provide a link to the owner record.

Do NOT duplicate the entire property page for agents.

---

# 18. Property 360 — LANDLORD Context

LANDLORD users do not need a redundant:

Owner: Yourself

section unless useful.

Keep their experience clean.

---

# 19. Agent Properties Page

Reuse the existing portfolio/property view.

Add agent-specific filtering:

Owner

Example:

All owners
Jean Dupont
ABC Holdings
Marie Laurent

Allow properties to be grouped or filtered by owner.

Do not create a separate completely different property table.

---

# 20. Agent Overview

Reuse the property-owner portfolio dashboard.

Agent Overview should answer:

- How many owners do I manage?
- How many properties do I manage?
- How many are occupied?
- How many are vacant?
- Which applications need attention?
- Which maintenance issues are open?
- Is any rent overdue?
- Which owner/property needs attention next?

Add an agent-specific summary:

Owners
12

Do not redesign the dashboard from scratch.

---

# 21. Needs Attention

Use the same operational attention engine where possible.

Agent items should include owner context.

Example:

Maintenance request
Apartment 4 — Jean Dupont

Rent overdue
Rose Hill Flat — ABC Holdings

3 applications awaiting review
Moka Studio — Marie Laurent

The owner name provides useful context when managing multiple clients.

---

# 22. Listings

Agents should use the same listing workflow as property owners.

Listing creation must derive the property and therefore its recorded owner.

Do not require the agent to repeatedly choose the owner once the property has already been attached correctly.

---

# 23. Applications

Reuse the current application pipeline.

Agent sees applications only for properties they are authorized to manage.

Do not expose applications belonging to:

- another agent
- unrelated landlords
- unrelated properties

---

# 24. Viewings

Reuse the existing viewing system.

Agent acts as the property manager/operator for properties they manage.

No separate agent-specific viewing engine.

---

# 25. Tenancies

Reuse the tenancy system.

Tenancy remains linked to:

property
tenant

Agent authority comes from their management relationship to the property.

Do not duplicate tenancy tables for agent properties.

---

# 26. Maintenance

Reuse maintenance functionality.

An agent can manage maintenance for properties in their portfolio.

Maintenance views should show useful owner context.

Example:

Owner
Jean Dupont

Property
12 Example Street

Do not expose another agent's maintenance data.

---

# 27. Inspections

Reuse inspection functionality.

Agent authorization must derive from management of the property.

No duplicate inspection model.

---

# 28. Rent Ledger / Finances

Reuse the existing property financial record functionality.

Agent can record/manage financial records for properties they manage.

Financial views should support filtering by:

Owner
Property
Period

Example:

Owner:
ABC Holdings

Properties:
5

Recorded rent:
...

Do NOT introduce:

agency commissions
management fees
trust accounting
owner disbursements

in this task.

Those require separate financial design.

---

# 29. Reports

Reuse existing property/portfolio reports.

Add agent filters where useful:

Owner
Property
Date range

Potential owner-level view:

Jean Dupont

Properties: 3
Occupied: 2
Vacant: 1
Recorded rent: ...
Expenses: ...
Open maintenance: ...

Do not add accounting claims beyond the data recorded in Asserta.

---

# 30. Documents

Reuse private property-document infrastructure.

Agent access derives from property management authorization.

Owner/client records may have basic owner-specific documents only if there is a clear requirement and safe architecture.

Do not expand document scope unnecessarily.

---

# 31. Messages

Reuse existing messaging.

Where appropriate, show property and owner context to AGENT.

Do not automatically create conversations between agent and recorded owner clients in TASK-032.

Owner-client communication can be added separately if required.

---

# 32. Notifications

Reuse the existing notification system.

Agent receives the same relevant operational notifications for properties they manage.

Example:

New application
Maintenance request
Viewing response
Task due
Rent overdue

Include property context.

Do not create duplicate notification logic where shared event handling is possible.

---

# 33. Verification

Decide carefully how existing landlord/property verification interacts with AGENT.

Do NOT automatically mark an agent as verified property owner.

Where verification currently proves:

PROPERTY_AUTHORITY

it may be appropriate for an agent to demonstrate authority to manage/list the property.

Preserve existing security meaning.

Do not weaken verification rules merely to accommodate AGENT.

Document any changes.

---

# 34. Public Listings

Public users should NOT need to know whether a property is managed by:

owner
agent

unless Asserta deliberately exposes that information.

Do not expose private owner/client identity through public serializers.

Public listing privacy must remain intact.

---

# 35. Tenant Experience

TENANT functionality should remain essentially unchanged.

A tenant may interact with:

the property/listing

and the authorized property manager.

Do not expose the agent's owner-client records.

---

# 36. Agent Registration

Add AGENT as an available account type where appropriate.

Potential onboarding choice:

I am looking for a rental
→ TENANT

I manage my own properties
→ LANDLORD

I manage properties for owners
→ AGENT

Use natural wording.

Do not expose raw enum names as the primary UX.

---

# 37. Agent Onboarding

After AGENT registration:

guide them toward:

1. Add a property owner
2. Add a property
3. Attach the property to that owner
4. Record whether it is occupied or available
5. Continue normal property-management workflow

Do not require them to create a listing immediately.

---

# 38. LANDLORD Onboarding

LANDLORD onboarding remains:

1. Add your property
2. Set its operational state
3. Add existing tenancy or create listing where appropriate

Do not make landlords create themselves as owner records.

---

# 39. Shared Frontend Architecture

Refactor where necessary so role-specific workspaces reuse components.

Potential shared pieces:

OwnerWorkspaceLayout
PortfolioOverview
PropertyList
PropertyDetail
MaintenanceViews
FinancialViews
InspectionViews
TaskViews
Reports

Role-aware additions can be injected/configured.

Do not create:

AgentPropertyList
LandlordPropertyList

with mostly identical copied code if one reusable component can serve both.

---

# 40. Route Strategy

Use the safest existing routing architecture.

Do not duplicate dozens of identical pages under:

/landlord/...

and:

/agent/...

unless route compatibility requires it.

Consider shared internal components with role-aware route wrappers.

Preserve existing landlord URLs where necessary.

Document route choices.

---

# 41. Backend Authorization

Every AGENT-owned request must verify server-side that:

authenticated agent
→ manages the requested property

Do not trust property IDs from the browser.

Similarly:

authenticated agent
→ owns/manages the requested owner-client record.

An agent must never access another agent's clients.

---

# 42. Authorization Helper

Prefer one reusable authorization concept such as:

canManageProperty(user, property)

that safely supports:

LANDLORD
AGENT

rather than duplicating authorization checks across every service.

Exact implementation should follow existing repository architecture.

ADMIN behavior remains separately privileged.

---

# 43. RLS

Maintain deny-by-default RLS.

New agent/client relations must be protected.

AGENT may access:

- their own owner/client records
- properties they manage
- operational records linked to those properties

AGENT may NOT access:

- another agent's clients
- another agent's managed properties
- unrelated landlord properties

LANDLORD permissions must not broaden accidentally.

---

# 44. Existing Data

Existing LANDLORD properties must continue working.

Do not require migration of every landlord into owner-client records.

Do not reset Supabase.

Use forward-only migration.

Existing workflows must remain compatible.

---

# 45. ADMIN

ADMIN should be able to identify:

Account role: Agent

where user administration currently shows role.

Do not build a full agency-management ADMIN module in this task.

ADMIN's existing moderation/security powers remain.

---

# 46. Search / Filters

Agent-facing operational areas should support owner filtering where it meaningfully improves management.

At minimum:

Properties
Finances
Reports

Potentially:

Maintenance
Tenancies

Do not add owner filters everywhere mechanically.

---

# 47. Owner Archive Rules

Do not allow an owner/client to be removed in a way that destroys:

property
tenancy
financial
maintenance
historical

records.

Prefer archive/inactive behavior for clients with historical records.

---

# 48. Property Transfer Between Owners

Do NOT implement arbitrary property-owner reassignment without considering history.

If reassignment is allowed:

preserve audit/history.

If this is complex, defer full ownership transfer to another task.

Basic correction before activity exists may be allowed safely.

Document behavior.

---

# 49. Property Transfer Between Agents

Do NOT implement agent-to-agent portfolio transfer in TASK-032.

This belongs to future agency/team functionality.

---

# 50. No Full Agency Platform Yet

Explicitly exclude:

- multiple agents under one agency
- agency administrator
- employee invites
- team permissions
- shared portfolios
- commission management
- management-fee calculations
- owner payouts
- trust accounting
- client owner portal
- lead routing
- agent performance tracking

TASK-032 creates the architectural foundation for these later.

---

# 51. UX Language

For AGENT:

use:

Owners
Properties
Tenancies
Listings
Applications
Viewings
Maintenance
Finances
Reports

Avoid:

Landlords

as the primary client-management label if:

Owners

is clearer to users.

Internally, existing LANDLORD role naming may remain unchanged.

---

# 52. Product Test — LANDLORD

A landlord should still experience:

"My properties."

They should not see unnecessary agency concepts.

---

# 53. Product Test — AGENT

An agent should experience:

"These are the owners I work with, and these are the properties I manage for them."

They should not have to mentally pretend every property belongs to themselves.

---

# 54. Critical Architecture Test

If a new property-management feature is later added, for example:

Insurance records

we should ideally implement:

one Property Insurance feature

that works for both:

LANDLORD-owned property
AGENT-managed property

not:

Landlord Insurance
Agent Insurance

separately.

TASK-032 must establish this reuse principle.

---

# 55. Testing — Role Isolation

Test:

LANDLORD cannot access AGENT client records.

AGENT A cannot access AGENT B owner records.

AGENT A cannot access AGENT B properties.

AGENT cannot access unrelated LANDLORD property.

LANDLORD still accesses own property.

ADMIN behavior remains valid.

---

# 56. Testing — Property Creation

Verify:

LANDLORD:
creates property without owner selector.

AGENT:
must select/create owner when creating property.

AGENT:
cannot attach property to another agent's owner record.

Owner relationship persists correctly.

---

# 57. Testing — Existing Workflows

For agent-managed property verify:

property
listing
application
viewing
acceptance
tenancy
maintenance
inspection
finances
documents
tasks
messages
notifications
reports

operate through the same underlying workflows where implemented.

---

# 58. Responsive UX

Verify AGENT workspace on:

desktop
tablet
mobile

Owner selector/filter must remain usable.

Do not overload mobile navigation with unnecessary nested controls.

---

# 59. Database Migration

Any required migration must be:

forward-only
non-destructive
compatible with existing landlord data

Do NOT:

reset DB
rewrite migration history
delete existing properties

Report migrations before hosted application if authorization is required.

---

# 60. Required Verification

Run:

npm run lint
npm run test
npm run build
npm run format:check
npm run security:check
git diff --check

Run DB checks and role/privacy integration tests.

Run appropriate browser/E2E tests for:

LANDLORD
AGENT
TENANT
ADMIN

---

# 61. Acceptance Criteria

TASK-032 is complete only when:

- [ ] AGENT is a supported authenticated role.
- [ ] AGENT workspace reuses the property-owner workspace architecture.
- [ ] Agent UI is not implemented as a copied landlord application.
- [ ] Agent sidebar contains Owners.
- [ ] LANDLORD sidebar does not unnecessarily contain Owners.
- [ ] Agent can create owner/client records.
- [ ] Agent can edit/view/archive their owner/client records safely.
- [ ] Agent can create property and attach it to an owner.
- [ ] Property clearly distinguishes manager from recorded owner.
- [ ] Existing landlord-owned properties continue working.
- [ ] Landlords do not need owner/client records.
- [ ] Agent property lists can be filtered by owner.
- [ ] Property 360 shows owner context for agent-managed properties.
- [ ] Agent Overview includes owner/portfolio context.
- [ ] Existing operational modules are reused.
- [ ] Tenant private/public behavior remains unchanged.
- [ ] Public APIs do not expose private owner records.
- [ ] Agent A cannot access Agent B data.
- [ ] Agent cannot access unrelated landlord data.
- [ ] LANDLORD permissions are not broadened.
- [ ] RLS remains deny-by-default.
- [ ] No full agency-team system was introduced.
- [ ] Existing tests remain healthy.
- [ ] New role-isolation tests pass.
- [ ] Build passes.
- [ ] Security checks pass.

---

# 62. Completion Report

Report:

## Architecture

Explain how LANDLORD and AGENT reuse the same property-management product.

## Role Model

Explain:

TENANT
LANDLORD
AGENT
ADMIN

## Managed Owners

Explain the client-owner data model.

## Property Ownership vs Management

Explain how the system distinguishes:

property owner
property manager

## Agent Workspace

Document navigation and agent-specific functionality.

## Shared Workspace

List the modules reused between LANDLORD and AGENT.

## Property Creation

Explain different landlord and agent flows.

## Authorization

Document agent/property/client authorization.

## RLS

Document policies and privacy boundaries.

## Existing Data Compatibility

Explain how existing LANDLORD property data remained intact.

## Deferred Agency Features

Explicitly list:

team accounts
commissions
management fees
owner portal
agency administration
shared portfolio

as future work.

## Database

List migrations/tables/indexes/functions.

## Verification

Report all automated, DB, security and browser/E2E checks.

Then stop.