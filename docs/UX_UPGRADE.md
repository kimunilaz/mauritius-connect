# Rental workspace experience upgrade

Current product identity and public positioning follow [BRAND.md](BRAND.md). TASK-030 introduces Asserta and an owner-first homepage while retaining the operational workspaces from TASK-029.

The September 2026 user request authorizes a visual and workflow upgrade to the
existing rental platform, superseding the previous deployment task's design
freeze for this work. Existing rental states, permissions, API contracts and
Supabase data remain the foundation.

## Experience

- TASK-027 supersedes the earlier strict blue-and-neutral palette. `palette.css`
  is the single source of semantic `--color-*` tokens: primary `#0A66C2`, hover
  `#004182`, active `#003A70`, neutral surfaces and readable text. Green is
  reserved for verified/success/healthy status, red for errors and destructive
  actions, and amber for warnings. Normal actions, selected navigation, focus
  and unread notifications remain blue. See [TASK-027 report](TASK_027_REPORT.md)
  for the full palette, source audit, contrast checks and verification results.
- Persistent role-specific workspace navigation, mobile menu and workspace-wide
  logout. Tenant and admin actions remain limited to their respective roles.
- Landlord overview shows actual API totals for properties, active listings,
  pending reviews and drafts. Each count links to its matching destination.
  Loading and error states never present fabricated zero totals.
- Latest listing shortcuts, direct applicant links and a property-to-listing-to-
  applicant journey across setup and management pages.
- Listing status filters persist in the URL, including dashboard deep links.
- New public homepage with functional locality search and separate tenant and
  landlord entry points. Authentication pages share the same visual identity.
- Account error screens offer retry and return-to-login actions.

## Verification

Run `npm run test --workspace frontend`, `npm run lint`, `npm run build`, and
`npm run test:e2e:workspace` from the repository root.

The workspace browser suite uses isolated Auth and API fixtures. It tests real
browser navigation, status-filter links, applicant access, empty/error states,
mobile property setup and logout. It checks horizontal overflow at 320, 390,
768 and 1440 pixel widths and saves screenshots under ignored `test-results/`.
It does not create or delete hosted accounts or rental records and does not
replace the full hosted lifecycle suite.

## Scope

This upgrade improves the existing rental and applicant-management product.
It does not implement tenancy contracts, rent accounting, maintenance tickets,
new countries/currencies or production hosting. Those need their own product
requirements and validation. The local application remains available for review;
Vercel and Render deployments require the release workflow already documented.
