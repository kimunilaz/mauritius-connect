# TASK-024 — Application Acceptance & Rental Closure

Status: Complete

Added the explicit landlord acceptance endpoint for `VIEWING_COMPLETED` applications. A single backend transaction locks the listing and application, verifies landlord ownership and eligibility, accepts the target, records history, marks the listing RENTED, rejects eligible competing submitted applications with histories, and relies on idempotent notification triggers for acceptance/rejection notifications.

The existing one-accepted-application invariant remains authoritative. Repeated acceptance is idempotent; incompatible states return a stable conflict. DRAFT applications remain untouched and private. RENTED listings naturally disappear from public discovery while existing history and conversations remain available.

No payment, lease, signature, escrow, commission, property-management, generic status endpoint, or TASK-025 functionality was added.

Verification:

- Hosted acceptance migration applied without reset.
- Hosted database catalog checks passed.
- Local frontend/backend tests and embedded database verification passed.
- Lint, build, formatting, security check, and diff checks passed.
