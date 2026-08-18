# Mauritius Rental Platform — Development Roadmap

## 1. Purpose

This roadmap defines the approved implementation order for the Mauritius Rental Platform.

Codex is the primary coding agent.

The purpose of this roadmap is to ensure that:

* features are built in the correct dependency order
* Codex works on bounded tasks
* architecture remains stable
* testing happens continuously
* security is not postponed until the end
* marketplace validation happens alongside development
* the team can determine when the product is ready for private beta and public launch

Codex must not treat this roadmap as permission to build every phase automatically.

Only the task defined in:

```text
tasks/CURRENT_TASK.md
```

should normally be implemented at one time.

---

# 2. Development Philosophy

The project should follow:

```text
Specification
      ↓
Foundation
      ↓
Core Marketplace
      ↓
Application Workflow
      ↓
Communication
      ↓
Trust & Administration
      ↓
Security Hardening
      ↓
Private Beta
      ↓
Public Launch
```

The priority is not maximum feature count.

The priority is a reliable rental workflow that real landlords and tenants can use.

---

# 3. Development Phases

The approved high-level phases are:

```text
Phase 0   Project Bootstrap
Phase 1   Database Foundation
Phase 2   Authentication & Authorization
Phase 3   User Profiles
Phase 4   Property Management
Phase 5   Listing Management
Phase 6   Search & Discovery
Phase 7   Saved Listings
Phase 8   Application Questions
Phase 9   Rental Applications
Phase 10  Landlord Applicant Pipeline
Phase 11  Application State Engine
Phase 12  Viewing Management
Phase 13  Messaging
Phase 14  Notifications
Phase 15  Reporting & Safety
Phase 16  Administration
Phase 17  Verification
Phase 18  Security Hardening
Phase 19  End-to-End Testing
Phase 20  Production Infrastructure
Phase 21  Private Beta
Phase 22  Beta Improvements
Phase 23  Public Launch
```

---

# 4. Phase 0 — Project Bootstrap

## Objective

Create the technical foundation without implementing product features.

## Codex Tasks

Set up:

```text
frontend/
backend/
database/
docs/
tasks/
python-services/
```

Configure frontend:

```text
React
Vite
JavaScript
React Router
ESLint
Prettier
```

Configure backend:

```text
Node.js
Express
ESLint
Prettier
environment configuration
centralized error handling
base routing
request logging
```

Configure testing foundations.

Create:

```text
.env.example
.gitignore
README.md
```

Configure package scripts.

Example desired commands:

```bash
npm install
npm run dev
npm run test
npm run lint
npm run build
```

Exact monorepo scripts may vary according to implementation.

## Do Not Build

Do not implement:

* properties
* listings
* applications
* messaging
* viewings
* admin features

during bootstrap.

## Acceptance Criteria

* frontend starts successfully
* backend starts successfully
* React can call a basic backend health endpoint
* linting works
* test framework works
* environment variables are documented
* no secrets committed

---

# 5. Phase 1 — Database Foundation

## Objective

Implement the approved PostgreSQL schema.

## Codex Tasks

Create migrations for:

```text
profiles
tenant_profiles
tenant_preferred_locations
landlord_profiles

properties
property_images
listings
saved_listings

application_questions
application_question_options
applications
application_answers
application_status_history

viewings

conversations
conversation_participants
messages

notifications

reports
verification_records
admin_audit_logs
```

Create:

* foreign keys
* CHECK constraints
* unique constraints
* partial unique indexes
* timestamps
* updated_at mechanism
* relevant indexes

## Critical Database Rules

Implement:

```text
one application per tenant/listing
one accepted applicant per listing
one live listing per property
one cover image per property
```

## Seed Data

Prepare development seed data for:

* Tenant A
* Tenant B
* Landlord A
* Landlord B
* Admin A
* sample properties
* sample listings
* sample applications

## Acceptance Criteria

* migrations apply to clean database
* migrations can be reproduced
* constraints work
* seed data loads
* tests verify critical constraints

---

# 6. Phase 2 — Authentication & Authorization

## Objective

Establish secure platform identities and roles.

## Codex Tasks

Integrate:

```text
Supabase Auth
```

Implement:

* signup
* email verification flow
* login
* logout
* password reset
* application profile bootstrap
* authenticated user resolution
* protected backend routes

Roles:

```text
TENANT
LANDLORD
ADMIN
```

Implement middleware:

```text
authenticateUser
requireRole
requireActiveAccount
```

## Security Requirements

Public signup may create:

```text
TENANT
LANDLORD
```

Public signup may not create:

```text
ADMIN
```

## Acceptance Criteria

* tenant can register/login
* landlord can register/login
* admin cannot be self-created
* invalid token rejected
* unauthenticated protected requests rejected
* wrong roles rejected
* suspended users blocked

---

# 7. Phase 3 — User Profiles

## Objective

Allow tenants and landlords to complete platform profiles.

## Tenant Profile

Implement:

* occupation type
* employer/school
* income range
* preferred move date
* preferred lease duration
* number of occupants
* pets
* bio
* preferred locations

## Landlord Profile

Implement:

* contact profile
* verification status display

Landlord must not edit verification status.

## Acceptance Criteria

* users can update own profiles
* users cannot update another user's profile
* role-specific endpoints enforced
* validation works
* preferred locations stored relationally

---

# 8. Phase 4 — Property Management

## Objective

Allow landlords to manage physical properties.

## Codex Tasks

Implement:

```text
Create property
View own properties
View property
Edit property
Archive property
Upload images
Delete image
Reorder images
Set cover image
```

## Property Fields

Include:

* property type
* address
* district
* locality
* neighbourhood
* coordinates
* bedrooms
* bathrooms
* furnished
* parking

## Security

Only property owner may manage property.

Exact address must remain private from public APIs.

## Acceptance Criteria

* landlord creates property
* tenant cannot create property
* Landlord A cannot modify Landlord B property
* image validation works
* one cover image enforced
* archive behavior works

---

# 9. Phase 5 — Listing Management

## Objective

Allow landlords to create rental offers for properties.

## Codex Tasks

Implement:

```text
Create listing
Edit listing
Publish listing
Pause listing
Reactivate listing
Close listing
Mark listing rented through approved workflow
```

## Listing States

```text
DRAFT
PENDING_REVIEW
ACTIVE
PAUSED
RENTED
CLOSED
```

## Critical Rule

One property may have only one live rental cycle at a time.

## Acceptance Criteria

* listing created for landlord-owned property
* unauthorized property rejected
* duplicate live listing prevented
* valid transitions accepted
* invalid transitions rejected
* historical listings preserved

---

# 10. Phase 6 — Search & Discovery

## Objective

Create the tenant-facing property marketplace.

## Public Pages

Implement:

```text
/
 /search
 /property/:listingId
```

## Filters

Support:

* district
* locality
* neighbourhood
* minimum rent
* maximum rent
* bedrooms
* bathrooms
* property type
* furnished
* availability
* minimum lease
* pets
* parking

## Sorting

Support:

```text
NEWEST
RENT_LOW_TO_HIGH
RENT_HIGH_TO_LOW
AVAILABLE_SOONEST
```

## Requirements

Search parameters must persist in the URL.

Example:

```text
/search?locality=Moka&max_rent=20000&bedrooms=2
```

## Privacy

Public responses must not expose:

* exact private address
* tenant information
* private landlord information
* moderation information
* verification evidence

## Acceptance Criteria

* active listings searchable
* inactive listings hidden
* combined filters work
* sorting works
* pagination works
* mobile interface usable

---

# 11. Phase 7 — Saved Listings

## Objective

Allow tenants to bookmark rental listings.

## Codex Tasks

Implement:

```text
Save listing
Remove saved listing
View saved listings
```

## Requirements

Saving should be idempotent.

Tenant may only manage own saves.

## Acceptance Criteria

* save works
* duplicate saves do not create duplicates
* remove works
* Tenant A cannot change Tenant B saved records

---

# 12. Phase 8 — Application Questions

## Objective

Allow landlords to customize their rental application form.

## Question Types

```text
TEXT
NUMBER
BOOLEAN
DATE
SELECT
```

For SELECT:

Support configurable options.

## Codex Tasks

Implement:

```text
Create question
Edit question
Delete question
Reorder question
Set required status
Manage select options
```

## Historical Integrity Rule

Once a listing has a submitted application:

Existing questions must not be destructively modified or removed.

## Acceptance Criteria

* landlord manages own listing questions
* another landlord cannot change them
* question types validated
* submitted application locks historical questions appropriately

---

# 13. Phase 9 — Rental Applications

## Objective

Allow tenants to submit structured applications.

This is a core product phase.

## Tenant Flow

```text
Open listing
   ↓
Apply
   ↓
Create draft
   ↓
Complete standard fields
   ↓
Answer custom questions
   ↓
Submit
```

## Standard Fields

Include:

* move-in date
* requested lease duration
* occupants
* introductory message

## Application States Initially Used

```text
DRAFT
SUBMITTED
```

## Rules

* listing must be ACTIVE
* tenant may have one application per listing
* required questions must be answered
* draft can be edited
* submitted application becomes controlled workflow data

## Acceptance Criteria

* tenant creates draft
* tenant saves answers
* submission validates completeness
* duplicate application blocked
* landlord cannot apply
* application history entry created
* landlord notification created

---

# 14. Phase 10 — Landlord Applicant Pipeline

## Objective

Give landlords a structured way to manage applications.

This is one of the most important product experiences.

## Dashboard

Recommended pipeline:

```text
Submitted
Under Review
Shortlisted
Viewing
Accepted
Rejected
```

## Landlord Can

* view applications for own listings
* open applicant details
* inspect application responses
* change valid review status
* reject application
* shortlist applicant

## Landlord Cannot

* see applications for another landlord
* modify tenant profile information
* arbitrarily skip controlled state rules

## Acceptance Criteria

* landlord sees only own applicants
* filtering by listing/status works
* application details render correctly
* tenant privacy boundaries respected

---

# 15. Phase 11 — Application State Engine

## Objective

Centralize and enforce application lifecycle rules.

## Approved States

```text
DRAFT
SUBMITTED
UNDER_REVIEW
SHORTLISTED
VIEWING_INVITED
VIEWING_COMPLETED
ACCEPTED
REJECTED
WITHDRAWN
```

## Codex Tasks

Create centralized transition rules.

Do not scatter transition logic across controllers.

Example:

```text
applicationStateMachine
```

or equivalent service abstraction.

## Requirements

Every transition verifies:

* current state
* requested state
* actor
* actor role
* ownership
* business rules

Every successful state transition records history.

## Acceptance Criteria

* all approved transitions tested
* invalid transitions tested
* actor permissions tested
* history records created atomically

---

# 16. Phase 12 — Viewing Management

## Objective

Move viewing coordination into the platform.

## Landlord Can

* propose viewing
* cancel viewing
* mark completed
* mark no-show

## Tenant Can

* confirm viewing
* decline viewing
* cancel where allowed

## States

```text
PROPOSED
CONFIRMED
DECLINED
COMPLETED
CANCELLED
NO_SHOW
```

## Requirements

Multiple viewings per application must be supported.

## Acceptance Criteria

* correct tenant receives invitation
* wrong tenant denied
* correct landlord controls listing viewing
* multiple viewing records supported
* viewing completion updates application state appropriately

---

# 17. Phase 13 — Messaging

## Objective

Allow structured landlord/tenant communication without attempting to replicate WhatsApp.

## V1 Scope

Support:

```text
Text messages
Conversation history
Read state
Timestamps
```

Do not support:

```text
audio
video
calls
attachments
HTML
URL previews
```

## Requirements

Conversation tied to:

* listing
* tenant
* landlord

Only participants may access messages.

## Acceptance Criteria

* conversation creation idempotent
* participant sends message
* non-participant denied
* read state works
* user HTML/script text rendered safely
* pagination/message history controlled

---

# 18. Phase 14 — Notifications

## Objective

Create in-app alerts for meaningful workflow events.

## Events

Include:

```text
APPLICATION_RECEIVED
APPLICATION_SHORTLISTED
APPLICATION_REJECTED
APPLICATION_ACCEPTED
VIEWING_PROPOSED
VIEWING_CONFIRMED
MESSAGE_RECEIVED
```

## Codex Tasks

Implement:

```text
notification list
unread state
mark one read
mark all read
```

Email notification delivery may be added later.

## Acceptance Criteria

* correct recipient notified
* users see own notifications only
* read state works
* workflow operations do not fail merely because optional notification display fails

---

# 19. Phase 15 — Reporting & Safety

## Objective

Allow users to report suspicious listings or behavior.

## Report Types

```text
FAKE_LISTING
INCORRECT_INFORMATION
PROPERTY_UNAVAILABLE
DUPLICATE_LISTING
SUSPICIOUS_LANDLORD
SUSPICIOUS_TENANT
HARASSMENT
OTHER
```

## Codex Tasks

Implement:

* report listing
* report user
* report status
* admin moderation queue foundation

## Acceptance Criteria

* valid reports stored
* invalid target rejected
* reporting abuse rate limited
* reporter cannot resolve own report

---

# 20. Phase 16 — Administration

## Objective

Give internal platform staff necessary moderation capabilities.

## Admin Features

Implement:

```text
User list
User details
Suspend user
Restore user

Listing moderation
Listing removal

Report queue
Report resolution

Verification queue

Basic analytics
```

## Audit Logging

Important actions must create:

```text
admin_audit_logs
```

## Admin Must Not

* choose tenants
* negotiate rent
* alter applications to favor either party
* act as rental agent

## Acceptance Criteria

* only ADMIN accesses admin API
* tenant/landlord denied
* audit logs created
* suspended users blocked from normal operations

---

# 21. Phase 17 — Verification

## Objective

Introduce simple trust signals without creating unnecessary sensitive-data infrastructure.

## Initial Verification

Consider:

```text
Email verified
Phone verified
Landlord identity reviewed
Property information reviewed
```

## Important Product Rule

Never display a generic badge that implies more than was actually verified.

## V1 Restrictions

Do not yet create compulsory storage for:

* passports
* bank statements
* payslips
* credit reports
* background checks

unless project scope is formally revised.

## Acceptance Criteria

* user cannot self-verify
* landlord cannot self-verify property
* admin verification workflow protected
* verification evidence not publicly exposed
* precise verification label displayed

---

# 22. Phase 18 — Security Hardening

## Objective

Attack the system intentionally before real users depend on it.

## Codex Security Task

Codex should perform a focused security review covering:

```text
broken object-level authorization
role escalation
mass assignment
RLS policy mistakes
invalid tokens
suspended accounts
SQL injection
XSS
malicious uploads
unbounded requests
message abuse
private data exposure
admin access
```

## Mandatory Cross-User Tests

Test:

```text
Landlord A vs Landlord B
Tenant A vs Tenant B
Tenant vs landlord
ordinary user vs admin
conversation participant vs outsider
```

## Acceptance Criteria

All critical tests in `TESTING.md` pass.

---

# 23. Phase 19 — End-to-End Testing

## Objective

Validate the complete rental workflow.

## Critical Journey

```text
LANDLORD

Register
   ↓
Create profile
   ↓
Create property
   ↓
Upload images
   ↓
Create listing
   ↓
Publish
```

Then:

```text
TENANT

Register
   ↓
Create profile
   ↓
Search
   ↓
Open property
   ↓
Save
   ↓
Apply
   ↓
Submit
```

Then:

```text
LANDLORD

Application received
   ↓
Review
   ↓
Shortlist
   ↓
Invite to viewing
```

Then:

```text
TENANT

Viewing invitation
   ↓
Confirm
```

Then:

```text
LANDLORD

Complete viewing
   ↓
Accept tenant
```

Expected system result:

```text
Application = ACCEPTED
Listing = RENTED
Only one accepted application exists
Other applications handled correctly
```

## Acceptance Criteria

Complete E2E journey passes automatically in a controlled environment.

---

# 24. Phase 20 — Production Infrastructure

## Objective

Prepare the application for controlled deployment.

## Recommended Deployment

Frontend:

```text
Vercel
```

Backend:

```text
Railway / Render / Fly.io
```

Database/Auth/Storage:

```text
Supabase
```

## Infrastructure Tasks

Configure:

* production environment variables
* HTTPS
* CORS
* logging
* Supabase production project
* database migrations
* storage buckets
* RLS
* backups
* CI/CD
* production build
* error handling
* deployment health checks

## Requirement

Development and production must be separated.

---

# 25. Phase 21 — Private Beta

## Objective

Test the product with real landlords and tenants before broad public marketing.

## Initial Beta Goal

Recommended:

```text
10 landlords
20–50 real properties
50–100 tenants
```

This phase should focus on learning rather than scale.

## Observe

* onboarding friction
* listing completion
* tenant search behavior
* application completion
* landlord response behavior
* viewing coordination
* messaging
* mobile usability
* trust concerns
* bugs

---

# 26. Human Responsibilities During Private Beta

The human product team should:

* recruit landlords
* recruit tenants
* watch users use the platform
* collect feedback
* verify whether landlords understand applications
* identify missing fields
* investigate trust concerns
* identify confusing terminology
* manually resolve support problems
* report reproducible bugs to Codex

Codex should not be expected to infer these product insights from code.

---

# 27. Phase 22 — Beta Improvements

## Objective

Fix evidence-based problems discovered during private beta.

Prioritize:

```text
Critical security issue
      ↓
Data integrity issue
      ↓
Core workflow blocker
      ↓
Major usability problem
      ↓
Performance issue
      ↓
Minor UI issue
```

Do not introduce major new feature categories simply because users suggest them.

First determine whether they solve repeated problems.

---

# 28. Bug Priorities

## P0 — Critical

Examples:

* private data exposure
* authentication bypass
* multiple tenants accepted
* database corruption
* admin privilege escalation

Fix before further beta use.

## P1 — High

Examples:

* cannot submit application
* landlord cannot review applicant
* listing cannot publish
* viewing workflow broken

Fix immediately before scaling beta.

## P2 — Medium

Examples:

* confusing navigation
* notification not updating immediately
* inconsistent filters

Schedule promptly.

## P3 — Low

Examples:

* minor visual spacing
* non-blocking wording issue

May wait.

---

# 29. Phase 23 — Public Launch

Public launch should occur only after the release gates in:

```text
docs/TESTING.md
docs/SECURITY.md
```

are satisfied.

The goal should not be maximum registrations.

The goal is marketplace liquidity.

---

# 30. Launch Supply Goal

Before significant tenant acquisition, aim for sufficient active supply.

Initial target:

```text
100 genuine active listings
```

within the initial geographic focus where practical.

Quality matters more than raw count.

---

# 31. Initial Geographic Focus

Prioritize:

```text
Moka
Ébène
Réduit
Rose Hill
Quatre Bornes
```

Do not intentionally spread limited supply thinly across Mauritius at launch.

---

# 32. Landlord Acquisition

Human team should begin landlord outreach before development is fully finished.

Potential channels:

* Facebook rental groups
* university networks
* community contacts
* WhatsApp groups
* rental signs
* direct landlord introductions
* student residences
* employer networks
* referrals

Possible onboarding offer:

> We will help you create your first listing on the platform.

This should be onboarding support, not property management.

---

# 33. Tenant Acquisition

Once supply exists, target:

* university students
* interns
* young professionals
* relocating workers
* families searching in launch areas
* international residents

Channels may include:

* Facebook
* WhatsApp
* Instagram
* TikTok
* university communities
* LinkedIn
* referral networks

---

# 34. Early Marketplace Metrics

Track:

```text
active listings
active landlords
active tenants
property views
saved listings
applications submitted
applications per listing
landlord response rate
viewing invitations
successful rental outcomes
reports
```

---

# 35. Primary Early Metric

Prioritize:

> Percentage of active listings receiving at least one legitimate application.

This measures whether landlords are receiving value.

---

# 36. Liquidity Metric

Track:

> Median time from listing publication to first submitted application.

This gives an early indication of marketplace liquidity.

---

# 37. Application Funnel

Track:

```text
Property viewed
      ↓
Application started
      ↓
Application submitted
      ↓
Under review
      ↓
Shortlisted
      ↓
Viewing
      ↓
Accepted
```

This will reveal where users drop out.

---

# 38. Development Packages for Codex

Each phase should be broken into individual work packages.

Example:

```text
TASK-000 Bootstrap repository

TASK-001 Database base schema

TASK-002 Authentication integration

TASK-003 Authorization middleware

TASK-004 Tenant profile

TASK-005 Landlord profile

TASK-006 Property creation

TASK-007 Property editing/archive

TASK-008 Property images

TASK-009 Listing creation

TASK-010 Listing state management

TASK-011 Public search

TASK-012 Public listing details

TASK-013 Saved listings

TASK-014 Application questions

TASK-015 Draft applications

TASK-016 Application submission

TASK-017 Tenant applications dashboard

TASK-018 Landlord application dashboard

TASK-019 Application state engine

TASK-020 Viewing management

TASK-021 Conversations

TASK-022 Messages

TASK-023 Notifications

TASK-024 Reports

TASK-025 Admin users

TASK-026 Admin listings/reports

TASK-027 Verification

TASK-028 Security review

TASK-029 Core E2E tests

TASK-030 Production deployment
```

These numbers are planning identifiers.

Final task files may split large tasks further.

---

# 39. Task Size Rule

Prefer smaller tasks.

A Codex task should generally be something that can be:

```text
understood
implemented
tested
reviewed
committed
```

as one coherent unit.

Avoid:

```text
TASK: Build the entire landlord system
```

Prefer:

```text
Create property API
```

then:

```text
Create landlord property form
```

then:

```text
Add property image uploads
```

where this division improves reviewability.

---

# 40. Task Dependencies

Tasks should explicitly list dependencies.

Example:

```text
TASK-016 Application Submission

Depends on:
- TASK-014 Application Questions
- TASK-015 Draft Applications
- authentication
- application schema
```

Codex should not implement a task before required dependencies exist.

---

# 41. CURRENT_TASK Workflow

At any point:

```text
tasks/CURRENT_TASK.md
```

contains the active assignment.

Once complete and approved:

Move it to:

```text
tasks/completed/
```

Then copy the next approved task into:

```text
tasks/CURRENT_TASK.md
```

This provides a clear history.

---

# 42. Human Review Checkpoint

After each significant work package:

```text
Codex implements
      ↓
Codex runs tests
      ↓
Codex reports
      ↓
Human reviews
      ↓
Human manually tests where needed
      ↓
Fixes if required
      ↓
Commit/merge
      ↓
Next task
```

Do not let large unreviewed changes accumulate.

---

# 43. Codex Completion Rule

Codex must stop after the assigned task.

It should not automatically begin the next roadmap phase.

Completion report should contain:

```text
Summary
Files changed
Migrations
API changes
Tests added
Tests executed
Results
Security considerations
Known limitations
Documentation changes
```

---

# 44. Parallel Human Work

While Codex develops, human work should continue.

## Product

* landlord interviews
* tenant interviews
* field testing
* terminology decisions
* UX testing

## Marketplace

* landlord acquisition
* tenant waitlist
* launch area research
* property onboarding

## Operations

* Supabase account
* hosting accounts
* domain
* platform email
* support process

## Compliance

* privacy review
* data-controller obligations
* platform terms
* rental-platform regulatory clarification

Development should not block these activities.

---

# 45. Future Features Backlog

Do not implement these during V1 unless formally promoted into roadmap:

```text
rent payments
deposit payments
escrow
digital leases
digital signatures
property management
insurance
native mobile apps
tenant background checks
credit scoring
AI tenant ranking
automatic tenant selection
advanced rental reputation
advanced fraud ML
rental price prediction
```

---

# 46. Future Python Phase

Python/FastAPI may eventually support:

```text
duplicate image detection
duplicate listing detection
fraud indicators
listing quality checks
property recommendations
market analytics
demand forecasting
```

This begins only after sufficient marketplace data and product need exist.

---

# 47. No Premature Microservices

Do not turn future Python ideas into separate services during V1 merely to demonstrate architecture.

The main product remains:

```text
React
   ↓
Node/Express
   ↓
PostgreSQL/Supabase
```

until real technical requirements justify additional services.

---

# 48. Private Beta Definition of Success

Private beta succeeds when real users can complete:

```text
Landlord publishes property
        ↓
Tenant discovers property
        ↓
Tenant submits application
        ↓
Landlord reviews
        ↓
Viewing arranged
        ↓
Rental decision made
```

without the development team manually repairing the workflow.

---

# 49. V1 Definition of Success

V1 is successful when:

* landlords receive useful applications
* tenants find relevant properties
* applications are structured
* landlords can manage applicants
* tenants can track status
* viewings can be organized
* communication works
* platform maintains security and privacy
* real rentals originate through the workflow

Revenue is not required to validate V1.

---

# 50. Final Roadmap Principle

The roadmap should always prioritize:

```text
Correct core workflow
        ↓
Security
        ↓
Marketplace usefulness
        ↓
User experience
        ↓
Scale
        ↓
Additional features
```

The objective is not to build the largest property application.

The objective is to build the most useful structured direct-rental workflow for landlords and tenants in the initial Mauritius market.
