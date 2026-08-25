# TASK-018 — Messages Completion Report

## Summary

Implemented participant-only conversation messages and read state on top of
TASK-017. Messages are immutable, strict plain text, sender identity is taken
from the verified session, and all message/read mutations are database-backed
and atomic. No TASK-019 functionality was added.

## API

- `GET /api/v1/conversations/:conversationId/messages?page=1&limit=50`
- `POST /api/v1/conversations/:conversationId/messages`
- `POST /api/v1/conversations/:conversationId/read`
- Conversation list responses now include safe `last_message` and
  `unread_count` fields.

## Authorization and Privacy

Every message route requires an authenticated ACTIVE participant. Membership
is loaded from the database; guessed or unrelated conversation IDs return the
same privacy-safe 404 as an absent conversation. Sender identity is never
accepted from request input. Serializers expose only message ID, body, time,
and a relative `sender.is_me` flag. Conversation previews contain only body,
time, and that same relative flag. No email, phone, internal user ID,
metadata, private profile field, or exact location is returned.

Existing participants retain access after listing pause, closure, rental, or
other unavailability, while TASK-017 tenant listing privacy remains enforced.

## Validation and Pagination

Message bodies are strict objects containing only `body`; values are trimmed,
must be non-empty, and are limited to 4,000 characters. Unsupported fields,
sender spoofing, blank values, and oversized values are rejected. Bodies are
rendered as text and are not interpreted as markup. History is deterministic
ascending `(created_at, id)` pagination with default limit 50 and maximum 100.

## Atomicity and Read State

`send_message_transaction` inserts the message and updates
`conversations.updated_at` in one transaction. Its unique participant check
prevents non-members from writing. `mark_conversation_read_transaction`
updates only the authenticated participant’s `last_read_at`.
Unread counts include only counterparty messages newer than that timestamp;
own messages never count as unread. Repeated/concurrent sends and read
updates are covered by the hosted checks.

## Database and RLS

Added migration `202608250001_add_message_transactions.sql`, including the
deterministic history index and revoked, `service_role`-only SECURITY DEFINER
send/read functions with a pinned empty search path. Existing deny-by-default
RLS remains unchanged; direct browser access to conversations,
conversation_participants, or messages is blocked.

## Frontend

Conversation detail now loads bounded history, marks the conversation read,
shows an empty state, renders safe text messages, and provides a trimmed
4,000-character composer. Conversation lists show safe latest-message previews
and unread badges. Historical conversations retain the composer when a listing
becomes unavailable.

Realtime delivery, notifications, attachments, editing, deletion, reactions,
typing indicators, acceptance, and all TASK-019+ work remain deferred.

## Verification

- Local tests: frontend 155 passed; backend 566 passed; database 11 migrations
  and 24 checks passed.
- `npm run db:verify`, `npm run lint`, `npm run format:check`, `npm run build`,
  and `git diff --check`: passed.
- Migration applied to the linked hosted project with `supabase db push --yes`
  and no reset.
- Hosted database verification: 10/10 checks passed.
- Hosted TASK-017 conversation verification: 6/6 checks passed.
- Hosted TASK-018 message verification: 6/6 checks passed, covering sending,
  validation, participant isolation, pagination, unread/read state,
  concurrent sends/activity, unavailable listings, and publishable-key RLS.
- All previous hosted regressions passed: auth 10, profiles 7, properties 8,
  images 11, listings 10, search 9, saves 10, questions 9, applications 12,
  answers 13, submissions 10, tenant applications 9, landlord applications 9,
  application transitions 9, and viewings 6 (142 checks).
- Hosted total for this completion: 164 checks (10 database catalog + 6
  TASK-017 + 6 TASK-018 + 142 prior regressions).

No credentials were printed, exposed, or committed.

## Recommended Next Task

TASK-019, only after explicit authorization.
