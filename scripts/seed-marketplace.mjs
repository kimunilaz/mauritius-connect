import process from 'node:process';
import { readFile } from 'node:fs/promises';
import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';
import {
  fixtures,
  imageManifest,
  seedMarketplace,
  storagePath,
  fixtureId,
} from '../database/seeds/marketplace/seed.mjs';

process.loadEnvFile('backend/.env');
process.loadEnvFile('backend/.env.integration');
if (!['development', 'test'].includes(process.env.NODE_ENV))
  throw new Error(
    'Marketplace fixtures are restricted to development/test environments.',
  );
const mode = process.argv[2] ?? 'verify';
if (!['create', 'refresh', 'remove', 'verify'].includes(mode))
  throw new Error('Use create, refresh, remove, or verify.');
const db = new Client({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000,
});
await db.connect();
try {
  const result = await db.query(
    `select lp.id from public.landlord_profiles lp join public.profiles p on p.id=lp.user_id join auth.users u on u.id=p.id where u.email=$1 and p.role='LANDLORD' and p.account_status='ACTIVE'`,
    [process.env.SUPABASE_TEST_LANDLORD_EMAIL],
  );
  if (result.rows.length !== 1)
    throw new Error(
      'A configured active integration-test landlord is required.',
    );
  const landlordId = result.rows[0].id;
  const ownership = await db.query(
    'select id from public.properties where id=any($1::uuid[]) and landlord_id<>$2',
    [fixtures.map((_, i) => fixtureId(1, i + 1)), landlordId],
  );
  if (ownership.rows.length)
    throw new Error(
      'Fixture ownership mismatch; no uploads or inventory changes were made.',
    );
  if (['create', 'refresh'].includes(mode)) {
    const storage = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SECRET_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    ).storage.from('property-images');
    // Read all assets before any writes; missing downloads cannot create empty cards.
    const bytes = new Map(
      await Promise.all(
        imageManifest.sources.map(async (source) => [
          source.id,
          await readFile(
            new URL(
              `../database/seeds/marketplace/images/${source.filename}`,
              import.meta.url,
            ),
          ),
        ]),
      ),
    );
    for (const [i, assignment] of imageManifest.assignments.entries()) {
      for (const photo of assignment.images) {
        const { error } = await storage.upload(
          storagePath(i + 1, photo),
          bytes.get(photo),
          { contentType: 'image/jpeg', upsert: true, cacheControl: '3600' },
        );
        if (error)
          throw new Error(
            `Demo photo upload failed for ${assignment.demo_id}: ${error.message}`,
          );
      }
    }
    await seedMarketplace(db, landlordId);
  } else if (mode === 'remove')
    await seedMarketplace(db, landlordId, { remove: true });
  const ids = fixtures.map((_, i) => fixtureId(2, i + 1));
  const { rows } = await db.query(
    `select l.status,count(*) from public.listings l where l.id=any($1::uuid[]) group by l.status`,
    [ids],
  );
  const images = await db.query(
    'select count(*) from public.property_images where property_id=any($1::uuid[])',
    [fixtures.map((_, i) => fixtureId(1, i + 1))],
  );
  console.log(
    JSON.stringify(
      { mode, listings: rows, images: Number(images.rows[0].count) },
      null,
      2,
    ),
  );
} finally {
  await db.end();
}
