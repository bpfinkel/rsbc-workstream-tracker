// The verified user, handed from middleware.js to the API routes (see
// lib/supabase/server.js) so they don't ask Supabase's auth server a second
// time. middleware.js always overwrites both, so a value sent by the browser
// never counts.
export const USER_ID_HEADER = 'x-rsbc-user-id';
export const USER_EMAIL_HEADER = 'x-rsbc-user-email';
