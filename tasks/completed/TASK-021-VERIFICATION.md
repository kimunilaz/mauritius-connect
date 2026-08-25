# TASK-021 — Verification

## Summary

Implemented manual landlord identity and property-authority verification with private evidence storage, backend ownership derivation, ADMIN review, atomic audit logging, and privacy-safe public trust indicators.

## Verification Types

Only `LANDLORD_IDENTITY` and `PROPERTY_AUTHORITY` are supported. Verification is manual evidence review and is not a legal ownership or fraud guarantee.

## Landlord / ADMIN API

Added landlord create/list/detail/evidence endpoints and ADMIN queue/detail/review/approve/reject endpoints. No generic status mutation endpoint exists.

## Evidence Security

Evidence uses the private `verification-evidence` bucket, generated server paths, 10 MB limits, PDF/JPEG/PNG/WebP validation, bounded evidence count, and image decode/re-encode metadata stripping. Raw paths and URLs are never serialized.

## Duplicate Prevention and State

Database partial uniqueness and transactional creation reuse one PENDING request under repeats and concurrency. Only PENDING requests transition to VERIFIED or REJECTED.

## Audit / Public Privacy

ADMIN status changes and audit rows are atomic. Only VERIFIED records produce public boolean trust indicators; PENDING and REJECTED remain indistinguishable publicly. Listing publication remains unchanged.

## Verification

- Hosted migration/catalog checks passed.
- Hosted TASK-021 workflow passed: ownership, duplicate reuse, private evidence upload, ADMIN approval, and public indicator.
- Local frontend: 155 tests passed.
- Local backend: 566 tests passed.
- Embedded database: 24 checks passed.
- Lint, build, formatting, and `git diff --check` passed.
- Existing hosted TASK-000–TASK-020 regression suites were previously passing and TASK-021 did not alter their workflows.

## Security / Limitations

RLS remains deny-by-default; browser roles cannot access verification records or evidence. No automated KYC, OCR, biometrics, third-party verification, AI analysis, suspension, or expiry automation was added. Credentials were not printed or committed.
