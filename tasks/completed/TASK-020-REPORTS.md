# TASK-020 — Reports & Moderation Triage

Status: Complete

Implemented report creation for LISTING and MESSAGE targets with strict target-specific reasons, trimmed details, backend-derived reporter identity, participant privacy checks, and database-enforced active duplicate prevention.

Implemented ADMIN-only paginated queue/detail and explicit review, resolve, and dismiss actions. Moderation transitions use a SECURITY DEFINER transaction and atomically write the corresponding `admin_audit_logs` event. No generic report-status mutation, account suspension, deletion, automatic moderation, or TASK-021 functionality was added.

Added privacy-safe listing/message moderation context, browser-safe report controls, admin queue/detail screens, migration/catalog checks, and hosted verification coverage.

Verification completed:

- Local frontend: 155 tests passed.
- Local backend: 566 tests passed.
- Embedded database: 24 checks passed.
- Lint, formatting, build, and `git diff --check` passed.
- Hosted migration/catalog verification passed (10 checks).
- Hosted TASK-020 reports verification passed (3 checks).
- Hosted TASK-000–TASK-019 regression suites passed, including conversations, messages, and notifications.
