import { getSupabaseAdmin } from './supabase/admin';

// Invoices and the contracts they bill against, in the Supabase `contracts`
// and `invoices` tables (RLS on, no policies; only this service-role client
// touches them, and pages/api/invoices.js decides who may change what).
//
// New invoices arrive with status 'pending': the rsbc-invoice-intake skill
// reads each PDF filed under Financial/Invoices in Drive and inserts what it
// finds. An invoice editor checks the figures and accepts it into the ledger
// ('received'), and it then moves through approval and payment.

export const STATUS_LABELS = {
  pending: 'Pending review',
  received: 'Received',
  approved: 'Approved',
  submitted: 'Submitted to Town',
  paid: 'Paid',
  rejected: 'Rejected'
};

// The ledger: invoices accepted from review. Pending and rejected ones never
// count toward a total.
export const LEDGER_STATUSES = ['received', 'approved', 'submitted', 'paid'];
const UNPAID_STATUSES = ['received', 'approved', 'submitted'];

// An unpaid invoice is flagged once this many days have passed since its
// invoice date; vendors' terms are "due within 30 days" or "upon receipt".
export const OVERDUE_DAYS = 30;

// Unbilled work is estimated from the vendor's average monthly fees over its
// most recent invoices, carried forward from the end of the period the latest
// invoice covers. An editor can replace the estimate per contract.
const RUN_RATE_INVOICES = 3;
const DAYS_PER_MONTH = 365.25 / 12;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function money(v) {
  return v === null || v === undefined || v === '' ? null : Math.round(Number(v) * 100) / 100;
}

function contractFromRow(r) {
  return {
    id: r.id,
    vendor: r.vendor,
    role: r.role || '',
    contractNumber: r.contract_number || '',
    contractAmount: money(r.contract_amount),
    unbilledOverride: money(r.unbilled_override),
    unbilledOverrideNote: r.unbilled_override_note || '',
    sortOrder: r.sort_order || 0
  };
}

function invoiceFromRow(r) {
  return {
    id: r.id,
    contractId: r.contract_id,
    vendor: r.vendor,
    invoiceNumber: r.invoice_number,
    invoiceDate: r.invoice_date || '',
    periodEnd: r.period_end || '',
    feeAmount: money(r.fee_amount) || 0,
    expenseAmount: money(r.expense_amount) || 0,
    totalAmount: money(r.total_amount) || 0,
    billedToDate: money(r.billed_to_date),
    driveLink: r.drive_link || '',
    status: r.status,
    paidDate: r.paid_date || '',
    notes: r.notes || '',
    history: Array.isArray(r.history) ? r.history : [],
    createdAt: r.created_at
  };
}

export async function listContracts() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('contracts').select('*').order('sort_order', { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []).map(contractFromRow);
}

export async function listInvoices() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('invoices').select('*').order('invoice_date', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map(invoiceFromRow);
}

export function todayET() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

function daysBetween(fromIso, toIso) {
  return Math.round((Date.parse(toIso + 'T00:00:00Z') - Date.parse(fromIso + 'T00:00:00Z')) / 86400000);
}

function sum(list, pick) {
  return Math.round(list.reduce((n, x) => n + (pick(x) || 0), 0) * 100) / 100;
}

// Latest first: by the end of the period billed, falling back to the invoice date.
function byPeriodDesc(a, b) {
  return String(b.periodEnd || b.invoiceDate).localeCompare(String(a.periodEnd || a.invoiceDate));
}

export function isOverdue(invoice, today) {
  return UNPAID_STATUSES.includes(invoice.status) && !!invoice.invoiceDate && daysBetween(invoice.invoiceDate, today) > OVERDUE_DAYS;
}

// Everything the dashboard shows, computed from the ledger so the page and
// any future report agree on the same numbers.
export function summarize(contracts, invoices, today = todayET()) {
  const ledger = invoices.filter((i) => LEDGER_STATUSES.includes(i.status));
  const unpaid = ledger.filter((i) => UNPAID_STATUSES.includes(i.status));
  const overdue = unpaid.filter((i) => isOverdue(i, today));

  const perContract = contracts.map((c) => {
    const mine = ledger.filter((i) => i.contractId === c.id).sort(byPeriodDesc);
    // Fees billed to date: the cumulative figure the vendor prints on its
    // latest invoice when it prints one (QA+M does), otherwise the sum of fees.
    const latest = mine[0] || null;
    const feesBilled = latest && latest.billedToDate !== null ? latest.billedToDate : sum(mine, (i) => i.feeAmount);
    const remaining = c.contractAmount === null ? null : Math.round((c.contractAmount - feesBilled) * 100) / 100;

    let estimate = 0;
    if (latest) {
      const recent = mine.slice(0, RUN_RATE_INVOICES);
      const avgMonthlyFee = sum(recent, (i) => i.feeAmount) / recent.length;
      const since = latest.periodEnd || latest.invoiceDate;
      const months = since ? Math.max(0, daysBetween(since, today)) / DAYS_PER_MONTH : 0;
      estimate = avgMonthlyFee * months;
      if (remaining !== null) estimate = Math.min(estimate, Math.max(0, remaining));
      estimate = Math.round(estimate * 100) / 100;
    }
    const unbilled = c.unbilledOverride !== null ? c.unbilledOverride : estimate;

    return {
      ...c,
      invoiceCount: mine.length,
      feesBilled,
      remaining,
      paid: sum(mine.filter((i) => i.status === 'paid'), (i) => i.totalAmount),
      unpaid: sum(mine.filter((i) => UNPAID_STATUSES.includes(i.status)), (i) => i.totalAmount),
      billedThrough: latest ? latest.periodEnd || latest.invoiceDate : '',
      unbilledEstimate: estimate,
      unbilled,
      unbilledIsOverride: c.unbilledOverride !== null
    };
  });

  return {
    today,
    paidToDate: sum(ledger.filter((i) => i.status === 'paid'), (i) => i.totalAmount),
    invoicedUnpaid: sum(unpaid, (i) => i.totalAmount),
    estimatedUnbilled: sum(perContract, (c) => c.unbilled),
    overdueCount: overdue.length,
    overdueTotal: sum(overdue, (i) => i.totalAmount),
    contracts: perContract
  };
}

function historyEntry(action, actor, detail) {
  return { at: new Date().toISOString(), by: actor, action, ...(detail ? { detail } : {}) };
}

async function getInvoiceRow(id) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('invoices').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Invoice not found');
  return data;
}

// The figures an editor may correct, typically while reviewing what the
// intake skill read off the PDF.
export function cleanInvoiceFields(fields) {
  const out = {};
  if (fields.contractId !== undefined) out.contract_id = fields.contractId || null;
  if (fields.invoiceNumber !== undefined) out.invoice_number = String(fields.invoiceNumber).trim().slice(0, 60);
  ['invoiceDate', 'periodEnd'].forEach((k) => {
    if (fields[k] === undefined) return;
    const col = k === 'invoiceDate' ? 'invoice_date' : 'period_end';
    if (fields[k] && !DATE_RE.test(fields[k])) throw new Error(`${k} must be a date`);
    out[col] = fields[k] || null;
  });
  [['feeAmount', 'fee_amount'], ['expenseAmount', 'expense_amount'], ['totalAmount', 'total_amount'], ['billedToDate', 'billed_to_date']].forEach(([k, col]) => {
    if (fields[k] === undefined) return;
    const v = money(fields[k]);
    if (v !== null && !Number.isFinite(v)) throw new Error(`${k} must be a number`);
    if (v === null && col !== 'billed_to_date') throw new Error(`${k} is required`);
    out[col] = v;
  });
  if (fields.notes !== undefined) out.notes = String(fields.notes).slice(0, 2000);
  return out;
}

export async function updateInvoice(id, fields, actor) {
  const row = await getInvoiceRow(id);
  const patch = cleanInvoiceFields(fields);
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('invoices')
    .update({ ...patch, history: [...(row.history || []), historyEntry('edit', actor)], updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return invoiceFromRow(data);
}

export async function setInvoiceStatus(id, status, actor, { paidDate } = {}) {
  if (!STATUS_LABELS[status]) throw new Error('Invalid status');
  if (paidDate && !DATE_RE.test(paidDate)) throw new Error('Paid date must be a date');
  const row = await getInvoiceRow(id);
  if (status === 'paid' && !paidDate) paidDate = todayET();
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('invoices')
    .update({
      status,
      paid_date: status === 'paid' ? paidDate : null,
      history: [...(row.history || []), historyEntry('status', actor, `${row.status} → ${status}`)],
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return invoiceFromRow(data);
}

export async function updateContract(id, fields) {
  const patch = { updated_at: new Date().toISOString() };
  if (fields.role !== undefined) patch.role = String(fields.role).slice(0, 120);
  if (fields.contractNumber !== undefined) patch.contract_number = String(fields.contractNumber).slice(0, 60);
  [['contractAmount', 'contract_amount'], ['unbilledOverride', 'unbilled_override']].forEach(([k, col]) => {
    if (fields[k] === undefined) return;
    const v = money(fields[k]);
    if (v !== null && !Number.isFinite(v)) throw new Error(`${k} must be a number`);
    patch[col] = v;
  });
  if (fields.unbilledOverrideNote !== undefined) patch.unbilled_override_note = String(fields.unbilledOverrideNote).slice(0, 500);
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('contracts').update(patch).eq('id', id).select().single();
  if (error) throw new Error(error.message);
  return contractFromRow(data);
}

export async function addContract(fields) {
  const vendor = String(fields.vendor || '').trim();
  if (!vendor) throw new Error('Vendor is required');
  const supabase = getSupabaseAdmin();
  const { data: last } = await supabase.from('contracts').select('sort_order').order('sort_order', { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await supabase
    .from('contracts')
    .insert({ vendor, sort_order: (last?.sort_order || 0) + 1 })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return updateContract(data.id, fields);
}
