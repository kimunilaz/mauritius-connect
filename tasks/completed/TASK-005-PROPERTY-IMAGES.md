# TASK-005 — Property Images Completion Report

## Summary

TASK-005 adds private property-image management to the existing landlord-owned
property foundation. An ACTIVE LANDLORD can upload, view, reorder, choose a
cover, and delete images for an owned property through the Node API. The
browser never receives Storage mutation authority, raw object paths, or the
backend secret. No listing or public-image behavior was added.

## Storage

- Bucket: `property-images`.
- State: private.
- Allowed MIME types: `image/jpeg`, `image/png`, and `image/webp`.
- Object limit: 10 MiB.
- Local setup: declarative bucket configuration in `supabase/config.toml`.
- Hosted setup: the idempotent `npm run storage:setup:hosted` script creates or
  updates the exact bucket configuration using ignored backend environment
  configuration.

No credential or environment value is stored or reported.

## Upload Pipeline

The route first verifies the Supabase access token, loads the application
profile, requires an ACTIVE account, requires the LANDLORD role, validates the
property UUID, and performs an owner-scoped property lookup. Archived state is
also checked before Multer parses the multipart body.

Multer accepts exactly one memory-backed `image` file and rejects requests over
10 MiB before decoding. Sharp detects and decodes the actual bytes with a
40-megapixel input limit; client filename, extension, browser MIME type,
landlord ID, property ownership claims, and protected metadata are ignored.
Accepted images are orientation-corrected and re-encoded without source
metadata.

The backend generates:

```text
<verified-auth-user-id>/<owned-property-id>/<server-uuid>.<safe-extension>
```

It uploads with `upsert: false`, then creates the `property_images` row. A
Storage upload failure creates no metadata. A metadata creation failure causes
a best-effort removal of the newly uploaded object and returns a safe error.

## Supported Formats

JPEG, PNG, and WebP are supported based on successful decoding and detected
content, not names or request MIME values. SVG, HTML, text, PDF, empty, corrupt,
and arbitrary binary content are rejected. Tests also prove that a real JPEG
with a forged executable filename and generic MIME value is accepted and stored
under a generated `.jpg` path.

## Privacy

Sharp applies image orientation to pixels and re-encodes without
`withMetadata`. EXIF, GPS/geolocation, orientation tags, comments, embedded
profiles, and other source metadata are therefore not persisted. Both local
tests and the real hosted download inspection confirmed EXIF/orientation removal.

## Cover Images

- The first image is automatically the cover.
- Later images are non-cover by default.
- Setting a new cover clears the former cover and updates the selected owned
  image, with best-effort rollback on a persistence failure.
- Deleting a cover promotes the first remaining image under deterministic
  ordering.
- Deleting the final image is valid and leaves no cover.
- The existing partial unique database index continues enforcing at most one
  cover per property.

## Ordering

New images append at one greater than the current maximum `display_order`.
Reads sort by `display_order`, then `created_at`, then `id`, so ties remain
deterministic. PATCH accepts only a non-negative integer order and/or
`is_cover: true`. The frontend offers accessible move-earlier/move-later
controls and attempts to roll back the first half of a swap if the second API
request fails.

## Signed URLs

Owned property-detail reads generate private signed URLs with a 15-minute
expiry. Signed URLs are returned only in the safe image representation and are
never stored in `property_images`. Raw `storage_path` values stay backend-only.
Landlord property-list responses do not sign every image.

## Delete Consistency

Before removal, the service downloads a private backup. Storage deletion must
succeed before metadata is changed, so Storage failure leaves the row and cover
state intact. The service then updates any cover replacement and deletes the
owner-scoped row. If database mutation fails, it attempts to restore the object
at the same generated path and restore the former cover state. Compensation
failures are logged without paths, credentials, tokens, or raw provider errors.

## Backend API

- `POST /api/v1/properties/:propertyId/images` uploads one image and returns
  HTTP 201 with a safe signed representation.
- `PATCH /api/v1/properties/:propertyId/images/:imageId` changes cover and/or
  display order with strict mass-assignment protection.
- `DELETE /api/v1/properties/:propertyId/images/:imageId` removes the object and
  metadata and returns the remaining ordered images.
- `GET /api/v1/properties/:propertyId` now includes the owned, ordered `images`
  collection.

Cross-landlord property and image access uses privacy-preserving 404 responses.
TENANT, SUSPENDED, DELETED, anonymous, and invalid-token callers remain blocked
by the existing authorization chain.

## Frontend

The private landlord property-detail screen now includes a responsive image
gallery with:

- JPEG/PNG/WebP upload selection and size/type UX validation;
- multipart bearer-authenticated upload through the centralized API client;
- loading and safe error/success messages;
- cover labels and set-cover controls;
- accessible move-earlier/move-later controls;
- permanent-delete confirmation;
- ordered images with meaningful alternative text;
- existing archived images visible while new archived-property uploads are
  unavailable.

The UI does not contact Supabase Storage directly.

## Dependencies Added

- `multer`: bounded, single-file multipart parsing in the Node backend.
- `sharp`: trusted raster decoding, pixel limits, orientation handling, safe
  re-encoding, and metadata removal.

The installation audit reported zero vulnerabilities.

## Database/Storage Changes

Database migrations: none. The existing TASK-001 `property_images` schema and
one-cover partial unique index were sufficient. No TASK-001 migration was
rewritten.

Storage changes: the private bucket declaration and an idempotent hosted setup
script were added. No Storage object policy was added. Application-table RLS
remains enabled and deny-by-default with no broad policies.

## Hosted Supabase Verification

The real development Supabase project passed 11/11 property-image checks:

- exact private bucket MIME and size configuration;
- API-created owned property;
- real JPEG, PNG, and WebP upload and database/object persistence;
- hosted EXIF/orientation stripping verification on downloaded bytes;
- working short-lived signed URLs and denied unsigned reads;
- rejected non-image and oversized payloads with no metadata rows;
- cover, order, and protected-field behavior;
- blocked TENANT and SUSPENDED callers;
- hidden cross-landlord upload, PATCH, and DELETE;
- denied anonymous, LANDLORD-session, and TENANT-session direct Storage access
  and mutation, verified by checking the protected object remained present;
- real cover deletion/object removal and deterministic replacement;
- archived upload rejection with existing signed images still viewable.

All verifier records and objects were uniquely scoped and removed afterward.
The private bucket remains configured for development.

Hosted regression results also passed:

- Database catalog/RLS: 9/9.
- Authentication: 10/10.
- Tenant/Landlord profiles: 7/7.
- Property management: 8/8.

Total hosted checks passed: 45/45.

## Tests

Tests added:

- 21 backend property-image route/integration cases.
- 10 backend actual-image processing cases.
- 5 frontend property-image gallery and management cases.
- One reproducible hosted Storage/property-image verifier with cleanup.

Tests run:

- Frontend Vitest: 34.
- Backend Vitest: 150.
- Embedded PostgreSQL runtime checks: 15, plus static inspection of 5
  migrations and 21 application tables.
- Hosted Supabase checks: 45.

Tests passed: all 184 frontend/backend tests, all database checks, and all 45
hosted checks.

Tests failed: 0.

Tests skipped: 0.

## Root Verification

- `npm run lint` — passed.
- `npm run test` — passed.
- `npm run build` — passed.
- `npm run format:check` — passed.
- `git diff --check` — passed; informational Windows line-ending notices only.
- `npm run db:verify:hosted` — passed, 9 checks.
- `npm run auth:verify:hosted` — passed, 10 checks.
- `npm run profiles:verify:hosted` — passed, 7 checks.
- `npm run properties:verify:hosted` — passed, 8 checks.
- `npm run storage:setup:hosted` — passed.
- `npm run images:verify:hosted` — passed, 11 checks.

Manual bootstrap verification also confirmed a successful backend health
response and HTTP 200 from the live frontend login route. A connected browser
surface was unavailable for additional visual interaction; the production
build and five frontend image behavior tests provide the available UI
verification.

## Important Files Created

- `backend/scripts/setup-property-image-bucket.mjs`
- `backend/scripts/verify-hosted-property-images.mjs`
- `backend/src/controllers/propertyImageController.js`
- `backend/src/middleware/loadOwnedProperty.js`
- `backend/src/middleware/propertyImageUpload.js`
- `backend/src/repositories/propertyImageRepository.js`
- `backend/src/services/imageProcessor.js`
- `backend/src/services/propertyImageService.js`
- `backend/src/services/propertyImageStorageService.js`
- `backend/src/validators/propertyImageValidators.js`
- `backend/tests/helpers/createPropertyImageTestContext.js`
- `backend/tests/integration/propertyImageRoutes.test.js`
- `backend/tests/unit/imageProcessor.test.js`
- `frontend/src/components/property/PropertyImageManager.jsx`

## Important Files Modified

- `backend/src/app.js`
- `backend/src/controllers/propertyController.js`
- `backend/src/routes/index.js`
- `backend/src/routes/propertyRoutes.js`
- `backend/package.json`
- `frontend/src/pages/property/PropertyDetailPage.jsx`
- `frontend/src/services/apiClient.js`
- `frontend/src/services/propertyService.js`
- `frontend/src/styles.css`
- `frontend/tests/pages/Properties.test.jsx`
- `supabase/config.toml`
- `database/README.md`
- `docs/API_SPEC.md`
- `docs/SECURITY.md`
- `package.json`
- `package-lock.json`

## Security

- The bucket remains private.
- ACTIVE LANDLORD role and owner-scoped property checks precede multipart
  parsing and every mutation.
- Direct browser reads and mutations remain blocked by the absence of Storage
  object policies.
- Application RLS was not weakened.
- `SUPABASE_SECRET_KEY` remains backend-only and is absent from frontend runtime
  code.
- Passwords, tokens, credentials, raw provider errors, and Storage paths are
  not logged or returned.
- Actual file contents are decoded and validated; client claims are not trusted.
- Embedded metadata, including geolocation, is stripped before persistence.
- No identity, verification, financial, or other sensitive documents are
  accepted or stored.

## Known Limitations

- Listing/public image exposure is deferred to TASK-006.
- Advanced optimization such as responsive variants, adaptive delivery, and
  background processing is deferred.
- Batch upload is not required and was not added.
- Rate limiting remains a broader platform deployment control; this task
  enforces per-file byte/pixel and per-property count bounds.
- This environment had no connected browser surface for final visual QA; HTTP
  bootstrap, frontend integration tests, accessibility assertions, and the
  production build passed.

## Recommended Next Task

TASK-006 — Listing Management. Do not begin it automatically.
