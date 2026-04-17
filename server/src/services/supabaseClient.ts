import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Ensure .env is loaded before we read env vars.
// dotenv.config() is idempotent — existing env vars are never overwritten.
// This call is here rather than only in index.ts because module imports are
// resolved (and module code runs) before the function body of index.ts executes.
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const supabaseUrl = process.env['SUPABASE_URL'];
const supabaseServiceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
const supabaseAnonKey = process.env['SUPABASE_ANON_KEY'];

if (!supabaseUrl) {
  throw new Error('Missing environment variable: SUPABASE_URL');
}

// Prefer the service-role key (bypasses RLS). Fall back to anon key for tables
// with a public allow-read RLS policy. If neither is set, fail loudly at startup.
const resolvedKey = supabaseServiceRoleKey ?? supabaseAnonKey;
if (!resolvedKey) {
  throw new Error(
    'Missing environment variable: set SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY as fallback).'
  );
}

// Singleton — module-level reference, created once per process.
const supabase: SupabaseClient = createClient(supabaseUrl, resolvedKey, {
  auth: {
    // Disable automatic session persistence — this is a server-side client.
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

export default supabase;
