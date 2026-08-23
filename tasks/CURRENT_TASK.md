# TASK-017 — Conversations

## Status

READY

## Priority

P0 — Communication Foundation

## Objective

Implement secure conversation creation, membership, listing, and detail access between a tenant and the landlord of a rental listing.

This task covers:

- tenant-created conversation for an eligible listing
- exactly one conversation per tenant/landlord/listing
- exactly two authorized participants
- conversation listing
- conversation detail
- minimal counterparty identity
- historical conversation access
- concurrency-safe/idempotent creation
- frontend conversation foundation

Do NOT implement:

- sending messages
- message history
- unread-message counts
- notifications
- attachments
- URL previews
- typing indicators
- realtime messaging
- acceptance
- additional application transitions

TASK-018 owns Messages.

---

## 1. Required Reading

Read all governing documentation and inspect TASK-000 through TASK-016 before changing anything.

Especially:

docs/PRODUCT_SPEC.md
docs/ARCHITECTURE.md
docs/DATABASE.md
docs/API_SPEC.md
docs/SECURITY.md
docs/DEVELOPMENT_RULES.md
docs/TESTING.md
tasks/CURRENT_TASK.md

Reuse existing authentication, roles, listing eligibility, ownership, serializers, PostgreSQL transaction patterns, RLS posture, frontend API client, and hosted Supabase verification infrastructure.

---

## 2. Existing Tables

Use:

conversations

Fields:

id
listing_id
tenant_user_id
landlord_user_id
created_at
updated_at

Existing invariant:

UNIQUE(listing_id, tenant_user_id, landlord_user_id)

Use:

conversation_participants

Fields:

conversation_id
user_id
last_read_at
joined_at

Primary key:

(conversation_id, user_id)

Do not redesign these tables unless a genuine correctness issue requires a new migration.

---

## 3. Required API

Implement:

POST /api/v1/listings/:listingId/conversation

GET /api/v1/conversations

GET /api/v1/conversations/:conversationId

Do NOT implement:

POST /conversations/:id/messages
GET /conversations/:id/messages
POST /conversations/:id/read

Those belong to TASK-018.

---

## 4. Who May Create a Conversation

Only an authenticated:

ACTIVE TENANT

may create a conversation through:

POST /api/v1/listings/:listingId/conversation

LANDLORD and ADMIN must not create tenant-side listing conversations through this endpoint.

---

## 5. New Conversation Eligibility

A new conversation may be created only when:

listing.status = ACTIVE

AND

property.archived_at IS NULL

Reuse TASK-007 public-listing eligibility.

Pre-application conversation is allowed.

A tenant does NOT need an application before starting a conversation.

Do not require saved-listing or application state.

---

## 6. Participant Derivation

Never accept participant IDs from client input.

Derive:

tenant_user_id
from verified authenticated TENANT profile.

Derive:

landlord_user_id
from:

listing
→ property
→ landlord_profiles
→ profiles.user identity.

listing_id comes from the URL.

Do not trust:

tenant_user_id
landlord_user_id
user_id
participants

from request bodies.

---

## 7. Exactly Two Participants

Every normal V1 conversation must contain exactly:

1 tenant
1 listing landlord

Create both corresponding:

conversation_participants

rows.

Do not allow arbitrary users to join a conversation.

Do not implement group conversations.

---

## 8. Atomic Conversation Creation

Conversation creation and the two participant rows must behave atomically.

The system must never persist:

conversation without participants

or:

partially populated participant membership.

A narrowly scoped backend-only PostgreSQL transaction function is acceptable if required.

If introduced:

- create a NEW migration
- historical migrations remain untouched
- revoke execution from PUBLIC, anon, authenticated
- service-role backend only
- no dynamic SQL
- no credentials

---

## 9. Idempotency

Repeated creation for the same:

listing
tenant
landlord

must return the same conversation.

Do not create duplicates.

The database UNIQUE constraint remains the final concurrency guarantee.

---

## 10. Concurrent Creation

Multiple simultaneous POST requests must result in:

one conversation row
exactly two participant rows

No duplicate membership.

No raw PostgreSQL error.

Add hosted concurrency verification.

---

## 11. Non-Public Listing

Attempting to create a NEW conversation for:

DRAFT
PENDING_REVIEW
PAUSED
RENTED
CLOSED

or archived-property listing must return:

404 LISTING_NOT_FOUND

Do not reveal private listing existence.

---

## 12. Existing Conversation After Listing Changes

Once a conversation exists, participants may continue to access the conversation container even if the listing later becomes:

PAUSED
CLOSED
RENTED

or otherwise non-public.

Do not delete the conversation.

Message-send policy for unavailable listings belongs to TASK-018.

---

## 13. Conversation List

GET /api/v1/conversations

Requires:

verified authentication
ACTIVE account

Allowed roles:

TENANT
LANDLORD

Return only conversations where the authenticated user is a participant.

Support:

page
limit

Defaults:

page = 1
limit = 20

Maximum:

limit = 100

Order:

updated_at DESC
id DESC

---

## 14. Conversation List Serializer

Return only safe information.

Example concepts:

id
created_at
updated_at

counterparty:
first_name
last_name
profile_photo_url

listing context:
listing_id
availability

For TENANT:

if listing remains publicly eligible:
use a minimal safe public listing context.

If listing is no longer public:

availability = UNAVAILABLE
listing = null

Do not leak newly private listing data.

For LANDLORD:

safe owned listing context may include:

id
title
status

Do not expose unnecessary property/private fields.

---

## 15. Counterparty Privacy

Conversation participants may see minimal identity:

first_name
last_name
profile_photo_url

Do NOT expose:

email
phone
auth user IDs
tenant IDs
landlord IDs
account status
income
employer/school
preferred locations
Supabase metadata

TASK-018 may later determine whether contact details ever become appropriate.

---

## 16. Conversation Detail

GET /api/v1/conversations/:conversationId

Only a participant may access.

Unrelated user:

404 CONVERSATION_NOT_FOUND

Return:

conversation metadata
safe counterparty identity
safe listing context

Do NOT return messages yet.

Do NOT return participant internal IDs.

---

## 17. Membership Enforcement

Authorization must use conversation membership derived from the database.

Do not trust:

role alone
listing ownership alone
client-supplied participant IDs

A user not present in the conversation must not access it.

---

## 18. last_read_at

Do not implement unread-message behavior yet.

Creating participant rows may leave:

last_read_at = NULL

Do not invent unread counts when messages do not exist yet.

TASK-018 will define read-state semantics.

---

## 19. RLS

Do not weaken deny-by-default RLS.

Conversation reads/writes continue through Node.

Do not create browser-readable policies for:

conversations
conversation_participants

Direct publishable-key reads/writes must remain blocked.

---

## 20. Frontend Routes

Implement:

/conversations

/conversations/:conversationId

Accessible to authenticated ACTIVE:

TENANT
LANDLORD

Do not create a message input.

---

## 21. Public Listing Integration

For an authenticated TENANT viewing an ACTIVE listing, provide an appropriate action such as:

Contact landlord

or:

Start conversation

The action should idempotently create/retrieve the conversation and navigate to:

/conversations/:conversationId

Logged-out visitor should receive a login affordance.

LANDLORD should not see the tenant-side start-conversation action.

---

## 22. Conversation Detail UX

Until TASK-018, show:

- counterparty identity
- rental context
- conversation foundation state

Do not fake message sending.

Do not render disabled fake chat bubbles or claim messaging works.

A concise temporary state is acceptable during development.

---

## 23. Conversation List UX

Show:

counterparty name
safe rental context
created/updated date where useful

Do not show:

unread count
last message
message preview

because messages are not implemented.

---

## 24. Empty State

Example:

No conversations yet.

When you contact a landlord about a rental, the conversation will appear here.

For landlord:

No tenant conversations yet.

---

## 25. Security Tests

Test:

TENANT creates conversation for ACTIVE listing.

LANDLORD cannot use tenant create endpoint.

SUSPENDED/DELETED user blocked.

Tenant A cannot access Tenant B conversation.

Landlord A cannot access Landlord B conversation.

Unrelated authenticated user receives 404.

Protected participant fields cannot be mass-assigned.

---

## 26. Idempotency & Concurrency Tests

Mandatory:

repeated creation returns same conversation.

multiple concurrent creates produce:

one conversation
two participant rows

No duplicate memberships.

No raw database errors.

---

## 27. Eligibility Tests

New conversation:

ACTIVE listing → succeeds

DRAFT → 404
PENDING_REVIEW → 404
PAUSED → 404
RENTED → 404
CLOSED → 404
archived property → 404

Existing conversation remains readable after listing becomes unavailable.

---

## 28. Privacy Tests

Explicitly verify responses do NOT expose:

tenant_user_id
landlord_user_id
participant user IDs
email
phone
income
employment
preferred locations
account status
exact address
coordinates
Storage paths
Supabase metadata

For a TENANT, a now-unavailable listing must not leak private listing fields through the conversation API.

---

## 29. Frontend Tests

At minimum:

conversation routes protected

TENANT start-conversation action

logged-out login affordance

LANDLORD does not see tenant creation action

conversation creation redirects correctly

conversation list

empty state

conversation detail

counterparty display

unavailable listing presentation

cross-role/access protection

no message form exists

no unread UI exists

---

## 30. Hosted Supabase Verification

Using controlled integration records verify:

TENANT creates ACTIVE-listing conversation

repeat creation returns same conversation

concurrent creation produces one conversation/two participants

LANDLORD sees conversation in own list

TENANT sees conversation in own list

unrelated tenant cannot access it

unrelated landlord cannot access it

non-public listing cannot receive NEW conversation

existing conversation remains accessible after listing becomes non-public

private listing data remains hidden from tenant

minimal counterparty identity only

publishable-key direct conversations/participants reads and writes remain blocked

all previous hosted regressions remain healthy.

---

## 31. Database Changes

A NEW migration is acceptable if required for atomic conversation/participant creation.

Do not modify historical migrations.

---

## 32. Dependencies

Expected:

none.

---

## 33. Documentation

Update:

docs/API_SPEC.md

Document:

POST /listings/:listingId/conversation
GET /conversations
GET /conversations/:conversationId

Document:

- tenant-only creation
- ACTIVE-listing requirement for NEW conversations
- idempotency
- participant privacy
- historical conversation access
- messages deferred

---

## 34. Required Verification

Run:

npm run lint
npm run test
npm run build
npm run format:check
git diff --check

Run:

database verification
all hosted regressions
TASK-017 hosted conversation/concurrency checks.

---

## 35. Acceptance Criteria

TASK-017 is complete only when:

- [ ] Conversation creation endpoint exists.
- [ ] Only ACTIVE TENANT may create.
- [ ] New conversation requires publicly eligible ACTIVE listing.
- [ ] Pre-application conversation is allowed.
- [ ] Tenant identity is backend-derived.
- [ ] Landlord identity is backend-derived.
- [ ] Exactly two participants are created.
- [ ] Conversation + membership creation is atomic.
- [ ] Repeated creation is idempotent.
- [ ] Concurrent creation remains one conversation.
- [ ] Conversation list exists.
- [ ] Conversation detail exists.
- [ ] Only participants may access.
- [ ] Cross-user access returns privacy-safe 404.
- [ ] Existing conversation survives listing becoming unavailable.
- [ ] Tenant does not gain private listing access through conversation history.
- [ ] Counterparty identity is minimal.
- [ ] No contact/private profile information exposed.
- [ ] RLS remains deny-by-default.
- [ ] Direct browser table access remains blocked.
- [ ] /conversations frontend exists.
- [ ] /conversations/:id frontend exists.
- [ ] Tenant listing action creates/reuses conversation.
- [ ] No message sending implemented.
- [ ] No unread counts implemented.
- [ ] No notification functionality implemented.
- [ ] Hosted checks pass.
- [ ] Previous regressions pass.
- [ ] No secrets committed.

---

## 36. Completion Report

Report:

### Summary

### API

List all three endpoints.

### Creation Eligibility

Explain ACTIVE-listing and tenant-only rules.

### Participants

Explain backend participant derivation.

### Atomicity & Idempotency

Explain conversation + participant transaction and concurrency behavior.

### Membership Security

Explain participant-only access.

### Privacy

Explain counterparty and listing serialization, especially unavailable listings.

### Frontend

Report conversation list/detail/start-conversation behavior.

### Messages

Explicitly confirm messages were NOT implemented.

### Database Changes

List any new migration/function.

### Dependencies

Expected: none.

### Hosted Supabase Verification

Report real checks.

### Tests

Tests added:
Tests run:
Tests passed:
Tests failed:
Tests skipped:

### Root Verification

npm run lint
npm run test
npm run build
npm run format:check
git diff --check

### Security

Confirm:

RLS unchanged
participants backend-derived
direct browser access blocked
contact/private data not exposed
no credentials exposed.

### Known Limitations

Include:

messages deferred to TASK-018
read/unread state deferred
realtime deferred
notifications deferred
attachments deferred.

### Recommended Next Task

TASK-018 — Messages

Then stop.

Do not begin TASK-018.