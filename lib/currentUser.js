import { createClient } from './supabase/client';

// The signed-in member's email, for what the browser shows: the greeting, the
// Admin links, "assigned to me". Read once per tab from the session cookie
// with getSession(), which needs no network call, and shared by every caller,
// instead of Header and each page separately asking Supabase's auth server.
//
// Nothing relies on this for access. middleware.js verifies the user with
// Supabase on every request, and the API routes enforce who may see or change
// what.
let pending;

export function getCurrentEmail() {
  if (!pending) {
    pending = createClient()
      .auth.getSession()
      .then(({ data }) => data?.session?.user?.email || null)
      .catch(() => null)
      .then((email) => {
        // Signed out (e.g. Header on the login page): don't remember that, so
        // the first page after signing in reads the new session.
        if (!email) pending = undefined;
        return email;
      });
  }
  return pending;
}

export function forgetCurrentUser() {
  pending = undefined;
}
