// Single place to manage sitewide admin access — the Drafts review queue
// (middleware.js) and the RFP Scoring admin panel (submission status,
// interview-unlock toggle) both gate on this list. Add or remove an email
// here to change access everywhere at once.
export const ADMIN_EMAILS = ['bfinkel.rsbc@gmail.com', 'spezdek.rsbc@gmail.com'];

export function isAdmin(email) {
  return !!email && ADMIN_EMAILS.includes(email);
}
