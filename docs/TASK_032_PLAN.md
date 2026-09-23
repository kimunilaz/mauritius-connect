# TASK-032 schema and implementation plan

## Review before migrations

Read CURRENT_TASK and the current governing product/architecture/data/API/security/testing/development/UI documentation. TASK-032 explicitly extends the role model while preserving TASK-031 operations. The workspace contains uncommitted prior tasks; preserve those edits. Hosted TASK-031 migrations remain unapproved unless the ledger proves otherwise; no hosted writes/reset are authorized here.

Existing properties.landlord_id is a non-null FK to landlord_profiles.id. That profile belongs to the authenticated LANDLORD and represents the self-owning party. Existing services pass this profile key across property/listing/application authorization. Operational SQL and conversations resolve this key to profiles.user_id. Do not assign agents fabricated landlord records or silently reinterpret landlord_id.

## Chosen compatible model

Add property_manager_profiles(id,user_id unique). Backfill existing landlord profile IDs unchanged, and keep new landlord profile insertion synchronized. This is a minimal authenticated management relationship, not an agency/team organization or a new authentication account. Add properties.property_manager_id referencing it; backfill from existing landlord_id. Existing landlord_id remains the self-owner FK and becomes nullable only for agent-managed assets.

Add managed_property_owners(id,property_manager_id,name,company,email,phone,address,notes,archived_at,timestamps,version). It is an agent-owned business record, never an Auth/profile user. Add properties.managed_owner_id with composite FK to owner(id,property_manager_id), enforcing same manager. LANDLORD property: landlord_id preserved, manager profile belongs to same user, managed_owner_id null. AGENT property: landlord_id null, manager belongs to authenticated agent, managed_owner_id required and active at creation.

A property trigger derives legacy inserts, validates role/relationships and locks the owner against archival races. Manager/owner reassignment is immutable in this task; ownership transfers are deferred. Archiving an owner preserves history and management access to existing properties but blocks new property attachment. No existing property/client/tenancy/financial records are deleted.

## Shared implementation

One reusable ensurePropertyManager service returns the management profile for LANDLORD/AGENT. Existing repositories scope through property_manager_id; the same listing/application/viewing/operations modules and compatible URLs serve both roles. Existing transaction functions are forward-replaced with manager joins and explicit role checks. ADMIN remains separately privileged; identity verification stays LANDLORD-only, while PROPERTY_AUTHORITY can verify an agent's management/listing authority without calling them a verified owner.

Only Owners CRUD is agent-specific (/api/v1/agent/owners, /agent/owners). Shared /owner routes and existing /landlord compatibility routes are role-aware. Agent dashboard, Property 360, property creation and filters add owner context using shared components. No owner/client identity enters public or tenant serializers. No agent-client conversations or authenticated owner portals.

## Verification

Deny-by-default RLS, service-role-only RPCs, server scoped ownership, strict inputs and optimistic client edits. Test two agents plus LANDLORD/TENANT/ADMIN, legacy compatibility, archive/creation races and all shared workflows. Run lint/full tests/build/format/security/diff, isolated DB checks and desktop/mobile E2E. Prepare hosted changes and live test coverage; obtain documented environment authorization only after concrete local results are reviewable.
