# TASK-017 — Conversations Completion Report

## Summary

Completed the secure conversation foundation for tenant/landlord rental
conversations. Creation is tenant-only, listing eligibility is enforced on the
backend, membership is atomic and idempotent, and all responses use minimal
privacy-safe serializers. Messages and all TASK-018 functionality remain
deferred.

## API

- `POST /api/v1/listings/:listingId/conversation`
- `GET /api/v1/conversations`
- `GET /api/v1/conversations/:conversationId`

## Creation Eligibility

Only authenticated ACTIVE TENANT accounts may create conversations. New
creation requires an ACTIVE listing on a non-archived property and allows
pre-application contact. Other listing states return privacy-safe
`404 LISTING_NOT_FOUND`.

## Participants and Atomicity

The backend derives the tenant from the verified auth identity and the
landlord through listing → property → landlord profile → profile identity.
`create_conversation_transaction` inserts or reuses the unique conversation,
then inserts the two participant rows in the same transaction. The unique
party constraint plus conflict handling makes repeated and concurrent requests
return one conversation with exactly two memberships.

## Membership Security and Privacy

List/detail queries require a participant row; unrelated users receive
`CONVERSATION_NOT_FOUND`. Serializers expose only counterparty first name, last
name, and optional profile photo. IDs, contact data, private profile fields,
Supabase metadata, exact location, coordinates, and storage paths are omitted.
Tenant history hides listing details once the listing is unavailable; landlord
history retains only safe owned listing context.

## Frontend

Added protected `/conversations` and `/conversations/:conversationId` routes,
tenant Contact landlord creation/reuse navigation, logged-out login affordance,
role-specific list/detail/empty states, unavailable-listing presentation, and
no message or unread UI.

## Messages

Messages, read-state mutation, realtime, notifications, attachments,
acceptance, and other TASK-018+ functionality were not implemented.

## Database Changes

Added `database/migrations/202608220004_add_conversation_transaction.sql` and
the follow-up `database/migrations/202608240001_fix_conversation_transaction_ambiguity.sql`.
The SECURITY DEFINER function pins an empty search path, uses no dynamic SQL,
is revoked from `PUBLIC`, `anon`, and `authenticated`, and is executable only
by `service_role`. RLS and historical migrations were not weakened or edited.

## Dependencies

None.

## Verification

- Conversation backend tests: 14 passed.
- Conversation frontend tests: 9 passed.
- Full root tests: 155 frontend + 566 backend passed.
- Static/embedded database verification: passed (9 migrations, 24 runtime checks).
- `npm run lint`: passed.
- `npm run build`: passed (existing Vite chunk-size advisory only).
- `npm run format:check`: passed.
- `git diff --check`: passed.
- Hosted database verification: 10/10 checks passed after applying both
  migrations through `supabase db push --yes`.
- Hosted TASK-017 conversation verification: 6/6 checks passed, including
  concurrent creation, two memberships, both-party access, privacy, RLS, and
  unrelated-user isolation.
- All prior hosted regressions passed: auth 10, profiles 7, properties 8,
  images 11, listings 10, search 9, saves 10, questions 9, applications 12,
  answers 13, submissions 10, tenant applications 9, landlord applications 9,
  application transitions 9, and viewings 6.
- Hosted total: 158 checks passed (10 catalog + 6 TASK-017 + 142 prior
  regression checks).

## Security

RLS remains deny-by-default; browser table access to conversations and
participants remains blocked; participant identities are backend-derived; and
no credentials or secrets were exposed or committed.

## Known Limitations

Messages, read/unread state, realtime delivery, notifications, attachments,
and acceptance remain deferred to later tasks.

## Recommended Next Task

TASK-018 — Messages
