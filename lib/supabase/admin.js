import { createClient } from '@supabase/supabase-js';

// Server-only client for Tasks/Roster data access, using the service role
// key (bypasses RLS by design) rather than a user session — mirrors the
// trust model the Google service account had for the Sheets it replaced.
// Never import this from client-side code; it must only run in API routes.
let client;

export function getSupabaseAdmin() {
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
  }
  return client;
}
