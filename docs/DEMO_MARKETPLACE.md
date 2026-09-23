# Marketplace development fixtures

The homepage follows `tasks/CURRENT_TASK.md`: compact search, available homes, locations, affordable homes, Moka/Ebene, recently published homes, then a short explanation. Every card uses the existing public rental API, including its ACTIVE-only and archived-property eligibility checks. No fixture data is imported by the frontend. Empty and failed requests show real states with retry controls.

## Create and refresh

From the repository root, use Node 24 with installed workspace dependencies:

```sh
npm run demo:images
npm run demo:seed
npm run demo:verify
npm run demo:refresh
```

The scripts read `backend/.env` and `backend/.env.integration`. They require a development/test `NODE_ENV`, `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, and `SUPABASE_TEST_LANDLORD_EMAIL` identifying an existing active controlled landlord. The existing private `property-images` bucket must be configured. No credentials are written to manifests or frontend code. Downloading needs access only to the selected Pexels image URLs. Creating/refreshing needs database and private storage access.

This is an explicit development fixture loader, like `development_seed.sql`, not a public publishing endpoint. New fixtures start ACTIVE, with actual insertion/publication timestamps. It does not modify auth identities, roles, verification flags, RLS, policies, or the normal DRAFT → PENDING_REVIEW → admin approval workflow. Do not use the loader against genuine beta/production inventory.

IDs use the reserved `27a00000-0000-4000-8000-` prefix: property suffixes 001001–001020, listing suffixes 002001–002020, and image suffixes 003010–003202. Private addresses contain `Fictional fixture MC27-XX`. The 20 exact baseline records are in `database/seeds/marketplace/listings.json`.

Repeated or concurrent seeds cannot add duplicate properties, listings or gallery records: deterministic primary keys, storage paths, a database transaction and an advisory lock enforce this. Refresh updates content and rent but preserves lifecycle state, archived flags, available dates and publication timestamps. It never reactivates a paused, rented, closed or archived home. A failed database write rolls back the entire inventory transaction; uploaded fixture objects can be safely reused on retry.

The existing furnishing field is boolean. Fully furnished fixtures use true; partly furnished and unfurnished fixtures use false. Partial furnishing is stated in the natural description, and cards do not incorrectly label false as unfurnished. The detailed baseline contains 3 studios, 6 one-bedroom, 7 two-bedroom and 4 three-bedroom homes; those exact records take precedence over the task's approximate aggregate counts.

## Remove from the marketplace

```sh
npm run demo:remove
```

Removal is recoverable: it closes eligible MC27 listings and archives only their 20 properties after checking ownership. It preserves all applications, conversations, images and history. It does not delete accounts, wipe storage, or affect other inventory. Rerunning refresh intentionally leaves these archived records hidden. Restoring removed fixtures requires explicit developer review of their states and the existing listing approval workflow; there is no generic production cleanup or automatic unarchive command.

## Checks

```sh
node database/tests/marketplace-seed.test.mjs
npm run test --workspace frontend
npm run build
```

The database test applies the actual migrations in an isolated in-memory PostgreSQL instance, seeds twice, checks 20 properties / 20 listings / 60 images, timestamp stability, ownership checks, paused-state preservation and recoverable removal. Only the advisory lock is skipped because that test database has one session.

See [the image manifest](DEMO_LISTING_IMAGES.md) for stock-photo limitations, creator credits and usage bases. Photos depict real spaces but not the fictional addresses.
