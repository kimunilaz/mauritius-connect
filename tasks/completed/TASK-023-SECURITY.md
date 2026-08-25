# TASK-023 — Security & Abuse Hardening

Status: Complete

Implemented process-local configurable API rate limiting with global and stricter mutation protection, stable 429 responses, Retry-After, and no downstream side effects on rejected requests. Limits cover messages, reports, conversations/applications, uploads, publication, and ADMIN mutations. The process-local limitation is documented: counters are not shared across multiple instances and should be replaced by distributed infrastructure in a later deployment task.

Hardened CORS fail-safe behavior, Helmet usage, bounded JSON/upload requests, no-store API caching, privacy-safe error serialization, sanitized request logging, strict environment validation, and multipart error handling. Added reproducible `npm run security:check` with static secret scanning and high-severity dependency audit.

Audited existing authentication/ACTIVE-account/role/ownership middleware, RLS and SECURITY DEFINER catalog checks, private Storage configuration, and frontend rendering. No new rental-product workflow, Redis, CAPTCHA, WAF, MFA, or TASK-024 functionality was added.

Verification:

- `npm run security:check`: passed; 0 dependency vulnerabilities.
- Local frontend: 155 tests passed.
- Local backend: 566 tests passed.
- Embedded database: 24 checks passed.
- Hosted catalog verification: passed.
- Lint, build, formatting, and `git diff --check`: passed.
