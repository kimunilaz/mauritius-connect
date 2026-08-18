import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

function requireConfiguration(entries) {
  const missingVariables = entries
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missingVariables.length > 0) {
    throw new Error(
      `Supabase client requires: ${missingVariables.join(', ')}.`,
    );
  }
}

export function createUserSupabaseClient(accessToken) {
  requireConfiguration([
    ['SUPABASE_URL', env.supabaseUrl],
    ['SUPABASE_PUBLISHABLE_KEY', env.supabasePublishableKey],
  ]);

  if (!accessToken) {
    throw new Error('A user access token is required.');
  }

  return createClient(env.supabaseUrl, env.supabasePublishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

let privilegedClient;

export function getPrivilegedSupabaseClient() {
  requireConfiguration([
    ['SUPABASE_URL', env.supabaseUrl],
    ['SUPABASE_SECRET_KEY', env.supabaseSecretKey],
  ]);

  privilegedClient ??= createClient(env.supabaseUrl, env.supabaseSecretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return privilegedClient;
}
