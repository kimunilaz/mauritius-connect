import { readFile } from 'node:fs/promises';

export const fixtures = JSON.parse(
  await readFile(new URL('./listings.json', import.meta.url), 'utf8'),
);
export const imageManifest = JSON.parse(
  await readFile(new URL('./images.json', import.meta.url), 'utf8'),
);
export const fixtureId = (kind, index) =>
  `27a00000-0000-4000-8000-${String(kind * 1000 + index).padStart(12, '0')}`;
export const storagePath = (index, photo) =>
  `demo/mc27/${fixtureId(1, index)}/pexels-${photo}.jpg`;

// The caller supplies an existing controlled landlord. No identities, roles,
// verification claims, policies, or application state rules are changed here.
export async function seedMarketplace(db, landlordId, { remove = false } = {}) {
  await db.query('begin');
  try {
    // Serialize seed runs, including concurrent invocations.
    await db.query('select pg_advisory_xact_lock(270027)');
    for (let index = 1; index <= fixtures.length; index++) {
      const f = fixtures[index - 1];
      const propertyId = fixtureId(1, index);
      const listingId = fixtureId(2, index);
      const existingListing = await db.query(
        'select property_id from public.listings where id=$1',
        [listingId],
      );
      if (
        existingListing.rows.length &&
        existingListing.rows[0].property_id !== propertyId
      )
        throw new Error(`Fixture listing mismatch: ${f.demo_id}`);
      const existing = await db.query(
        'select landlord_id from public.properties where id=$1',
        [propertyId],
      );
      if (existing.rows.length && existing.rows[0].landlord_id !== landlordId)
        throw new Error(`Fixture ownership mismatch: ${f.demo_id}`);
      if (remove) {
        // Recoverable removal: preserve references, applications and photos.
        await db.query(
          "update public.listings set status='CLOSED',closed_at=coalesce(closed_at,now()) where id=$1 and property_id=$2 and status in ('DRAFT','PENDING_REVIEW','ACTIVE','PAUSED')",
          [listingId, propertyId],
        );
        await db.query(
          'update public.properties set archived_at=coalesce(archived_at,now()) where id=$1 and landlord_id=$2',
          [propertyId, landlordId],
        );
        continue;
      }
      await db.query(
        `insert into public.properties (id,landlord_id,property_type,address_line_1,district,locality,bedrooms,bathrooms,furnished,parking_spaces)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        on conflict(id) do update set property_type=excluded.property_type,district=excluded.district,locality=excluded.locality,bedrooms=excluded.bedrooms,bathrooms=excluded.bathrooms,furnished=excluded.furnished,parking_spaces=excluded.parking_spaces`,
        [
          propertyId,
          landlordId,
          f.property_type,
          `Fictional fixture ${f.demo_id}`,
          f.district,
          f.locality,
          f.bedrooms,
          f.bathrooms,
          f.furnishing === 'Furnished',
          f.parking_spaces,
        ],
      );
      // Initial ACTIVE state is an explicit development fixture, just like the
      // existing development_seed.sql. Refresh NEVER reactivates moderated,
      // paused, rented, closed, or archived inventory or changes publication time.
      await db.query(
        `insert into public.listings (id,property_id,title,description,monthly_rent,deposit_amount,available_from,minimum_lease_months,maximum_occupants,status,published_at)
        values ($1,$2,$3,$4,$5,$5,current_date,12,$6,'ACTIVE',now())
        on conflict(id) do update set title=excluded.title,description=excluded.description,monthly_rent=excluded.monthly_rent,deposit_amount=excluded.deposit_amount`,
        [
          listingId,
          propertyId,
          f.title,
          f.description,
          f.monthly_rent,
          Math.max(1, f.bedrooms * 2),
        ],
      );
      const assignment = imageManifest.assignments[index - 1];
      for (const [position, photo] of assignment.images.entries()) {
        await db.query(
          `insert into public.property_images (id,property_id,storage_path,display_order,is_cover)
          values ($1,$2,$3,$4,$5) on conflict(id) do update set storage_path=excluded.storage_path where property_images.property_id=excluded.property_id`,
          [
            fixtureId(3, index * 10 + position),
            propertyId,
            storagePath(index, photo),
            position,
            position === 0,
          ],
        );
      }
    }
    await db.query('commit');
  } catch (error) {
    await db.query('rollback');
    throw error;
  }
}
