import console from 'node:console';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

process.loadEnvFile('backend/.env');

const required = ['SUPABASE_URL', 'SUPABASE_SECRET_KEY'];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) {
  console.error(`Property image bucket setup requires: ${missing.join(', ')}.`);
  process.exitCode = 1;
} else {
  const client = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY,
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    },
  );
  const configuration = {
    public: false,
    fileSizeLimit: 10 * 1024 * 1024,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  };
  const { data: buckets, error: readError } =
    await client.storage.listBuckets();
  if (readError) {
    throw new Error('Unable to inspect the property image bucket.');
  }
  const existing = buckets.some((bucket) => bucket.id === 'property-images');

  const { error } = existing
    ? await client.storage.updateBucket('property-images', configuration)
    : await client.storage.createBucket('property-images', configuration);
  if (error) throw new Error('Unable to configure the property image bucket.');

  console.log('Private property image bucket configuration verified.');
}
