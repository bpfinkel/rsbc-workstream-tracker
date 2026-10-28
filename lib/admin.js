// Single place to manage sitewide admin access — the Drafts review queue
// (middleware.js) and the RFP Scoring admin panel (submission status,
// interview-unlock toggle) both gate on this list. Add or remove an email
// here to change access everywhere at once.
export const ADMIN_EMAILS = ['bfinkel.rsbc@gmail.com', 'spezdek.rsbc@gmail.com'];

export function isAdmin(email) {
  return !!email && ADMIN_EMAILS.includes(email);
}

// Invoices are edited (accepted from the review queue, moved through approval
// and payment, contract figures adjusted) by the admins plus the committee's
// BET representative. Everyone else can view them. Compared case-insensitively
// because Supabase stores sign-in emails in lowercase.
export const INVOICE_EDITOR_EMAILS = [...ADMIN_EMAILS, 'doug.fenton.BET@greenwichct.gov'];

export function canEditInvoices(email) {
  const e = String(email || '').toLowerCase();
  return !!e && INVOICE_EDITOR_EMAILS.some((x) => x.toLowerCase() === e);
}
