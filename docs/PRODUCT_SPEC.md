# Mauritius Rental Platform — Product Specification

## 1. Product Summary

The Mauritius Rental Platform is a web-based rental application and process management platform for landlords and tenants in Mauritius.

The platform allows landlords to publish rental properties, receive structured rental applications, review applicants, schedule viewings, and communicate with prospective tenants.

Tenants can search for properties, create a reusable rental profile, submit structured applications, track their application status, save properties, communicate with landlords, and manage viewing invitations

The platform does not act as a real estate agent.

It does not negotiate rental terms, collect rent or deposits, select tenants on behalf of landlords, manage properties, or act on behalf of either party.

The platform provides software that helps landlords and tenants manage the rental process directly.

---

## 2. Core Product Principle

The platform organizes the rental process.

The users make the rental decisions.

The product must remain neutral between landlords and tenants.

---

## 3. Core Problem

The rental process in Mauritius is often fragmented across:

- Facebook
- WhatsApp
- phone calls
- informal messages
- property websites
- spreadsheets
- manual applicant tracking

Tenants often repeat the same information to multiple landlords and may have no clear way to track the status of their applications.

Landlords may receive many unstructured messages and have difficulty tracking applicants, scheduling viewings, and managing the overall rental process.

The platform solves this by creating one structured workflow.

---

## 4. Core User Journey

The main product journey is:

Search
→ View Property
→ Apply
→ Review
→ Shortlist
→ Schedule Viewing
→ Communicate
→ Accept / Reject / Withdraw
→ Close Listing

---

## 5. User Types

### Tenant

A tenant can:

- create an account
- create a rental profile
- search rental properties
- filter properties
- view property details
- save listings
- submit rental applications
- answer landlord questions
- track application status
- receive viewing invitations
- confirm or decline viewings
- message landlords
- receive notifications
- report suspicious listings

### Landlord

A landlord can:

- create an account
- create a landlord profile
- add properties
- upload property images
- create rental listings
- publish, pause, close, or mark listings as rented
- define application questions
- receive applications
- review applicants
- shortlist applicants
- reject applicants
- invite applicants to viewings
- mark viewings as completed
- accept an applicant
- message tenants
- receive notifications
- report suspicious activity

### Administrator

An administrator can:

- review users
- review listings
- review reports
- suspend accounts
- moderate listings
- review landlord verification
- review property verification
- view platform analytics
- manage platform safety issues

Administrators must not make rental decisions on behalf of landlords.

---

## 6. Geographic Scope

The initial launch should focus on central Mauritius.

Priority areas:

- Moka
- Ébène
- Réduit
- Rose Hill
- Quatre Bornes

The platform must be designed so that expansion to the rest of Mauritius is possible without architectural changes.

---

## 7. V1 Features

The first production version must include:

### Authentication
- registration
- login
- logout
- email verification
- password reset
- role-based access

### Tenant Profile
- name
- phone
- occupation type
- employer or school
- income range
- preferred move-in date
- preferred lease duration
- number of occupants
- pets
- short bio

### Landlord Profile
- name
- phone
- verification status

### Property Management
- create property
- edit property
- archive property
- upload multiple property images
- select a cover image

### Listing Management
- create listing
- edit listing
- publish listing
- pause listing
- close listing
- mark listing as rented

### Search
- search by location
- minimum and maximum rent
- bedrooms
- bathrooms
- furnished status
- property type
- availability date
- lease duration
- pets allowed
- parking

### Saved Listings
- save listing
- remove saved listing

### Applications
- create application
- save application as draft
- submit application
- answer custom landlord questions
- view application status
- withdraw application

### Landlord Application Management
- view applications
- review application
- move application through approved states
- shortlist applicant
- reject applicant
- accept applicant

### Viewings
- propose viewing time
- confirm viewing
- decline viewing
- cancel viewing
- mark viewing completed
- mark no-show

### Messaging
- text-only messaging
- conversation history
- read status
- timestamps

### Notifications
- new application
- application status update
- viewing invitation
- viewing response
- new message
- application accepted
- application rejected

### Safety
- report listing
- report user
- moderation queue

### Admin
- user management
- listing moderation
- report management
- verification review
- basic analytics

---

## 8. Explicitly Excluded From V1

The following must not be implemented in V1:

- rent payments
- deposit payments
- escrow
- payment processing
- transaction commissions
- lease negotiation
- property management
- automated tenant ranking
- AI tenant scoring
- automated tenant selection
- background checks
- lease generation
- digital signatures
- credit scoring
- native mobile applications
- insurance integrations
- complex AI recommendations
- financial services

---

## 9. Product State Models

### Listing Status

- DRAFT
- PENDING_REVIEW
- ACTIVE
- PAUSED
- RENTED
- CLOSED

### Application Status

- DRAFT
- SUBMITTED
- UNDER_REVIEW
- SHORTLISTED
- VIEWING_INVITED
- VIEWING_COMPLETED
- ACCEPTED
- REJECTED
- WITHDRAWN

### Viewing Status

- PROPOSED
- CONFIRMED
- DECLINED
- COMPLETED
- CANCELLED
- NO_SHOW

### Verification Status

- UNVERIFIED
- PENDING
- VERIFIED
- REJECTED

---

## 10. Product Rules

1. A tenant must not be allowed to create a landlord property.
2. A landlord must not access another landlord's private property management data.
3. A landlord must only manage applications for listings they own.
4. A tenant must only access their own private applications.
5. A tenant should normally have only one active application per listing.
6. Application status transitions must be controlled by the backend.
7. The frontend must never be trusted for authorization.
8. Administrators must not select tenants on behalf of landlords.
9. The platform must not rank applicants by suitability in V1.
10. The platform must collect only the personal information necessary for the rental workflow.

---

## 11. Core Product Differentiator

The platform is not simply another property listing website.

Its primary value is structured rental workflow management.

The differentiating journey is:

Property Listing
→ Structured Application
→ Applicant Pipeline
→ Viewing Management
→ Communication
→ Outcome

Landlords should be able to manage applicants without relying on dozens of WhatsApp conversations.

Tenants should be able to understand exactly what stage their application is in.

---

## 12. Mobile-First Requirement

The platform is a web application but must be designed mobile-first.

All primary workflows must work well on mobile browsers.

Native Android and iOS applications are not part of V1.

---

## 13. Success Criteria

V1 is considered successful when:

- landlords can publish real properties
- tenants can discover relevant listings
- tenants can submit complete applications
- landlords can manage applications efficiently
- viewings can be arranged through the platform
- tenants can track application status
- landlords and tenants can communicate through the platform
- real rental outcomes originate from platform applications

The first business objective is not monetisation.

The first objective is marketplace utility and workflow adoption.

---

## 14. Initial Marketplace Goals

Early milestones:

- 10 landlords onboarded
- 50 properties listed
- 100 complete tenant profiles
- 50 legitimate rental applications
- 10 viewing invitations
- first successful rental from a platform application
- 100 active properties
- 500 active tenants

---

## 15. Primary Marketplace Metrics

Track:

- active listings
- active landlords
- active tenants
- applications per listing
- percentage of listings receiving at least one application
- median time to first application
- landlord response rate
- percentage of applications reaching viewing
- successful rental outcomes
- fake listing reports
- duplicate listing reports

The most important early metric is:

Percentage of active listings receiving at least one legitimate application.