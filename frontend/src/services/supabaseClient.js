import { createClient } from '@supabase/supabase-js';

const viteEnvironment = import.meta.env ?? {};
const supabaseUrl = viteEnvironment.VITE_SUPABASE_URL;
const supabasePublishableKey = viteEnvironment.VITE_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabasePublishableKey,
);

let supabaseClient;

export function getSupabaseClient() {
  if (!isSupabaseConfigured) {
    throw new Error(
      'Supabase client requires VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.',
    );
  }

  supabaseClient ??= createClient(supabaseUrl, supabasePublishableKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'implicit',
      persistSession: true,
    },
  });

  return supabaseClient;
}
