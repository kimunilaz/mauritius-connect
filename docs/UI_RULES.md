# Mauritius Rental Platform — UI and UX Rules

## 1. Purpose

This document defines the user interface and user experience rules for the Mauritius Rental Platform.

Codex must use these rules when building frontend functionality.

The goal is to create a product that feels:

* trustworthy
* simple
* modern
* mobile-first
* easy to understand
* consistent
* practical

The UI should reduce friction in the rental process rather than add visual complexity.

---

# 2. Primary UX Principle

Every screen should answer:

> What is the main thing the user needs to do here?

Avoid screens with too many competing actions.

Primary actions should be obvious.

Secondary actions should remain available without distracting from the main task.

---

# 3. Mobile-First

Design mobile layouts first.

Then adapt to larger screens.

Primary workflows must work well on phones:

```text
Register
Login
Search
View property
Save property
Apply
Track application
Review applications
Confirm viewing
Send message
```

Do not design desktop-only workflows and attempt to shrink them later.

---

# 4. Target Viewports

Test at minimum:

```text
Mobile:
320px+
375px
390px
430px

Tablet:
768px+

Desktop:
1024px+
1280px+
1440px+
```

No critical action should disappear or become unusable at smaller widths.

---

# 5. Overall Visual Direction

Use:

* clean layouts
* generous spacing
* readable typography
* clear cards
* restrained use of borders
* obvious status indicators
* strong visual hierarchy

Avoid:

* excessive gradients
* unnecessary animation
* overly decorative interfaces
* dense dashboards
* flashy startup aesthetics
* excessive icons
* visual clutter

The platform handles housing decisions.

Trust and clarity matter more than novelty.

---

# 6. Design System

Create reusable design tokens.

Recommended areas:

```text
colors
spacing
font sizes
border radius
shadows
breakpoints
component sizes
```

Prefer CSS variables.

Example:

```css
:root {
  --spacing-xs: 0.25rem;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --spacing-xl: 2rem;

  --radius-sm: 0.375rem;
  --radius-md: 0.625rem;
  --radius-lg: 1rem;
}
```

Codex should not introduce random spacing values throughout components without reason.

---

# 7. Color Rules

Use a restrained palette.

Required semantic categories:

```text
Primary
Success
Warning
Error
Neutral
Background
Surface
Text
Muted text
Border
```

Do not communicate status using color alone.

Example:

Bad:

```text
green dot
```

Better:

```text
✓ Accepted
```

with both text and visual styling.

---

# 8. Typography

Use one primary sans-serif font family.

Prefer system-safe or easily hosted fonts.

Typography hierarchy should include:

```text
Page title
Section title
Card title
Body
Small body
Label
Caption
```

Avoid using many font sizes with tiny differences.

Readable text is more important than visual experimentation.

---

# 9. Page Width

Public and dashboard content should use sensible maximum widths.

Avoid text stretching across extremely wide displays.

Recommended layout concept:

```text
Full-width shell
    ↓
Centered content container
    ↓
Page content
```

Search pages may use wider layouts where cards/maps require space.

---

# 10. Navigation

The interface should clearly separate:

```text
Public
Tenant
Landlord
Admin
```

Navigation must reflect the authenticated role.

---

# 11. Public Navigation

Recommended:

```text
Logo

Search Homes
How It Works
Safety

Login
Sign Up
```

Do not expose landlord/admin management links publicly.

---

# 12. Tenant Navigation

Recommended primary navigation:

```text
Search
Applications
Saved
Viewings
Messages
```

Secondary:

```text
Notifications
Profile
Logout
```

Mobile may use a bottom navigation for the most common tenant actions if testing shows it improves usability.

---

# 13. Landlord Navigation

Recommended:

```text
Dashboard
Properties
Listings
Applications
Viewings
Messages
```

Secondary:

```text
Notifications
Profile
Logout
```

---

# 14. Admin Navigation

Recommended:

```text
Overview
Users
Listings
Reports
Verifications
```

Admin UI should remain functionally simple.

It is an internal tool, not a marketing interface.

---

# 15. Home Page

The homepage should quickly communicate:

1. what the platform does
2. who it is for
3. how to start searching
4. how landlords list properties

Recommended hero structure:

```text
Clear headline
Short supporting text
Location/search input
Primary CTA
Secondary landlord CTA
```

Avoid vague headlines such as:

> The future of property is here.

Prefer direct language such as:

> Find rental homes and apply directly to landlords.

Final marketing wording can change after user testing.

---

# 16. Search Experience

Search is a primary product surface.

The search page should include:

```text
Search/location input
Filters
Sort
Results count
Property cards
Pagination
```

On mobile:

Filters should use:

```text
Filter button
    ↓
Drawer / sheet / modal
```

rather than taking most of the screen permanently.

---

# 17. Search Filter Behavior

Important filters:

```text
Location
Min rent
Max rent
Bedrooms
Bathrooms
Property type
Furnished
Available from
Lease duration
Pets
Parking
```

Users should be able to:

```text
Apply filters
Clear filters
See active filters
```

Filter changes should remain understandable in the URL according to API/product architecture.

---

# 18. Currency Display

V1 default currency:

```text
Mauritian Rupees
```

Display examples consistently:

```text
Rs 18,000/month
Rs 25,000/month
```

Do not alternate between:

```text
MUR 18000
Rs18k
18,000 MUR
```

on different screens unless context specifically requires it.

---

# 19. Property Cards

A property card should contain only the information required for fast comparison.

Recommended:

```text
Cover image
Title
Location
Monthly rent
Bedrooms
Bathrooms
Property type/furnished indicator
Availability
Save button
```

Avoid putting the full description inside the card.

---

# 20. Property Card Interaction

The entire relevant card area may open the listing.

Save action must remain independently clickable.

Avoid accidental navigation when pressing:

```text
Save
```

---

# 21. Property Details Page

Recommended content order:

```text
Images

Title
Location
Monthly rent

Key property facts

Availability / lease information

Description

Application requirements

Landlord trust indicators

Primary Apply button

Report listing
```

On mobile, consider a persistent bottom action area:

```text
Rs 18,000/month          Apply
```

if usability testing supports it.

---

# 22. Property Images

Use:

* cover image
* image gallery
* clear next/previous controls
* mobile swipe support where practical

Images should preserve aspect ratio.

Avoid stretching.

Use optimized image sizes rather than downloading unnecessarily huge originals.

---

# 23. Address Privacy

Public property UI should show approved approximate location information.

Example:

```text
Belle Rose, Quatre Bornes
```

Do not accidentally display private exact address fields.

The frontend must consume public-safe API fields rather than reconstructing private location data.

---

# 24. Trust Indicators

Examples:

```text
Email verified
Phone verified
Landlord identity reviewed
Property information reviewed
```

Only display indicators provided by approved verification workflows.

Do not create a generic:

```text
Trusted landlord
```

badge without defined meaning.

---

# 25. Application CTA

For active listings:

Primary action:

```text
Apply
```

If tenant already has an application:

Replace with:

```text
View application
```

Do not encourage duplicate applications.

---

# 26. Application Form

Rental application should feel structured and manageable.

Recommended sections:

```text
Your rental details

Landlord questions

Short introduction

Review
```

Do not show one extremely long unstructured form if step grouping improves clarity.

---

# 27. Draft Saving

Application form should clearly communicate draft behavior.

Example:

```text
Saved as draft
```

Where practical, preserve user's progress.

Do not imply submission has occurred before the user explicitly submits.

---

# 28. Application Review Screen

Before submission, show:

```text
Property
Move-in date
Lease duration
Occupants
Application answers
Introduction
```

Primary action:

```text
Submit application
```

Submission should be deliberate.

---

# 29. Submission Confirmation

After successful application:

Show a clear confirmation.

Example:

```text
Application submitted

The landlord can now review your application.
You can track progress from My Applications.
```

Provide:

```text
View application
Back to search
```

Do not leave users wondering whether submission succeeded.

---

# 30. Tenant Applications Page

Display applications using understandable statuses.

Each card should show:

```text
Property
Location
Rent
Submitted date
Current status
Next action where applicable
```

---

# 31. Application Status Language

Backend states may be:

```text
UNDER_REVIEW
VIEWING_INVITED
```

Frontend should display human-readable text:

```text
Under review
Viewing invited
```

Do not expose raw database enum formatting unnecessarily.

---

# 32. Status Timeline

Application details should show progress chronologically where useful.

Example:

```text
✓ Submitted
✓ Under review
✓ Shortlisted
● Viewing invited
○ Viewing completed
○ Decision
```

Do not imply future steps are guaranteed.

---

# 33. Rejection Experience

If rejected, communicate clearly and respectfully.

Example:

```text
Application not selected

This listing is no longer progressing with your application.
```

Do not generate speculative reasons unless the landlord/system explicitly provided one approved for display.

---

# 34. Withdrawal

Tenant should have:

```text
Withdraw application
```

only when allowed by workflow.

This is a destructive workflow action and should require confirmation.

Example:

```text
Are you sure you want to withdraw this application?
```

---

# 35. Landlord Dashboard

Dashboard should answer:

```text
What requires my attention?
```

Recommended summary:

```text
Active listings
New applications
Upcoming viewings
Unread messages
```

Then:

```text
Recent applications
Upcoming viewings
```

Avoid filling dashboard with low-value analytics.

---

# 36. Landlord Property List

Each property should show:

```text
Cover image
Property name/location
Listing state
Applications where applicable
Actions
```

Actions might include:

```text
View
Edit
Create listing
Manage listing
Archive
```

Only show valid actions.

---

# 37. Create Property Form

Organize into sections:

```text
Property basics

Location

Features

Photos
```

Avoid asking rental-specific information such as:

```text
monthly rent
available date
```

inside physical property creation.

Those belong to listings.

---

# 38. Listing Form

Organize into:

```text
Listing details
Pricing
Availability
Rental conditions
Application questions
Review
```

Property physical details should generally come from the selected property rather than being duplicated.

---

# 39. Applicant Pipeline

The landlord applicant workflow is a core differentiator.

Desktop may use:

```text
Kanban-style columns
```

such as:

```text
Submitted
Under Review
Shortlisted
Viewing
Decision
```

Mobile should not force horizontal desktop Kanban behavior if it becomes difficult to use.

A mobile alternative may use:

```text
status tabs
+
vertical application cards
```

---

# 40. Applicant Card

Recommended information:

```text
Applicant name
Occupation/student status
Move-in date
Lease duration
Occupants
Current status
Submitted date
```

Do not display unnecessary private information.

Primary action:

```text
View application
```

---

# 41. Applicant Detail Page

Recommended:

```text
Applicant summary

Rental requirements

Application responses

Application timeline

Viewing information

Messages

Status actions
```

Do not create automatic suitability scores.

---

# 42. Applicant Actions

Only show valid next actions based on current state.

Example:

If:

```text
SUBMITTED
```

show:

```text
Start review
Reject
```

If:

```text
UNDER_REVIEW
```

show:

```text
Shortlist
Reject
```

If:

```text
VIEWING_COMPLETED
```

show:

```text
Accept
Reject
```

Backend remains authoritative.

---

# 43. Acceptance Confirmation

Accepting an applicant affects the entire listing.

Require strong confirmation.

Example:

```text
Accept this application?

This will mark the listing as rented and close the remaining active applications.
```

Button:

```text
Accept applicant
```

Use a clear destructive/important-action style.

---

# 44. Viewing UI

Viewing cards should show:

```text
Property
Applicant/landlord
Date
Time
Status
Location instructions where allowed
```

Tenant actions:

```text
Confirm
Decline
```

Landlord actions:

```text
Cancel
Complete
No-show
```

only when valid.

---

# 45. Date and Time Display

Store timestamps with timezone in backend/database.

Frontend should display them clearly.

Example:

```text
Saturday, 12 September
10:00 AM
```

Avoid raw ISO strings:

```text
2026-09-12T10:00:00+04:00
```

in normal UI.

---

# 46. Messaging Layout

Desktop:

```text
Conversation list
+
Active conversation
```

Mobile:

```text
Conversation list
→ open conversation
```

Do not squeeze both panes onto a narrow phone screen.

---

# 47. Message Design

Messages should show:

```text
message content
time
sender distinction
```

Do not visually overcomplicate chat bubbles.

V1 messaging is functional communication, not a social network.

---

# 48. Notifications

Notifications should identify:

```text
What happened?
What does it relate to?
When?
```

Example:

```text
New application

Someone submitted an application for your Moka apartment.

5 min ago
```

Notification click should open the relevant object where safe.

---

# 49. Empty States

Never leave empty screens unexplained.

Tenant example:

```text
No applications yet

When you apply for a property, you can track it here.

Browse properties
```

Landlord example:

```text
No properties yet

Add your first property to create a rental listing.

Add property
```

---

# 50. Loading States

Use clear loading states.

Examples:

```text
Skeleton cards
Loading indicator
Disabled submit button
```

Avoid blank pages while data loads.

Do not repeatedly show full-screen spinners for small updates.

---

# 51. Error States

Errors should explain:

```text
What failed?
What can the user do?
```

Example:

```text
We couldn't load this listing.

Try again.
```

Form errors should appear close to the relevant input.

---

# 52. Network Errors

If an API request fails because connectivity is unavailable:

Do not silently discard user input.

Where practical:

```text
preserve form state
show retry action
```

This matters for mobile users.

---

# 53. Form Validation

Use immediate validation where helpful, but avoid aggressively showing errors before users interact with fields.

Show clear messages.

Bad:

```text
Invalid input
```

Better:

```text
Monthly rent cannot be negative.
```

---

# 54. Required Fields

Clearly indicate required fields.

Do not make users guess.

Use consistent convention such as:

```text
Monthly rent *
```

and explanatory text when appropriate.

---

# 55. Destructive Actions

Require confirmation for high-impact actions.

Examples:

```text
Withdraw application
Archive property
Close listing
Reject applicant where irreversible
Accept applicant
Suspend user
Remove listing
```

Do not require confirmation for harmless reversible actions such as:

```text
Save listing
Mark notification read
```

---

# 56. Buttons

Use a consistent hierarchy.

## Primary

One main action.

Examples:

```text
Apply
Create listing
Submit application
```

## Secondary

Supporting action.

Examples:

```text
Save draft
Edit
Cancel
```

## Destructive

Examples:

```text
Reject
Archive
Remove
Suspend
```

Avoid multiple equally prominent primary buttons in one small area.

---

# 57. Button Labels

Use verbs describing the action.

Good:

```text
Create property
Submit application
Confirm viewing
```

Avoid vague:

```text
Continue
Proceed
Submit
```

when a more precise label is possible.

---

# 58. Icons

Icons may support text.

Do not rely on ambiguous icons alone for important actions.

Example:

Prefer:

```text
♡ Save
```

or an accessible-label save control.

Not an unexplained icon with no accessible name.

---

# 59. Cards

Use cards for:

* property listings
* applications
* viewings
* notifications

Avoid using cards around every piece of text merely for decoration.

---

# 60. Tables

Use tables primarily for admin or dense desktop data.

Tables must remain responsive.

For tenant/landlord primary mobile workflows, cards are usually preferable.

---

# 61. Modals

Use modals for:

* confirmation
* small focused actions

Do not put complex multi-step forms inside small modals.

Complex tasks should use full pages or appropriate responsive flows.

---

# 62. Toasts

Use temporary toast notifications for small success actions.

Examples:

```text
Listing saved
Profile updated
Message sent
```

Do not use toast-only feedback for important events such as:

```text
Application submitted
Applicant accepted
```

Those deserve persistent confirmation.

---

# 63. Accessibility

Use semantic HTML.

Requirements include:

* `<button>` for buttons
* `<label>` for form inputs
* proper headings
* meaningful alt text
* keyboard navigation
* visible focus styles
* accessible modal focus handling

Avoid clickable `<div>` elements when semantic elements exist.

---

# 64. Keyboard Navigation

Users must be able to navigate important desktop workflows using keyboard controls.

Focus order should follow visual order.

Do not hide focus indicators.

---

# 65. Images and Alt Text

Property images should have meaningful alt text when practical.

Example:

```text
Living room of 2-bedroom apartment in Moka
```

Decorative images may use empty alt text.

---

# 66. Status Accessibility

Statuses require text.

Example:

```text
Accepted
```

not merely green.

```text
Rejected
```

not merely red.

---

# 67. Responsive Forms

Mobile forms should generally use:

```text
single-column layout
```

Desktop may use two columns for logically related short fields.

Do not make users horizontally scroll forms.

---

# 68. Input Types

Use correct HTML input types.

Examples:

```text
email
tel
date
number
```

This improves mobile keyboard behavior.

---

# 69. Numeric Input

For rent:

```text
Rs
[ 18000 ]
```

Avoid sliders for important financial amounts where precise entry matters.

---

# 70. Search Location Input

V1 may start with structured location selection.

Prefer known Mauritius locations over unrestricted inconsistent spelling where possible.

Example hierarchy:

```text
District
Locality
Neighbourhood
```

Future autocomplete/map functionality may improve this.

---

# 71. Loading More Results

Use standard pagination in V1 unless product testing strongly supports infinite scrolling.

Pagination is easier for:

* debugging
* URL state
* predictable API usage

---

# 72. Application Privacy

Landlord-facing applicant screens should show only fields required for rental review.

Do not display hidden/internal user information.

Tenant profiles should not become publicly searchable.

---

# 73. Admin UI

Admin interface should prioritize:

```text
clarity
speed
auditability
```

over consumer visual polish.

Admin destructive operations should request reason where relevant.

---

# 74. Report Interface

Report flow:

```text
Report
  ↓
Reason
  ↓
Optional explanation
  ↓
Submit
```

Do not expose moderation outcome details unnecessarily to unrelated users.

---

# 75. Safety Content

Provide a public:

```text
/safety
```

page.

Potential topics:

* view properties before making commitments
* protect personal information
* report suspicious listings
* communicate safely
* understand what platform verification means

Do not imply guarantees beyond platform capabilities.

---

# 76. Privacy Copy

Where collecting personal information, explain why when context may not be obvious.

Example:

```text
Number of occupants

This helps the landlord understand who would live in the property.
```

---

# 77. No Dark Patterns

Do not:

* hide important actions
* make account withdrawal deliberately difficult
* preselect consent unnecessarily
* disguise ads as listings
* create fake urgency
* use misleading verification claims

---

# 78. No Artificial Scarcity

Do not display:

```text
Only 1 spot left!
27 people viewing now!
```

unless the information is genuine, measured, and useful.

Do not manufacture pressure around housing decisions.

---

# 79. Platform Neutrality in UI

Avoid language suggesting the platform made a rental decision.

Do not say:

```text
We rejected your application.
```

if the landlord rejected it.

Prefer:

```text
The landlord is not progressing with this application.
```

Likewise:

```text
Your application was accepted by the landlord.
```

---

# 80. No Tenant Ranking UI

Do not build:

```text
Best applicant
95% match
Top tenant
Recommended tenant
```

during V1.

Applicant ordering may use neutral criteria such as:

```text
submission date
current status
move-in date
```

if needed.

---

# 81. Location Naming Consistency

Use standardized Mauritius location names throughout UI.

Avoid situations where one screen displays:

```text
Quatre-Bornes
```

another:

```text
Quatre Bornes
```

and another:

```text
QB
```

unless abbreviation is deliberate.

---

# 82. Content Tone

Interface writing should be:

* direct
* calm
* respectful
* clear

Avoid overly corporate language.

Example:

Better:

```text
Your application was submitted.
```

Than:

```text
Your application request has been successfully initialized within our system.
```

---

# 83. Error Tone

Avoid blaming the user.

Example:

```text
Enter a valid move-in date.
```

rather than:

```text
You entered the date incorrectly.
```

---

# 84. Consistent Terminology

Use consistently:

```text
Tenant
Landlord
Property
Listing
Application
Viewing
Message
```

Do not randomly alternate:

```text
tenant / renter / applicant / customer
```

within the same workflow unless context requires the distinction.

A tenant becomes an:

```text
applicant
```

within a specific application context.

---

# 85. Property vs Listing UI

Maintain conceptual distinction.

```text
Property
```

is the physical asset.

```text
Listing
```

is the current rental advertisement.

Landlord dashboard should make this understandable.

---

# 86. Responsive Applicant Pipeline

Desktop:

A Kanban pipeline may be used.

Mobile:

Prefer:

```text
Status tabs
+
vertical list
```

if Kanban becomes difficult to operate.

Do not force identical desktop interaction onto mobile.

---

# 87. Search Empty State

Example:

```text
No properties match these filters.

Try increasing your budget or changing the location.

Clear filters
```

Do not display an empty blank area.

---

# 88. Search Results Count

Where useful show:

```text
24 properties
```

or:

```text
24 properties in Moka
```

This helps users understand filter impact.

---

# 89. Draft vs Submitted

Draft applications should have a clearly distinct visual state.

Example:

```text
Draft
```

and CTA:

```text
Continue application
```

Submitted:

```text
Submitted
```

with:

```text
View application
```

---

# 90. Optimistic UI

Optimistic updates may be used for low-risk reversible actions such as:

```text
save listing
mark notification read
```

Do not optimistically display high-impact workflow success such as:

```text
tenant accepted
application submitted
listing rented
```

until backend confirmation succeeds.

---

# 91. Loading During Submission

High-impact submit buttons should prevent duplicate clicks while request is in progress.

Example:

```text
Submitting...
```

Disable repeated submissions until response arrives.

---

# 92. Responsive Images

Use appropriately sized images.

Do not send extremely large originals to small cards if optimized versions become available.

Lazy-load off-screen listing images where practical.

---

# 93. Skeleton Loading

Search cards may use skeletons while loading.

This is preferable to large layout shifts.

Do not overuse animation.

---

# 94. Design Consistency Rule

Before creating a new UI pattern, Codex must check whether an existing component can be reused.

Do not create:

```text
PrimaryButton
BlueButton
SubmitButton
MainButton
```

as four unrelated implementations of the same concept.

---

# 95. Component Reuse Rule

Create reusable components where repetition exists.

But avoid premature generic abstraction.

A component should solve a clear recurring UI need.

---

# 96. UI State Coverage

Every major screen should intentionally handle:

```text
loading
success
empty
error
permission denied where relevant
```

Do not build only the happy state.

---

# 97. Manual UX Testing

For important workflows, human testing should verify:

* Can first-time user understand the screen?
* Is main action obvious?
* Can workflow be completed on phone?
* Are errors understandable?
* Is anything important hidden?
* Does terminology make sense?

Automated frontend tests do not replace actual usability testing.

---

# 98. Codex UI Rule

Codex should prioritize:

```text
functionality
consistency
accessibility
responsiveness
```

before decorative polish.

When uncertain, use the simplest interface that clearly supports the workflow.

---

# 99. V1 UI Non-Goals

Do not spend significant V1 time building:

```text
complex animations
3D interfaces
social feeds
gamification
highly customized maps
native-app-specific patterns
AI chat interface
tenant scoring visualizations
```

unless later product evidence justifies them.

---

# 100. Final UI Principle

The interface should make the rental process feel:

> structured, transparent, understandable, and easy to manage.

Every design decision should support one of those outcomes.
