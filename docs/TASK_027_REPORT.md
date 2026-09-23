# TASK-027 — UI Color System Refresh

## Summary

The frontend visual refresh is implemented. Formal task acceptance remains blocked
by the required dependency security gate: the unchanged backend dependency tree
contains two high-severity and one moderate-severity vulnerabilities.

The current task explicitly supersedes the earlier blue-only instruction in
`UX_UPGRADE.md` and the TASK-026 design freeze. Existing uncommitted workspace
changes were preserved. TASK-027 changes only presentation, visual checks and
documentation. No subsequent task has been started.

## Theme Tokens

`frontend/src/palette.css` is the single source of color definitions. Both global
stylesheets now consume semantic `--color-*` tokens; the duplicated root palettes,
`--fb-*` aliases and unused fallback theme names have been removed.

| Token (`--color-` prefix) | Value | Purpose |
| --- | --- | --- |
| primary | `#0A66C2` | Main actions, links, default icons |
| primary-hover | `#004182` | Primary button/link hover |
| primary-active | `#003A70` | Pressed actions |
| primary-soft | `#E8F3FF` | Selected navigation, own messages, unread notifications |
| primary-border | `#B7D7F5` | Blue-tinted surface edges |
| focus | `rgba(10, 102, 194, 0.30)` | Focus halo, paired with a solid blue outline |
| background | `#F4F2EE` | Page canvas |
| surface | `#FFFFFF` | Cards, inputs, inverse text |
| surface-subtle | `#F8F9FA` | Neutral statuses and counterparty messages |
| text | `#191919` | Body and heading text |
| text-muted | `#666666` | Supporting text |
| text-subtle | `#8C8C8C` | Reserved for decorative/disabled content; not used for body text |
| border | `#D9D9D9` | Decorative card edges |
| border-strong | `#B5B5B5` | Stronger neutral edges |
| control-border | `var(--color-text-muted)` | Accessible form boundaries |
| danger / danger-soft | `#B42318` / `#FEECEC` | Errors, rejection, destructive actions |
| warning / warning-soft | `#B54708` / `#FFF4E5` | Pending review, warnings, readiness problems |
| success / success-soft | `#157A55` / `#E9F7F1` | Verified, completed and healthy status |
| info | `var(--color-primary)` | Neutral workflow progress |

Primary, surface and shadow RGB channels are also centralized (`10 102 194`,
`255 255 255`, and `0 0 0`) for translucent decoration and shadows. The HTML
browser theme-color remains `#0A66C2`; this metadata necessarily lives outside CSS.

## Green Audit

The committed historical stylesheet used `#12624A` / `#0D4D3A` as primary/hover,
green-tinted text (`#24322C`, `#596961`), canvas/borders (`#F4F7F5`, `#D8E1DC`,
`#D8DEDB`), avatar/placeholder surfaces (`#E6EFEB`, `#F3F7F5`, `#E7ECE9`,
`#E4F1EC`), and verification colors (`#176B45`, `#E8F4ED`, `#124C34`).

Earlier working-tree edits had already replaced those literals, but retained
duplicated Facebook-named tokens, mapped success to blue and errors to black,
made primary hover indistinguishable, and overrode unread emphasis. This task
consolidates that intermediate state into the specified palette rather than
performing another blind hexadecimal replacement.

The final audit covers 87 authored frontend source/configuration files, including
CSS, JSX, JS, HTML and possible SVG assets, excluding generated dependencies/builds
and test fixtures. No old green literals, old theme aliases, unresolved custom
properties, or scattered color literals remain outside the palette and HTML
theme-color metadata. No inline JSX color values were found. RGB shadows use
centralized channels. No dark-mode theme exists or was introduced.

Exactly two green values remain, both defined only in `palette.css`:

| Remaining value | Intentional uses |
| --- | --- |
| `#157A55` (`success`) | Text/borders for VERIFIED (landlord/property/ADMIN), ACCEPTED, COMPLETED, VIEWING_COMPLETED, RESOLVED, RENTED, ACTIVE listing/account status; connected API health; the explicit property-information verification notice; the application-submitted confirmation border. |
| `#E9F7F1` (`success-soft`) | Backgrounds behind those success/status badges and the explicit property-information verification notice. |

ACTIVE green is limited to a labeled availability/account-health badge. It is
never a navigation state, default action or default icon. Submission uses a
success border only after the existing submitted branch renders. Ordinary
`role="status"` messages remain neutral because several existing components use
the same message channel for both success and failure. Selected filters, including
an Accepted filter, remain blue. All statuses retain their textual labels.

## Components Updated

| Area | Result |
| --- | --- |
| Buttons and links | Blue primary/default actions; distinct hover/pressed states; white secondary actions with blue text; explicit red remove/archive/delete/suspend/reject controls. |
| Navigation | Shared blue system for public, tenant, landlord, mobile and ADMIN; restrained pale-blue sidebar selection with a blue edge; existing header structure retained. |
| Forms | Shared input/select/textarea boundaries, blue focus and native checkbox/radio accent; selected radio panels; upload-focus/file-selector styling; invalid fields remain red. |
| Cards and listings | Neutral cards and borders; blue listing actions; semantic ACTIVE/RENTED and pending-review badges. |
| Applications and viewings | State attributes on existing labels distinguish progress, acceptance, rejection, completed viewings and warnings without changing transitions. |
| Messages | Blue-tinted own messages, neutral counterparty messages, blue send/report actions. |
| Notifications | Blue unread surface/edge, neutral read cards, existing accessible Read/Unread labels. |
| Verification | Small semantic status badges and existing verified-property notice; approval/save controls remain blue. |
| ADMIN and reports | Same controls/cards/tokens as the rest of the app; blue approve/resolve/search, red reject/suspend, amber pending/open statuses. |

Source changes are in `palette.css`, `styles.css`, `workspace.css`, and visual
classes/attributes in 22 existing JSX components/pages. No new runtime component,
service, route or application state was added. The browser suite gained
`e2e/color-system.spec.js`; `playwright.workspace.config.js` includes it.

## Accessibility

Calculated contrast ratios: primary/white **5.69:1**, hover/white **10.10:1**,
body/page **15.72:1**, muted/page **5.14:1**, success/soft **4.82:1**,
warning/soft **4.99:1**, danger/soft **5.77:1**. These text pairs exceed 4.5:1.
The form-boundary token contrasts with white at **5.74:1**; decorative borders
are not relied upon as the sole input affordance. Subtle text is reserved rather
than applied to small readable copy.

Focus uses a solid blue outline in addition to the translucent focus halo;
links/actions on existing solid-blue headers retain a white focus outline.
Keyboard focus, primary default/hover/pressed states and labeled semantic states
were checked in the browser. This is targeted contrast/focus QA, not a claim of
complete WCAG certification.

## Responsive Visual QA

Playwright Chromium captured 58 full-page fixture screenshots across 390px mobile
and 1440px desktop. Screens cover public search/details, login/register, tenant
applications/detail, landlord dashboard/properties/forms/listings/detail/pipeline,
applicant detail/viewings, conversations/messages, notifications, public reporting,
landlord verification, and ADMIN overview/users/listings/reports/verifications.
The required representative screens were visually inspected in both sizes.
Existing workspace smoke also checks 320px and 768px widths, mobile navigation,
property setup, logout and failed-dashboard recovery.

The audit exposed mobile overflow from long ADMIN report headings and the public
detail grid's intrinsic minimum width. Wrapping/min-width styling fixes those
issues without changing page structure or content. Browser checks cover navigation,
message send, mark-all-read, primary interaction states, focus and status colors;
no unexpected page/console errors or unmocked API calls occurred in the final run.

Screenshots are under ignored `test-results/task027/`; the source/contrast audit
is `test-results/task027-color-audit.json`. Tests use isolated Auth/API fixtures
on port 5180. They do not validate hosted provider configuration or real email
delivery. The mutation-heavy hosted lifecycle suite was intentionally not run
for this CSS-only task. Other browser engines and physical devices were not tested.

## Backend / Database

No backend changes, database changes, API changes or migrations. No hosted data
operations, storage uploads or deployments. The database checks in `npm run test`
use embedded local PostgreSQL and static migration inspection.

## Dependencies

None added or updated. Package manifests and lockfile were not changed by TASK-027.

## Verification

| Command | Result |
| --- | --- |
| `npm run lint` | PASS: frontend and backend |
| `npm run test` | PASS: 172 frontend tests, 578 backend tests, 26 embedded database checks; 19 migrations inspected |
| `npm run build` | PASS; existing nonblocking bundle-size warning remains (JS bundle over 500 kB) |
| `npm run format:check` | PASS |
| `npm run security:check` | **FAIL**: static credential check passes; dependency audit reports 2 high and 1 moderate vulnerabilities |
| `git diff --check` | PASS |
| `npm run test:e2e:workspace` | PASS: 13 browser smoke tests, including 9 TASK-027 cases |
| Frontend color/token source audit | PASS: 87 files; no unexplained green theme remnants |

The initial sandboxed dependency-audit attempt could not reach the npm registry.
The subsequent network-enabled run completed and reported the real findings:

- `multer@2.2.0`: high-severity multipart/upload denial-of-service and limit-bypass
  advisories (`GHSA-wc9g-mqfw-jrwm`, `GHSA-qfvm-cv95-jqjf`,
  `GHSA-qvfw-j98x-7q72`, `GHSA-535w-7cp7-47q4`).
- `sharp@0.35.3`: high-severity bundled libheif vulnerabilities
  (`GHSA-rgj7-g3m4-5g8c`).
- `qs@6.15.3`: moderate-severity parser advisories
  (`GHSA-x5fp-wj9c-mxmx`, `GHSA-4mjr-xmp4-gh2g`).

These are in the existing backend dependency tree, verified with `npm ls` and an
unchanged lockfile/backend diff. Automatic dependency repair would exceed the
authorized visual-only scope. No audit findings were suppressed, thresholds
changed, or backend dependencies upgraded. The security acceptance checkbox
remains open and TASK-027 is not marked fully complete.

## Feature Scope

No product functionality, rental workflow, role permissions, API behavior,
backend behavior or database schema changed. Existing layouts, logo, typography
and assets were retained; no LinkedIn branding, assets or interface was copied.
Work stops at TASK-027 with the dependency security gate explicitly unresolved.
