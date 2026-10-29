import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Header from '../components/Header';
import { driveEmbedUrl } from '../lib/driveEmbed';
import { useModalViewportLock } from '../lib/useViewportLock';
import { loadJson, loadWithCache } from '../lib/dataCache';

// Mirrors lib/invoices.js (which imports the server-only Supabase client, so
// the page can't import it directly).
const STATUS_LABELS = {
  pending: 'Pending review',
  received: 'Received',
  approved: 'Approved',
  submitted: 'Submitted to Town',
  paid: 'Paid',
  rejected: 'Rejected'
};
const LEDGER_FLOW = ['received', 'approved', 'submitted', 'paid'];
const OVERDUE_DAYS = 30;

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const usdWhole = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

function ChevronIcon({ open, className }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}
      style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform .15s', flexShrink: 0 }}>
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function money(n) {
  return n === null || n === undefined ? '—' : usd.format(n);
}

function moneyWhole(n) {
  return n === null || n === undefined ? '—' : usdWhole.format(n);
}

function formatDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function daysSince(iso, today) {
  return Math.round((Date.parse(today + 'T00:00:00Z') - Date.parse(iso + 'T00:00:00Z')) / 86400000);
}

function isOverdue(inv, today) {
  return ['received', 'approved', 'submitted'].includes(inv.status) && !!inv.invoiceDate && daysSince(inv.invoiceDate, today) > OVERDUE_DAYS;
}

function ChevronDownIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
  );
}

// The editable figures, as strings for the form fields.
function formFromInvoice(inv) {
  const s = (v) => (v === null || v === undefined ? '' : String(v));
  return {
    contractId: inv.contractId || '',
    invoiceNumber: inv.invoiceNumber || '',
    invoiceDate: inv.invoiceDate || '',
    periodEnd: inv.periodEnd || '',
    feeAmount: s(inv.feeAmount),
    expenseAmount: s(inv.expenseAmount),
    totalAmount: s(inv.totalAmount),
    billedToDate: s(inv.billedToDate),
    notes: inv.notes || ''
  };
}

function InvoiceFields({ form, setForm, contracts }) {
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <>
      <div className="row2">
        <div className="field">
          <label>Contract</label>
          <select value={form.contractId} onChange={set('contractId')}>
            <option value="">Not linked</option>
            {contracts.map((c) => <option key={c.id} value={c.id}>{c.vendor}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Invoice number</label>
          <input type="text" value={form.invoiceNumber} onChange={set('invoiceNumber')} />
        </div>
      </div>
      <div className="row2">
        <div className="field">
          <label>Invoice date</label>
          <input type="date" value={form.invoiceDate} onChange={set('invoiceDate')} />
        </div>
        <div className="field">
          <label>Services through</label>
          <input type="date" value={form.periodEnd} onChange={set('periodEnd')} />
        </div>
      </div>
      <div className="row2">
        <div className="field">
          <label>Fees</label>
          <input type="number" step="0.01" value={form.feeAmount} onChange={set('feeAmount')} />
        </div>
        <div className="field">
          <label>Expenses</label>
          <input type="number" step="0.01" value={form.expenseAmount} onChange={set('expenseAmount')} />
        </div>
      </div>
      <div className="row2">
        <div className="field">
          <label>Invoice total</label>
          <input type="number" step="0.01" value={form.totalAmount} onChange={set('totalAmount')} />
        </div>
        <div className="field">
          <label>Fees billed to date</label>
          <input type="number" step="0.01" value={form.billedToDate} onChange={set('billedToDate')} placeholder="If printed on invoice" />
        </div>
      </div>
      <div className="field">
        <label>Notes</label>
        <textarea value={form.notes} onChange={set('notes')} />
      </div>
    </>
  );
}

export default function InvoicesPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [filterVendor, setFilterVendor] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [pdfViewer, setPdfViewer] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailForm, setDetailForm] = useState(null);
  const [paidDate, setPaidDate] = useState('');
  const [reviewForms, setReviewForms] = useState({});
  const [pendingOpen, setPendingOpen] = useState(true);
  const [contractEdit, setContractEdit] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadWithCache('/api/invoices', setData).catch((e) => setError(e.message));
  }, []);

  useModalViewportLock(!!pdfViewer || !!detail || !!contractEdit);

  const summary = data?.summary;
  const today = summary?.today || '';
  const canEdit = !!data?.canEdit;
  const invoices = data?.invoices || [];
  const contracts = summary?.contracts || [];
  const pending = invoices.filter((i) => i.status === 'pending');

  // Each pending invoice gets its own editable copy of what intake read.
  useEffect(() => {
    setReviewForms((prev) => {
      const next = {};
      pending.forEach((i) => { next[i.id] = prev[i.id] || formFromInvoice(i); });
      return next;
    });
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const vendors = useMemo(() => Array.from(new Set(invoices.map((i) => i.vendor))).sort(), [invoices]);

  const listed = useMemo(() => {
    return invoices
      .filter((i) => i.status !== 'pending')
      .filter((i) => !filterVendor || i.vendor === filterVendor)
      .filter((i) => (filterStatus ? i.status === filterStatus : i.status !== 'rejected'))
      .filter((i) => !onlyOverdue || isOverdue(i, today));
  }, [invoices, filterVendor, filterStatus, onlyOverdue, today]);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 2400);
  }

  async function post(body) {
    setBusy(true);
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const out = await res.json();
      if (!res.ok) throw new Error(out.error || 'Request failed');
      setData(await loadJson('/api/invoices', { force: true }));
      return out;
    } finally {
      setBusy(false);
    }
  }

  async function acceptPending(inv) {
    try {
      await post({ action: 'update', id: inv.id, fields: reviewForms[inv.id] });
      await post({ action: 'status', id: inv.id, status: 'received' });
      showToast(`Invoice ${reviewForms[inv.id].invoiceNumber} added to the ledger`);
    } catch (e) {
      showToast('Error: ' + e.message);
    }
  }

  async function rejectPending(inv) {
    if (!confirm(`Reject invoice ${inv.invoiceNumber}? It won't count toward any total.`)) return;
    try {
      await post({ action: 'status', id: inv.id, status: 'rejected' });
      showToast('Invoice rejected');
    } catch (e) {
      showToast('Error: ' + e.message);
    }
  }

  function openDetail(inv) {
    setDetail(inv);
    setDetailForm(formFromInvoice(inv));
    setPaidDate(inv.paidDate || today);
  }

  async function saveDetail() {
    try {
      const out = await post({ action: 'update', id: detail.id, fields: detailForm });
      setDetail(out.invoice);
      showToast('Invoice updated');
    } catch (e) {
      showToast('Error: ' + e.message);
    }
  }

  async function changeStatus(status) {
    try {
      const out = await post({ action: 'status', id: detail.id, status, paidDate: status === 'paid' ? paidDate : undefined });
      setDetail(out.invoice);
      showToast(`Marked ${STATUS_LABELS[status].toLowerCase()}`);
    } catch (e) {
      showToast('Error: ' + e.message);
    }
  }

  function openContractEdit(c) {
    const s = (v) => (v === null || v === undefined ? '' : String(v));
    setContractEdit({
      id: c ? c.id : null,
      vendor: c ? c.vendor : '',
      role: c ? c.role : '',
      contractNumber: c ? c.contractNumber : '',
      contractAmount: c ? s(c.contractAmount) : '',
      unbilledOverride: c ? s(c.unbilledOverride) : '',
      unbilledOverrideNote: c ? c.unbilledOverrideNote : '',
      estimate: c ? c.unbilledEstimate : null
    });
  }

  async function saveContract() {
    const { id, vendor, estimate, ...fields } = contractEdit;
    try {
      if (id) await post({ action: 'update-contract', id, fields });
      else await post({ action: 'add-contract', fields: { vendor, ...fields } });
      setContractEdit(null);
      showToast('Contract saved');
    } catch (e) {
      showToast('Error: ' + e.message);
    }
  }

  const detailIndex = detail ? LEDGER_FLOW.indexOf(detail.status) : -1;
  const nextStatus = detailIndex >= 0 && detailIndex < LEDGER_FLOW.length - 1 ? LEDGER_FLOW[detailIndex + 1] : null;
  const capped = contracts.filter((c) => c.contractAmount !== null);

  return (
    <>
      <Head>
        <title>Riverside School Building Committee — Invoices</title>
      </Head>
      <Header active="invoices" />

      <main className="inv-page">
        {error ? (
          <div className="empty">Error: {error}</div>
        ) : !summary ? null : (
          <>
            <div className="inv-tiles">
              <div className="inv-tile paid">
                <div className="inv-tile-label">Paid to date</div>
                <div className="inv-tile-value">{moneyWhole(summary.paidToDate)}</div>
                <div className="inv-tile-note">Invoices the Town has paid</div>
              </div>
              <div className="inv-tile accrue">
                <div className="inv-tile-label">To accrue</div>
                <div className="inv-tile-value">{moneyWhole(summary.invoicedUnpaid + summary.estimatedUnbilled)}</div>
                <div className="inv-tile-note">
                  {moneyWhole(summary.invoicedUnpaid)} invoiced, not yet paid
                  <br />+ {moneyWhole(summary.estimatedUnbilled)} estimated unbilled work
                </div>
              </div>
              <div className="inv-tile balance">
                <div className="inv-tile-label">Contract balance</div>
                <div className="inv-tile-value">{moneyWhole(capped.reduce((n, c) => n + c.remaining, 0))}</div>
                <div className="inv-tile-note">
                  {capped.length
                    ? capped.map((c) => `${c.vendor}: ${moneyWhole(c.remaining)} of ${moneyWhole(c.contractAmount)}`).join(' · ')
                    : 'No fixed-amount contracts yet'}
                </div>
              </div>
              <button
                type="button"
                className={'inv-tile overdue' + (summary.overdueCount ? ' has' : '') + (onlyOverdue ? ' active' : '')}
                onClick={() => setOnlyOverdue((v) => !v)}
                aria-pressed={onlyOverdue}
              >
                <div className="inv-tile-label">Over {OVERDUE_DAYS} days</div>
                <div className="inv-tile-value">{summary.overdueCount}</div>
                <div className="inv-tile-note">
                  {summary.overdueCount ? `${moneyWhole(summary.overdueTotal)} unpaid · ${onlyOverdue ? 'showing only these' : 'tap to show'}` : 'Nothing unpaid past 30 days'}
                </div>
              </button>
            </div>

            {canEdit && pending.length ? (
              <section className="inv-section">
                <button type="button" className="ws-header ws-header-btn" onClick={() => setPendingOpen((o) => !o)} aria-expanded={pendingOpen}>
                  <h2>Pending review</h2>
                  <span className="ws-count">{pending.length}</span>
                  <ChevronIcon open={pendingOpen} className="ws-header-chevron" />
                </button>
                {pendingOpen ? (
                <>
                <p className="inv-hint">Read from the PDFs by the intake skill. Check the figures against the invoice, correct anything that&rsquo;s off, then accept it into the ledger.</p>
                <div className="inv-review-grid">
                  {pending.map((inv) => (
                    <div className="card static-card inv-review" key={inv.id}>
                      <div className="inv-review-head">
                        <strong>{inv.vendor}</strong>
                        <button type="button" className="btn-secondary" onClick={() => setPdfViewer({ title: `${inv.vendor} invoice ${inv.invoiceNumber}`, driveLink: inv.driveLink })}>View PDF</button>
                      </div>
                      {reviewForms[inv.id] ? (
                        <InvoiceFields
                          form={reviewForms[inv.id]}
                          setForm={(fn) => setReviewForms((prev) => ({ ...prev, [inv.id]: fn(prev[inv.id]) }))}
                          contracts={contracts}
                        />
                      ) : null}
                      <div className="inv-review-actions">
                        <button type="button" className="btn-veto" disabled={busy} onClick={() => rejectPending(inv)}>Reject</button>
                        <button type="button" className="btn-primary" disabled={busy} onClick={() => acceptPending(inv)}>Accept</button>
                      </div>
                    </div>
                  ))}
                </div>
                </>
                ) : null}
              </section>
            ) : null}

            <section className="inv-section">
              <div className="ws-header">
                <h2>Contracts</h2>
                {canEdit ? <button type="button" className="inv-link-btn" onClick={() => openContractEdit(null)}>+ Add contract</button> : null}
              </div>
              <div className="inv-table-wrap">
                <table className="inv-table">
                  <thead>
                    <tr>
                      <th>Vendor</th>
                      <th className="num">Contract</th>
                      <th className="num">Fees billed</th>
                      <th className="num">Remaining</th>
                      <th className="num">Paid</th>
                      <th className="num">Unpaid</th>
                      <th className="num">Est. unbilled</th>
                      {canEdit ? <th /> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {contracts.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <div className="inv-vendor">{c.vendor}</div>
                          <div className="inv-sub">{[c.role, c.contractNumber ? `No. ${c.contractNumber}` : '', c.billedThrough ? `billed through ${formatDate(c.billedThrough)}` : ''].filter(Boolean).join(' · ')}</div>
                        </td>
                        <td className="num">{c.contractAmount === null ? 'Hourly' : moneyWhole(c.contractAmount)}</td>
                        <td className="num">{moneyWhole(c.feesBilled)}</td>
                        <td className="num">{c.remaining === null ? '—' : moneyWhole(c.remaining)}</td>
                        <td className="num">{moneyWhole(c.paid)}</td>
                        <td className="num">{moneyWhole(c.unpaid)}</td>
                        <td className="num">
                          {moneyWhole(c.unbilled)}
                          <div className="inv-sub">{c.unbilledIsOverride ? 'set by editor' : 'run-rate estimate'}</div>
                        </td>
                        {canEdit ? (
                          <td className="num"><button type="button" className="inv-link-btn" onClick={() => openContractEdit(c)}>Edit</button></td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="inv-hint">
                Estimated unbilled work is each vendor&rsquo;s average monthly fees over its last three invoices, carried forward from the end of the latest billed period and capped at the contract balance. Expenses count toward paid and unpaid but not against the contract fee balance.
              </p>
            </section>

            <section className="inv-section">
              <div className="ws-header">
                <h2>Invoices</h2>
                <span className="ws-count">{listed.length}</span>
              </div>
              <div className="filter-bar inv-filters">
                <div className="filter-select">
                  <select value={filterVendor} onChange={(e) => setFilterVendor(e.target.value)} aria-label="Vendor">
                    <option value="">All vendors</option>
                    {vendors.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                  <ChevronDownIcon />
                </div>
                <div className="filter-div" />
                <div className="filter-select">
                  <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} aria-label="Status">
                    <option value="">All statuses</option>
                    {LEDGER_FLOW.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                    {canEdit ? <option value="rejected">Rejected</option> : null}
                  </select>
                  <ChevronDownIcon />
                </div>
                {onlyOverdue ? (
                  <>
                    <div className="filter-div" />
                    <button type="button" className="inv-link-btn inv-filter-clear" onClick={() => setOnlyOverdue(false)}>Over 30 days only ✕</button>
                  </>
                ) : null}
              </div>
              {listed.length === 0 ? (
                <div className="empty">{invoices.length ? 'No invoices match these filters.' : 'No invoices have been logged yet.'}</div>
              ) : (
                <div className="roster-list">
                  {listed.map((inv) => {
                    const late = isOverdue(inv, today);
                    return (
                      <button type="button" className="roster-row inv-row" key={inv.id} onClick={() => openDetail(inv)}>
                        <span className="inv-row-date">{formatDate(inv.invoiceDate)}</span>
                        <span className="roster-name">
                          {inv.vendor} <span className="inv-sub-inline">#{inv.invoiceNumber}</span>
                        </span>
                        {late ? <span className="inv-late">{daysSince(inv.invoiceDate, today)} days</span> : null}
                        <span className={'inv-status s-' + inv.status}>{STATUS_LABELS[inv.status]}</span>
                        <span className="inv-row-amount">{money(inv.totalAmount)}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      <div className={'overlay' + (detail ? ' open' : '')} onClick={(e) => { if (e.target === e.currentTarget) setDetail(null); }}>
        {detail ? (
          <div className="modal inv-detail">
            <h3>{detail.vendor} · Invoice {detail.invoiceNumber}</h3>
            <div className="inv-detail-status">
              <span className={'inv-status s-' + detail.status}>{STATUS_LABELS[detail.status]}</span>
              {detail.status === 'paid' && detail.paidDate ? <span className="inv-sub">paid {formatDate(detail.paidDate)}</span> : null}
              {isOverdue(detail, today) ? <span className="inv-late">{daysSince(detail.invoiceDate, today)} days since invoice</span> : null}
            </div>
            {canEdit ? (
              <>
                <InvoiceFields form={detailForm} setForm={(fn) => setDetailForm(fn)} contracts={contracts} />
                {nextStatus ? (
                  <div className="inv-next">
                    {nextStatus === 'paid' ? (
                      <div className="field inv-paid-date">
                        <label>Paid on</label>
                        <input type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} />
                      </div>
                    ) : null}
                    <button type="button" className="btn-primary" disabled={busy} onClick={() => changeStatus(nextStatus)}>
                      Mark {STATUS_LABELS[nextStatus].toLowerCase()}
                    </button>
                  </div>
                ) : null}
              </>
            ) : (
              <dl className="inv-dl">
                <dt>Invoice date</dt><dd>{formatDate(detail.invoiceDate)}</dd>
                <dt>Services through</dt><dd>{formatDate(detail.periodEnd)}</dd>
                <dt>Fees</dt><dd>{money(detail.feeAmount)}</dd>
                <dt>Expenses</dt><dd>{money(detail.expenseAmount)}</dd>
                <dt>Total</dt><dd><strong>{money(detail.totalAmount)}</strong></dd>
                {detail.notes ? (<><dt>Notes</dt><dd>{detail.notes}</dd></>) : null}
              </dl>
            )}
            {canEdit && detail.history.length ? (
              <details className="inv-history">
                <summary>History</summary>
                <ul>
                  {detail.history.slice().reverse().map((h, i) => (
                    <li key={i}>{new Date(h.at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })} · {h.by} · {h.action}{h.detail ? ` (${h.detail})` : ''}</li>
                  ))}
                </ul>
              </details>
            ) : null}
            <div className="modal-actions inv-detail-actions">
              {detail.driveLink ? (
                <button type="button" className="btn-secondary" onClick={() => setPdfViewer({ title: `${detail.vendor} invoice ${detail.invoiceNumber}`, driveLink: detail.driveLink })}>View PDF</button>
              ) : <span />}
              <div className="modal-right">
                {canEdit && detailIndex >= 1 ? (
                  <button type="button" className="btn-secondary" disabled={busy} onClick={() => changeStatus(LEDGER_FLOW[detailIndex - 1])}>Undo last step</button>
                ) : null}
                {canEdit ? <button type="button" className="btn-secondary" disabled={busy} onClick={saveDetail}>Save changes</button> : null}
                <button type="button" className="btn-secondary" onClick={() => setDetail(null)}>Close</button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className={'overlay' + (contractEdit ? ' open' : '')} onClick={(e) => { if (e.target === e.currentTarget) setContractEdit(null); }}>
        {contractEdit ? (
          <div className="modal">
            <h3>{contractEdit.id ? contractEdit.vendor : 'Add contract'}</h3>
            {!contractEdit.id ? (
              <div className="field">
                <label>Vendor (as it appears on invoices)</label>
                <input type="text" value={contractEdit.vendor} onChange={(e) => setContractEdit((c) => ({ ...c, vendor: e.target.value }))} />
              </div>
            ) : null}
            <div className="row2">
              <div className="field">
                <label>Role</label>
                <input type="text" value={contractEdit.role} onChange={(e) => setContractEdit((c) => ({ ...c, role: e.target.value }))} placeholder="e.g. Owner's Representative" />
              </div>
              <div className="field">
                <label>Contract number</label>
                <input type="text" value={contractEdit.contractNumber} onChange={(e) => setContractEdit((c) => ({ ...c, contractNumber: e.target.value }))} />
              </div>
            </div>
            <div className="field">
              <label>Contract amount (blank if hourly)</label>
              <input type="number" step="0.01" value={contractEdit.contractAmount} onChange={(e) => setContractEdit((c) => ({ ...c, contractAmount: e.target.value }))} />
            </div>
            <div className="row2">
              <div className="field">
                <label>Unbilled work override</label>
                <input
                  type="number"
                  step="0.01"
                  value={contractEdit.unbilledOverride}
                  onChange={(e) => setContractEdit((c) => ({ ...c, unbilledOverride: e.target.value }))}
                  placeholder={contractEdit.estimate !== null ? `Estimate: ${moneyWhole(contractEdit.estimate)}` : 'Blank uses the estimate'}
                />
              </div>
              <div className="field">
                <label>Override source</label>
                <input type="text" value={contractEdit.unbilledOverrideNote} onChange={(e) => setContractEdit((c) => ({ ...c, unbilledOverrideNote: e.target.value }))} placeholder="e.g. QA+M email, Oct 28" />
              </div>
            </div>
            <div className="modal-actions">
              <span />
              <div className="modal-right">
                <button type="button" className="btn-secondary" onClick={() => setContractEdit(null)}>Cancel</button>
                <button type="button" className="btn-primary" disabled={busy} onClick={saveContract}>Save</button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className={'overlay' + (pdfViewer ? ' open' : '')} onClick={(e) => { if (e.target === e.currentTarget) setPdfViewer(null); }}>
        {pdfViewer ? (
          <div className="modal pdf-viewer">
            <div className="pdf-viewer-header">
              <h3>{pdfViewer.title}</h3>
              <div className="pdf-viewer-header-actions">
                <button className="btn-secondary" onClick={() => setPdfViewer(null)}>Close</button>
              </div>
            </div>
            <iframe src={driveEmbedUrl(pdfViewer.driveLink)} title={pdfViewer.title} />
          </div>
        ) : null}
      </div>

      {toast ? <div id="toast">{toast}</div> : null}
    </>
  );
}
