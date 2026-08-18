# Mauritius Rental Platform — Security Specification

## 1. Security Objective

The platform handles:

* user identities
* landlord information
* tenant information
* property information
* rental applications
* private messages
* viewing schedules
* verification information
* administrative actions

Security must therefore be part of the architecture from the beginning.

The security model must protect:

1. confidentiality — users see only information they are allowed to see
2. integrity — users cannot manipulate records they do not control
3. availability — abusive traffic should not make the service unusable
4. accountability — important administrative and workflow actions should be traceable

The platform must assume that the frontend can be manipulated by an attacker.

The backend and database must remain secure even if someone completely bypasses the React interface.

---

# 2. Core Security Principle

Never trust the client.

React must never be treated as the authority for:

* user identity
* user role
* property ownership
* listing ownership
* application ownership
* conversation membership
* application status
* listing status
* verification status
* administrative permissions

Every important operation must be revalidated by the backend.

---

# 3. Defense in Depth

Security should exist at multiple levels:

```text
Browser
   ↓
Frontend validation
   ↓
HTTPS
   ↓
API rate limiting
   ↓
Authentication
   ↓
Role authorization
   ↓
Resource authorization
   ↓
Input validation
   ↓
Business rules
   ↓
Database constraints
   ↓
Row Level Security where applicable
```

No single layer should be considered sufficient protection.

---

# 4. Primary Threat Categories

The platform should explicitly defend against:

* broken authentication
* broken object-level authorization
* role escalation
* mass assignment
* SQL injection
* cross-site scripting
* excessive data exposure
* malicious file uploads
* brute-force activity
* automated spam
* unrestricted API consumption
* account enumeration
* unauthorized conversation access
* unauthorized application access
* unauthorized property modification
* privilege escalation to ADMIN
* secret leakage
* race conditions
* duplicate acceptance of tenants
* accidental public exposure of exact addresses
* unsafe administrative operations

---

# 5. Authentication Provider

Use:

```text
Supabase Auth
```

V1 authentication:

* email registration
* email verification
* password login
* logout
* password reset

Do not build a custom password authentication system.

The platform database must never store user passwords.

---

# 6. Supabase API Keys

Use the current Supabase key model.

Frontend:

```text
SUPABASE_PUBLISHABLE_KEY
```

Backend privileged operations:

```text
SUPABASE_SECRET_KEY
```

Legacy projects may expose older:

```text
anon
service_role
```

keys, but new development should prefer Supabase's current publishable and secret keys where available.

The secret key bypasses Row Level Security and must therefore be treated as a high-value credential.

---

# 7. Secret Key Rule

The Supabase secret key must:

* exist only on backend infrastructure
* exist only in server environment variables
* never be included in React
* never be placed in `VITE_*` variables
* never be committed to Git
* never be logged
* never be sent to users
* never be included in screenshots or documentation
* be rotated immediately if exposed

React must never possess privileged Supabase credentials.

---

# 8. Separate Supabase Clients

The backend should conceptually use two access modes.

## User-context client

Used where an operation should respect the authenticated user's permissions.

The user's authenticated JWT should be preserved so Row Level Security can participate in authorization.

## Privileged server client

Uses the Supabase secret key.

Use only for operations that genuinely require elevated access, such as:

* certain admin operations
* controlled system workflows
* backend-managed storage actions
* trusted maintenance processes

Do not use the privileged client simply because it is easier.

---

# 9. Authentication Tokens

React may receive Supabase session tokens as part of the supported Supabase Auth flow.

Do not create additional custom token persistence mechanisms.

Do not:

* copy tokens into local application databases
* log tokens
* send tokens in query strings
* expose tokens in URLs
* include tokens in analytics events
* include tokens in error messages

Authenticated API calls should use:

```http
Authorization: Bearer <access_token>
```

---

# 10. Backend Authentication Middleware

Every protected request must pass through authentication middleware.

Example:

```text
Request
   ↓
authenticateUser
   ↓
resolve authenticated user
   ↓
check account status
   ↓
continue
```

The middleware must derive the user's identity from the verified authentication token.

Never derive identity from:

```text
req.body.user_id
req.body.tenant_id
req.body.landlord_id
```

---

# 11. Role Authorization

V1 roles:

```text
TENANT
LANDLORD
ADMIN
```

Backend middleware should support rules such as:

```text
requireRole("TENANT")
requireRole("LANDLORD")
requireRole("ADMIN")
```

Role checks must occur server-side.

Hiding a button in React is not authorization.

---

# 12. Admin Role Protection

Public users must never be allowed to register as:

```text
ADMIN
```

Registration may only accept:

```text
TENANT
LANDLORD
```

Admin accounts must be provisioned through a controlled internal process.

The API must ignore or reject attempts such as:

```json
{
  "role": "ADMIN"
}
```

from normal registration.

---

# 13. Role Escalation Protection

Normal users must not be allowed to update:

```text
profiles.role
```

through generic profile update endpoints.

Role changes must require a dedicated privileged administrative process.

Row Level Security and backend authorization should prevent users from modifying their role directly.

---

# 14. Account Status Enforcement

Account states:

```text
ACTIVE
SUSPENDED
DELETED
```

Protected API middleware must check account status.

A user whose account is:

```text
SUSPENDED
```

must not continue performing normal authenticated actions simply because an old session token remains valid.

---

# 15. Object-Level Authorization

Every endpoint receiving an object identifier must validate access to that specific object.

Examples:

```text
/properties/:propertyId

/listings/:listingId

/applications/:applicationId

/viewings/:viewingId

/conversations/:conversationId
```

A valid UUID does not imply permission.

UUIDs should be treated as identifiers, not security controls.

---

# 16. Property Authorization

For:

```text
PATCH /properties/:propertyId
```

the backend must verify:

```text
authenticated user
        ↓
LANDLORD
        ↓
landlord profile
        ↓
owns property
```

A different landlord must receive:

```text
403 Forbidden
```

or an intentionally privacy-preserving:

```text
404 Not Found
```

depending on API policy.

Use one approach consistently.

---

# 17. Listing Authorization

A landlord may manage a listing only if:

```text
listing
   ↓
property
   ↓
landlord
   ↓
authenticated user
```

ownership matches.

Never trust a submitted:

```text
landlord_id
```

field.

---

# 18. Application Authorization

Tenant may access:

```text
their own applications
```

Landlord may access:

```text
applications attached to listings they own
```

Admin may access applications only when an approved administrative workflow requires it.

No tenant may retrieve another tenant's application by changing an application UUID.

---

# 19. Conversation Authorization

Only conversation participants may:

* retrieve conversation
* retrieve messages
* send messages
* mark conversation read

Backend must confirm participation every time.

An attacker changing:

```text
conversationId
```

must not gain access to another conversation.

---

# 20. Viewing Authorization

Tenant may access viewing only if the viewing belongs to their application.

Landlord may access viewing only if its application belongs to a listing they own.

Viewing actions must also respect role.

Example:

Only the relevant tenant should confirm or decline a proposed viewing.

---

# 21. Row Level Security

Enable Row Level Security on application tables that may be reachable through the Supabase Data API.

Default policy:

> No access unless explicitly permitted.

Do not create broad policies such as:

```sql
USING (true)
```

on private tables without a documented reason.

---

# 22. RLS Is Defense in Depth

Backend authorization remains mandatory.

RLS does not replace:

* service-layer ownership checks
* application state validation
* role validation
* input validation

Similarly, backend authorization does not justify disabling appropriate RLS protections.

---

# 23. Tables Requiring Particular RLS Attention

At minimum review policies for:

```text
profiles
tenant_profiles
tenant_preferred_locations
landlord_profiles

properties
property_images
listings
saved_listings

applications
application_answers
application_status_history

viewings

conversations
conversation_participants
messages

notifications

reports
```

Administrative tables should be inaccessible to ordinary clients.

---

# 24. Public Listing Data

Do not make entire underlying property rows anonymously readable simply to implement public search.

In particular, do not accidentally expose:

```text
address_line_1
address_line_2
internal verification information
landlord private data
```

Public listing information should preferably flow through:

```text
Node API
        ↓
explicit public serializer
```

Only approved public fields should be returned.

---

# 25. Public Data Serialization

Never return raw:

```text
SELECT *
```

objects directly to public users.

Create explicit serializers.

Example public property response:

```text
property_type
district
locality
neighbourhood
bedrooms
bathrooms
furnished
parking_spaces
```

Exact private address should remain excluded unless intentionally released.

---

# 26. Mass Assignment Protection

Never pass an entire request body directly into a database update.

Unsafe:

```javascript
update(req.body)
```

Instead explicitly allow fields.

Example:

```text
allowedPropertyFields:
- property_type
- address_line_1
- address_line_2
- district
- locality
- neighbourhood
- latitude
- longitude
- bedrooms
- bathrooms
- furnished
- parking_spaces
```

Reject or ignore protected fields.

---

# 27. Protected Property Fields

Landlord must not directly submit:

```text
landlord_id
verification_status
created_at
updated_at
archived_at
```

unless the relevant dedicated workflow permits it.

---

# 28. Protected Listing Fields

Normal listing updates must not directly accept:

```text
status
published_at
closed_at
property_id
```

when those are controlled by dedicated workflows.

---

# 29. Protected Application Fields

Tenant application updates must not accept:

```text
tenant_id
listing_id
status
submitted_at
withdrawn_at
```

through a generic update request.

Status transitions use dedicated services.

---

# 30. Input Validation

Every externally supplied value must be validated server-side.

Validate:

* UUIDs
* strings
* numbers
* booleans
* dates
* timestamps
* allowed states
* text lengths
* uploaded files
* pagination
* sorting
* filters

Frontend validation exists for user experience only.

Backend validation is authoritative.

---

# 31. Validation Library

Choose one maintained validation library and use it consistently.

Recommended:

```text
Zod
```

or a documented equivalent approved during bootstrap.

Do not mix several validation libraries without need.

---

# 32. SQL Injection Protection

Never construct SQL by concatenating untrusted user input.

Use:

* Supabase query APIs
* parameterized queries
* trusted query builders

Never do:

```text
"SELECT ... WHERE locality = '" + userInput + "'"
```

Sorting fields must be mapped from a server-side allowlist.

---

# 33. Cross-Site Scripting Protection

Assume all user-generated text may contain malicious content.

Examples:

* listing descriptions
* tenant bios
* introductory messages
* custom questions
* messages
* reports

React's normal escaped text rendering should be preserved.

Do not render user content using:

```text
dangerouslySetInnerHTML
```

unless content has gone through a deliberate sanitization design.

V1 should not need raw HTML from users.

---

# 34. User-Generated HTML

Do not accept HTML as a supported content format in V1.

Listing descriptions and messages should be plain text.

If rich text is introduced later, implement strict sanitization.

---

# 35. CORS

Production API must allow only approved frontend origins.

Example:

```text
https://production-domain
```

Development may allow:

```text
http://localhost:5173
```

Do not configure authenticated production API access with unrestricted:

```text
*
```

origins.

---

# 36. CSRF

V1 authentication uses bearer tokens in the Authorization header rather than authentication automatically attached through ordinary cross-site cookies.

Do not add unnecessary CSRF mechanisms to a flow that does not use cookie-based authentication.

If authentication later changes to automatically sent cookies, perform a fresh CSRF design review and introduce suitable protection.

---

# 37. HTTPS

Production frontend and API traffic must use HTTPS.

Do not transmit:

* login credentials
* session tokens
* application information
* private messages

over unencrypted HTTP.

Development localhost is the normal exception.

---

# 38. Security Headers

The Node backend/frontend deployment should configure appropriate HTTP security headers.

Use a maintained mechanism such as:

```text
Helmet
```

for Express where appropriate.

Review:

* Content-Security-Policy
* X-Content-Type-Options
* Referrer-Policy
* frame protections
* HTTPS/HSTS behavior

Do not blindly enable incompatible defaults without testing the application.

---

# 39. Rate Limiting

Apply endpoint-specific rate limiting.

Particular attention:

* account/profile creation
* password-related workflows where controlled by the app
* application submission
* conversation creation
* message sending
* report submission
* image uploading
* expensive search requests
* administrative login/access

Thresholds should be configurable through environment configuration.

Do not hardcode arbitrary permanent limits before real usage is observed.

---

# 40. Resource Limits

Every API must have reasonable resource limits.

Examples:

```text
pagination maximum
request body size
image size
images per property
message length
listing description length
application answer length
```

This protects both security and system availability.

---

# 41. Pagination Limit

Default:

```text
20
```

Maximum:

```text
100
```

Do not allow users to request:

```text
limit=1000000
```

---

# 42. File Upload Security

V1 property images are the primary upload surface.

Only authenticated landlords who own the property may upload images for it.

Do not trust:

* filename
* extension
* browser MIME type

Validate the actual uploaded content.

---

# 43. Allowed Property Image Types

Initial allowed formats:

```text
JPEG
PNG
WebP
```

Do not accept:

```text
SVG
HTML
JavaScript
executables
archives
PDF
```

as property images.

SVG is deliberately excluded from V1 because it can contain active content and creates unnecessary complexity.

---

# 44. File Size Limit

Initial configurable maximum:

```text
10 MB per image
```

The exact value may later be tuned based on actual mobile uploads and hosting limits.

Reject oversized requests before expensive image processing where possible.

---

# 45. Image Count Limit

Initial configurable maximum:

```text
20 images per property
```

This protects storage and prevents abuse while being sufficient for normal rental listings.

The value may later be changed based on actual product use.

---

# 46. Server-Side Upload Validation

Upload handling must validate:

1. authenticated user
2. LANDLORD role
3. property ownership
4. file size
5. actual supported image format
6. generated storage filename
7. storage destination

Do not use the original filename as the authoritative storage name.

Generate a UUID-based object path.

---

# 47. Recommended Storage Path

Example:

```text
property-images/
  <landlord-user-id>/
    <property-id>/
      <generated-uuid>.jpg
```

Do not permit the client to choose an arbitrary bucket path.

---

# 48. Storage Architecture for V1

Recommended secure V1 approach:

```text
Browser
   ↓
Node upload endpoint
   ↓
validate ownership + file
   ↓
Supabase Storage using server credential
```

This keeps authorization and file validation centralized.

If direct browser-to-Supabase uploads are introduced later, they require carefully tested Storage RLS policies or signed-upload architecture.

---

# 49. Storage Bucket Security

Buckets containing private files must not be public.

Property images intended for public listings may use a deliberately public delivery mechanism, but upload/delete privileges must remain restricted.

Future identity or verification documents must use private storage and signed or controlled access.

Never store verification documents in a public bucket.

---

# 50. Exact Address Protection

Exact addresses can create physical privacy and safety risks.

Public listing API should normally expose:

```text
district
locality
neighbourhood
```

rather than:

```text
full street address
unit number
door number
```

Exact address visibility should be a deliberate product rule, not an accidental consequence of database serialization.

---

# 51. Tenant Data Minimization

Do not expose every tenant profile field to every landlord.

Landlords should only receive applicant information required for reviewing a submitted application.

Non-applicant tenant profiles should not be freely browsable.

---

# 52. Sensitive Documents

V1 must not collect:

* passport scans
* national ID images
* bank statements
* payslips
* bank account numbers
* credit reports
* criminal/background checks

Adding these later requires a dedicated security, privacy, retention, and access-control design.

---

# 53. Messaging Abuse Protection

Messages are user-generated content.

Implement:

* participant authorization
* content length limit
* rate limiting
* report functionality
* optional account suspension

Do not automatically execute:

* URLs
* HTML
* scripts
* attachments

received through messages.

V1 messaging is text only.

---

# 54. External Links in Messages

If URLs become clickable, the frontend should treat them as untrusted external destinations.

Do not fetch user-submitted URLs from the backend merely to generate previews in V1.

This avoids unnecessary server-side request risks.

---

# 55. Application State Security

Application states must be controlled by the service layer.

The frontend must never directly perform:

```text
status = ACCEPTED
```

or similar database updates.

Backend must validate:

* actor
* current state
* requested state
* listing ownership
* business rules

---

# 56. Race Condition Protection

Two nearly simultaneous requests must not allow two applicants to become accepted for the same listing.

Database protection:

```sql
CREATE UNIQUE INDEX one_accepted_application_per_listing
ON applications(listing_id)
WHERE status = 'ACCEPTED';
```

Application acceptance must also run inside a database transaction.

---

# 57. Transaction Security

Operations that must succeed together should use transactions.

Examples:

## Application acceptance

```text
application → ACCEPTED
listing → RENTED
status history created
remaining application handling
```

## Status transition

```text
application status update
+
status history record
```

Do not leave the database in partially updated workflow states.

---

# 58. Verification Security

Verification status must only be controlled by approved administrative/system workflows.

Users cannot self-set:

```text
VERIFIED
```

Verification evidence must never be exposed in public API responses.

Public output should communicate only the result and type of verification.

---

# 59. Admin Security

Admin endpoints use:

```text
/api/v1/admin/*
```

Every admin endpoint requires:

1. authentication
2. ACTIVE account
3. ADMIN role
4. operation-level authorization

Do not rely on an `/admin` React route for protection.

---

# 60. Admin MFA

Before public production launch, administrator accounts should use multi-factor authentication if supported by the final authentication configuration.

Administrative accounts have higher impact and should receive stronger protection than standard marketplace accounts.

---

# 61. Admin Audit Logging

Important actions must create audit logs.

Examples:

```text
USER_SUSPENDED
USER_RESTORED
LISTING_REMOVED
VERIFICATION_APPROVED
VERIFICATION_REJECTED
REPORT_RESOLVED
```

Audit logs should record:

```text
admin
action
target
reason
timestamp
```

Do not provide ordinary application functionality to modify historical audit logs.

---

# 62. Error Messages

Production errors must not expose:

* stack traces
* SQL statements
* internal database names
* environment variables
* storage credentials
* Supabase secrets
* filesystem paths

Return safe structured errors.

Example:

```json
{
  "success": false,
  "error": {
    "code": "PROPERTY_NOT_FOUND",
    "message": "Property not found."
  }
}
```

---

# 63. Authentication Error Privacy

Avoid unnecessary account enumeration.

Where appropriate, password recovery and authentication flows should not reveal more information than needed about whether an email address has an account.

Use the behavior and protections provided by Supabase Auth unless there is a documented reason to customize them.

---

# 64. Logging

Production logs may include:

* request ID
* method
* route
* response code
* internal error category
* timestamp

Avoid logging:

* passwords
* access tokens
* refresh tokens
* full application answers unnecessarily
* private messages unnecessarily
* secret keys
* sensitive verification evidence

---

# 65. Request Correlation

Recommended:

Generate a request/correlation ID for API requests.

Include it in:

* backend logs
* safe error responses where useful

Example:

```text
request_id: 8c1...
```

This improves debugging without revealing sensitive data.

---

# 66. Environment Variables

Backend environment may include:

```text
SUPABASE_URL
SUPABASE_SECRET_KEY
SUPABASE_PUBLISHABLE_KEY
FRONTEND_URL
NODE_ENV
PORT
```

Frontend may include only values safe to expose publicly.

Example:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_API_BASE_URL
```

Never prefix server secrets with:

```text
VITE_
```

because Vite exposes these values to browser bundles.

---

# 67. `.env.example`

Commit:

```text
.env.example
```

with placeholders.

Example:

```text
SUPABASE_URL=
SUPABASE_SECRET_KEY=
FRONTEND_URL=
PORT=
```

Never place actual credentials in `.env.example`.

Actual:

```text
.env
```

must be excluded through `.gitignore`.

---

# 68. Git Secret Protection

At minimum:

* `.env` ignored
* production credentials never committed
* secret values never placed in documentation
* pull requests checked for accidental secrets

A secret accidentally committed must be considered compromised even if later removed from the visible file.

Rotate it.

---

# 69. Dependency Security

Before Codex adds a dependency, it should check:

* necessity
* maintenance status
* package reputation
* existing functionality
* security implications

Do not add packages for trivial functionality.

Regularly review dependency vulnerability reports.

---

# 70. Lockfiles

Commit dependency lockfiles.

Examples:

```text
package-lock.json
```

or the chosen package manager's equivalent.

Use one package manager consistently.

This reduces unexpected dependency drift between environments.

---

# 71. Dependency Updates

Do not automatically deploy major dependency upgrades directly to production.

Updates should:

```text
update
→ run tests
→ review breaking changes
→ merge
```

Security fixes should still be handled promptly.

---

# 72. API Abuse

Search and public listing endpoints are accessible without authentication.

They require:

* pagination
* query validation
* resource limits
* rate limiting when abuse becomes evident
* no private fields

Do not expose unrestricted database querying capabilities.

---

# 73. Scraping

Do not attempt to solve all scraping in V1.

Prioritize protecting:

* private applicant data
* contact information
* exact addresses
* messages

Public listing information is inherently more discoverable.

Rate limiting and monitoring can address abusive traffic.

---

# 74. Account Suspension

A suspended account should lose ability to:

* create listings
* submit applications
* send messages
* schedule viewings
* perform normal authenticated actions

Whether historical information remains visible must follow product policy.

---

# 75. Data Deletion

Account deletion must not initially be implemented as uncontrolled cascading SQL deletion.

Rental history may have relationships with:

* listings
* applications
* messages
* audit records

A dedicated deletion/anonymization workflow should eventually define:

* what is deleted
* what is anonymized
* what must remain for legitimate system integrity
* retention requirements

Until that workflow exists, destructive user-account deletion must be treated carefully.

---

# 76. Backups

Production database backup configuration must be confirmed before public launch.

Recovery procedures should be documented.

A backup is useful only if restoration is possible.

Before production launch, test restoration in a non-production environment.

---

# 77. Development vs Production

Use separate environments.

At minimum:

```text
development
production
```

Recommended:

```text
development
staging
production
```

Do not test destructive features using production data.

---

# 78. Production Database Access

Production database access should be limited to people and systems that genuinely require it.

Do not distribute production credentials casually among developers or coding agents.

Codex should operate against development/test environments unless an explicitly controlled production operation is requested.

---

# 79. Codex Secret Handling

Codex must never:

* paste production secrets into source files
* commit `.env`
* hardcode credentials
* print secrets to logs
* include credentials in test fixtures
* expose secret keys to React
* output secrets into documentation

If Codex needs a credential, it should reference an environment variable name.

Example:

```text
process.env.SUPABASE_SECRET_KEY
```

---

# 80. Codex Production Rule

Codex must not make destructive production database changes automatically.

Production migrations must:

1. exist in source control
2. be reviewed
3. have a known migration path
4. be tested outside production first

---

# 81. Security Tests — Authentication

Tests should include:

```text
missing token → rejected

invalid token → rejected

expired/invalid session → rejected

suspended user → rejected where required

ordinary user attempting admin route → rejected
```

---

# 82. Security Tests — Ownership

Create two tenants and two landlords in test fixtures.

Test:

```text
Landlord A cannot modify Landlord B property

Landlord A cannot read private applications for Landlord B

Tenant A cannot read Tenant B application

Tenant A cannot access Tenant B conversation

Tenant A cannot confirm Tenant B viewing
```

These tests are mandatory.

---

# 83. Security Tests — Mass Assignment

Explicitly test payloads such as:

```json
{
  "role": "ADMIN"
}
```

```json
{
  "landlord_id": "another-user"
}
```

```json
{
  "verification_status": "VERIFIED"
}
```

```json
{
  "status": "ACCEPTED"
}
```

Generic endpoints must reject or ignore protected fields according to the endpoint contract.

---

# 84. Security Tests — RLS

Where Supabase Data API or Realtime access is used, test RLS policies.

Examples:

```text
Tenant A cannot SELECT Tenant B private data.

Landlord A cannot SELECT Landlord B private property-management data.

Conversation participant can access conversation.

Non-participant cannot.
```

Where practical, database policy tests may use PostgreSQL testing tools supported by the Supabase development workflow.

---

# 85. Security Tests — Uploads

Test:

```text
unauthenticated upload
tenant trying property upload
wrong landlord
oversized file
unsupported extension
spoofed MIME type
non-image content
too many images
```

All must fail safely.

---

# 86. Security Tests — State Machines

Test invalid transitions.

Examples:

```text
SUBMITTED → ACCEPTED
```

should fail if acceptance requires completed viewing under the approved workflow.

```text
REJECTED → SHORTLISTED
```

should fail.

```text
ACCEPTED → UNDER_REVIEW
```

should fail.

State machines must be tested independently from React.

---

# 87. Security Tests — Concurrent Acceptance

Create two eligible applications.

Attempt to accept both concurrently.

Expected result:

```text
exactly one ACCEPTED
exactly one listing RENTED
```

Database integrity must prevent two accepted applications.

---

# 88. Security Tests — Messages

Test:

* participant can send
* non-participant cannot send
* empty content rejected
* oversized content rejected
* malicious HTML displayed as text
* unauthorized message history rejected

---

# 89. Security Tests — Public API

Verify anonymous users cannot receive:

* exact private addresses
* landlord private contact details unless intentionally public
* tenant data
* application answers
* conversations
* verification evidence
* admin notes

Public API serialization must have dedicated tests.

---

# 90. OWASP Review

Before public beta, perform a focused review against current OWASP web/API security categories.

Particular attention:

```text
Broken Object Level Authorization
Broken Authentication
Broken Object Property Level Authorization
Unrestricted Resource Consumption
Security Misconfiguration
Injection
Server-Side Request Forgery where relevant
```

---

# 91. Security Review Before Launch

Before public production launch, confirm:

* HTTPS enabled
* production CORS configured
* RLS reviewed
* secrets rotated and protected
* admin accounts secured
* authorization tests passing
* upload tests passing
* rate limits configured
* database backups configured
* logging configured
* error responses sanitized
* public serializers reviewed
* dependency audit reviewed
* production environment separated from development

---

# 92. Incident Response Minimum

Before significant public usage, document what happens if:

* user account is compromised
* secret key leaks
* private data is exposed
* malicious listing is discovered
* admin account is compromised
* production database is accidentally modified

At minimum, the team must know how to:

* suspend users
* revoke/rotate credentials
* remove listings
* restore backups
* review logs
* disable affected features

---

# 93. Architecture Decision — Direct Supabase Access

Default rule:

> React should not directly modify core rental workflow tables.

Core workflow changes go:

```text
React
   ↓
Node API
   ↓
authorization + validation + service rules
   ↓
Supabase/PostgreSQL
```

Direct browser access to Supabase should initially be limited to approved capabilities such as authentication and explicitly reviewed realtime/storage functionality.

---

# 94. Architecture Decision — Privileged Access

The existence of a Supabase secret key must never become an excuse to bypass the platform's authorization architecture.

Any server service using privileged credentials must perform all necessary:

* authentication
* role checks
* ownership checks
* validation
* business rules

before accessing protected records.

---

# 95. Security Non-Goals for V1

Do not introduce unnecessary enterprise complexity such as:

* custom cryptographic protocols
* custom identity provider
* custom password storage
* hardware security infrastructure
* service mesh
* zero-trust networking platform
* dedicated security microservices

Use established platform capabilities correctly.

---

# 96. Final Security Principle

The system must remain secure under the assumption that an attacker can:

* inspect the frontend source
* modify API requests
* discover UUIDs
* change request bodies
* call endpoints manually
* upload malicious files
* automate requests
* pretend to be another role through client-supplied values

None of those actions should allow the attacker to cross an authorization boundary.

Security decisions belong primarily to:

```text
Authentication
+
Backend authorization
+
Business rules
+
Database constraints
+
RLS
+
Careful data exposure
```

—not to hidden buttons in the frontend.
