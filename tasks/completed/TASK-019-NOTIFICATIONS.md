# TASK-019 — Notifications Completion Report

## Summary

Implemented secure in-app notifications for the approved application,
viewing, and new-message events. Recipients are derived from database
relationships, source events are idempotent, notification reads are
recipient-owned, and no email, SMS, push, worker, preference, digest, or
TASK-020 functionality was added.

## Notification API

- `GET /api/v1/notifications?page=1&limit=20&unread_only=false`
- `GET /api/v1/notifications/unread-count`
- `POST /api/v1/notifications/:notificationId/read`
- `POST /api/v1/notifications/read-all`

All routes require verified authentication, an ACTIVE account, and TENANT or
LANDLORD role. List ordering is deterministic `created_at DESC, id DESC`;
limit defaults to 20 and is capped at 100. Cross-user notification IDs return
`404 NOTIFICATION_NOT_FOUND`; repeated read operations are idempotent.

## Supported Events

- Application submitted → listing landlord
- Application under review, shortlisted, rejected → application tenant
- Application withdrawn → listing landlord
- Viewing proposed → tenant
- Viewing confirmed or declined → landlord
- Viewing cancelled → the other participant
- Viewing completed or no-show → tenant
- New message → the other conversation participant

The sender never receives a notification for their own message or action.

## Recipient Derivation

Application recipients are derived through application → listing → property →
landlord/tenant profile relationships. Viewing recipients are derived from the
owning application and its tenant/landlord relationships. Message recipients
are derived from conversation participant rows excluding the verified sender.
No recipient, actor, application, viewing, conversation, type, or ownership
field is accepted from client authority.

## Atomicity

Application-history, viewing, and message database triggers create
notifications in the originating transaction, so committed source events and
their required notification cannot diverge. Viewing cancellation uses a
service-role-only helper after the successful actor-scoped transition because
the existing viewing row does not persist the acting user; it re-derives both
participants and validates the actor before inserting.

## Idempotency

Migration `202608260001_add_notification_events.sql` adds a nullable
`source_event_key` and a unique partial index. Keys are based on the immutable
application-history row, viewing state event, message ID, or validated
cancellation actor/event. Duplicate source retries are ignored; stale and
losing concurrent transitions create no event notification.

## Read State

Unread means `read_at IS NULL`. Mark-one updates only the authenticated user's
row and uses a server timestamp. Mark-all updates only that user's unread
rows. Notification read state is independent from conversation
`last_read_at`.

## Privacy

Serializers expose only notification ID, type, neutral title/message,
`read_at`, `created_at`, and a protected navigation target. They never expose
recipient IDs, actor IDs, email, phone, private profile fields, exact location,
coordinates, Supabase metadata, or message bodies. New-message text contains
only the sender's first name.

## Frontend

Added authenticated `/notifications` with accessible notification controls,
unread/read labels, empty state, pagination, mark-one-read navigation, and
mark-all-read UX. Authenticated navigation includes a Notifications entry and
unread badge/count. Navigation targets remain protected by their normal APIs.

## Database Changes

- Added `notifications.source_event_key`.
- Added idempotency and deterministic user/time indexes.
- Added application-history, viewing, and message notification triggers.
- Added `create_viewing_cancel_notification(uuid, uuid)`, fixed
  `search_path`, revoked from PUBLIC/anon/authenticated, and granted only to
  `service_role`.
- RLS remains deny-by-default; no browser notification policies were added.

## Dependencies

None. No notification providers or queue libraries were added.

## Hosted Supabase Verification

- Migration applied with `supabase db push --yes` without reset.
- Hosted database catalog verification: 10/10.
- TASK-019 notification verification: 6/6, covering all approved event
  families, sender/counterparty behavior, idempotency, concurrency, unread
  state, pagination, cross-user isolation, privacy, and publishable-key RLS.
- Previous hosted regressions all passed: 142 checks.
- TASK-017 conversations: 6/6.
- TASK-018 messages: 6/6.
- Hosted completion total: 170 checks.

## Tests

Tests run:

- Frontend Vitest: 155 passed.
- Backend Vitest: 566 passed.
- Embedded database verification: 24 checks passed.
- Static database verification: 12 migrations inspected.
- Hosted event and regression suites listed above.

Tests failed: none after retrying one transient frontend worker-start timeout.

## Root Verification

- `npm run lint`: passed.
- `npm run test`: frontend, backend, and database checks passed.
- `npm run build`: passed; existing Vite chunk-size advisory remains.
- `npm run format:check`: passed.
- `git diff --check`: passed.

## Security

RLS is unchanged and remains deny-by-default. Recipients are backend/database
derived, cross-user notification access is isolated, direct browser creation
and mutation remain blocked, message bodies are not exposed in notifications,
and no credentials were printed, exposed, or committed.

## Known Limitations

Email, SMS, push, notification preferences, digests, and scheduled reminders
remain deferred. Realtime messaging and all TASK-020+ functionality remain
outside this task.

## Recommended Next Task

TASK-020 — Reports & Moderation
