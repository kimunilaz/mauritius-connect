# Asserta brand system

## Name and purpose

The master brand is **Asserta**. Use this spelling and capitalization in product text, navigation, titles and communications. Property management is a category descriptor, never part of the company name or logo.

Asserta provides property-management software for property owners and property agencies in Mauritius. The property is the central record, connecting tenancies, rent records, maintenance, inspections, documents, tasks and operational activity. Leasing is one part of this lifecycle; tenants also use discovery and applications.

Asserta is software, not an agency or managed-property service. Do not imply payment collection, accounting, screening, signatures, automated tenant decisions or unimplemented agency team capabilities.

## Messaging and voice

Introduce property management before explaining leasing steps. Public messaging welcomes owners and agencies; the owner remains responsible for decisions. Marketplace browsing is a visible secondary route.

Use calm, specific language: “Manage your properties”, “Review applications”, “Arrange viewings”, “From available to rented”. Describe existing tools and what happens next. Avoid motivational slogans, superlatives, AI claims, invented statistics, artificial urgency and vague trust guarantees. Illustrations must be labelled as illustrations; inventory must come from the public API.

Authenticated pages show actual activity and actions. Navigation belongs in the sidebar; do not turn overviews into marketing pages or repeat navigation as large promotional cards. Errors describe the failure and recovery action. Empty states explain what will appear and the next relevant action.

## Identity and assets

The open A uses two rising strokes, an offset apex and a crossbar. It suggests ordered progress without roofs, keys or location pins. The wordmark is simply **Asserta**, with a capital A and restrained tight spacing. No descriptor is attached to it.

Canonical assets are in `frontend/public/brand/`:

- `mark.svg`: blue compact A on transparent background.
- `mark-light.svg`: white compact A for blue/dark surfaces.
- `wordmark.svg`: blue mark and dark wordmark for light surfaces.
- `wordmark-light.svg`: white logo for blue/dark surfaces.
- `favicon.svg`: white A in a blue rounded tile, designed for 16, 24, 32 and 48 px.

`frontend/src/components/common/Brand.jsx` is the shared accessible home link. It uses the same mark assets with live wordmark text. `brand.css` defines identity sizing and the public owner presentation. SVG wordmark exports use local Arial/Helvetica fallback; they require no font downloads. The application uses its established system sans-serif stack.

Use the full wordmark in the public header, auth header, workspace sidebar and public footer. On narrow workspace topbars use the compact mark with the accessible name “Asserta home”; the expanded navigation retains the wordmark. Decorative marks have empty alt text, and the home link has one accessible name.

Keep clear space of at least one quarter of the mark's width around standalone logos. Default mark: 40 px; compact mobile topbar: 28 px inside a 44 px tall link. Use a minimum 24 px standalone mark; only the dedicated favicon may be smaller. Preserve aspect ratio. Do not rotate, stretch, add shadows/gradients, change the cut, attach a category to the name or use white artwork on light surfaces.

## Palette

`frontend/src/palette.css` remains the source of CSS color tokens.

| Purpose                    | Color     |
| -------------------------- | --------- |
| Primary                    | `#0A66C2` |
| Hover / deep brand surface | `#004182` |
| Active                     | `#003A70` |
| Soft blue                  | `#E8F3FF` |
| Background                 | `#F4F2EE` |
| Surface                    | `#FFFFFF` |
| Text                       | `#191919` |
| Muted text                 | `#666666` |
| Border                     | `#D9D9D9` |
| Success                    | `#157A55` |
| Warning                    | `#B54708` |
| Error / destructive        | `#B42318` |

No additional accent color is introduced. Warm neutral backgrounds, the open A, restrained type, asymmetric owner hero and numbered workflow distinguish Asserta. Green, amber and red communicate semantic outcomes only; statuses always include text. Use stronger existing control borders for inputs and preserve visible focus rings.

## Typography and layout

Use the existing system sans-serif family, with bold page headings and normal readable body text. The wordmark uses 750 weight and −0.055em tracking at 1.7rem. Public hero type scales from 2.25rem to 3.8rem; application typography stays compact and operational. Body copy should have comfortable line height and bounded line length.

Use existing spacing tokens and a 4/8 px rhythm. Public content is bounded at 75rem. Owner content stacks on mobile/tablet; forms, listing cards and workspaces keep their established responsive behavior. Avoid decorative card proliferation and oversized authenticated headings.

## Terminology

“Property owner” describes the public audience; **Landlord** remains the account role and workflow term. **Tenant** is the browsing/applying role; **applicant** describes a submitted application context. A **property** is the physical asset; a **listing** is its rental offer. Use **application**, **viewing**, **message**, **notification** and **verification** consistently. Display raw states as human-readable labels, such as Active, Pending review and Under review.

## Domain and operational naming

The intended public domain is **https://asserta-mu.com**. Registration, DNS, TLS and deployment have not been verified by this branding task. Do not describe it as live or use it to redirect authentication until the deployment operator verifies and configures it. No support address, telephone, company registration or physical address is asserted.

Preserve infrastructure names, package identifiers, local directories, migration history and deployed resource references where renaming could affect tooling. Current documentation uses Asserta. Historical records and the original task brief may retain earlier naming, as classified in the TASK-030 audit report.
