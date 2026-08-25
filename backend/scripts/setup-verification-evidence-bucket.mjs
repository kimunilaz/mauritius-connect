import console from 'node:console';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';
process.loadEnvFile('backend/.env');
const required = ['SUPABASE_URL', 'SUPABASE_SECRET_KEY'];
const missing = required.filter((x) => !process.env[x]);
if (missing.length) {
  console.error(`Verification bucket setup requires: ${missing.join(', ')}.`);
  process.exitCode = 1;
} else {
  const c = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY,
    { auth: { persistSession: false } },
  );
  const cfg = {
    public: false,
    fileSizeLimit: 10 * 1024 * 1024,
    allowedMimeTypes: [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
    ],
  };
  const { data, error } = await c.storage.listBuckets();
  if (error) throw error;
  const exists = data.some((b) => b.id === 'verification-evidence');
  const result = exists
    ? await c.storage.updateBucket('verification-evidence', cfg)
    : await c.storage.createBucket('verification-evidence', cfg);
  if (result.error) throw result.error;
  console.log('Private verification evidence bucket configuration verified.');
}
