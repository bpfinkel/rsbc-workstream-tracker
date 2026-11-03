// Single place to manage sitewide admin access — the Drafts review queue
// (middleware.js) and the RFP Scoring admin panel (submission status,
// interview-unlock toggle) both gate on this list. Add or remove an email
// here to change access everywhere at once.
export const ADMIN_EMAILS = ['bfinkel.rsbc@gmail.com', 'spezdek.rsbc@gmail.com'];

export function isAdmin(email) {
  return !!email && ADMIN_EMAILS.includes(email);
}

// The Owner's Representative signs in to a narrower portal (see LIMITED_*
// below) and also edits invoices. Add their sign-in email here; it must match
// the address on their Supabase account.
export const OWNERS_REP_EMAILS = [];

// Invoices are edited (accepted from the review queue, moved through approval
// and payment, contract figures adjusted) by the admins, the committee's BET
// representative and the Owner's Representative. Everyone else can view them.
// Compared case-insensitively because Supabase stores sign-in emails in
// lowercase.
export const INVOICE_EDITOR_EMAILS = [...ADMIN_EMAILS, 'doug.fenton.BET@greenwichct.gov', ...OWNERS_REP_EMAILS];

export function canEditInvoices(email) {
  const e = String(email || '').toLowerCase();
  return !!e && INVOICE_EDITOR_EMAILS.some((x) => x.toLowerCase() === e);
}

// Limited access: project partners who are not committee members see only
// Home, Meetings, Key Documents, Invoices and My Account. middleware.js
// blocks every other page and API route for them; the menus and Home just
// stop showing the rest. Roster contacts, tasks, scoring and interview notes
// stay committee-only.
export const LIMITED_EMAILS = [...OWNERS_REP_EMAILS];

export const LIMITED_PAGES = ['/', '/meetings', '/key-documents', '/invoices', '/my-account', '/change-password'];
export const LIMITED_APIS = ['/api/meetings', '/api/key-documents', '/api/invoices'];

export function isLimited(email) {
  const e = String(email || '').toLowerCase();
  return !!e && LIMITED_EMAILS.some((x) => x.toLowerCase() === e);
}

export function limitedMayOpen(pathname) {
  if (LIMITED_PAGES.includes(pathname)) return true;
  return LIMITED_APIS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}
