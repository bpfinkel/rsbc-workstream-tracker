import { useEffect, useState } from 'react';
import Head from 'next/head';
import Header from '../components/Header';

function formatShortDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${m}/${d}/${y}`;
}

function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function Drafts() {
  const [drafts, setDrafts] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);

  async function loadDrafts() {
    const res = await fetch('/api/drafts');
    const data = await res.json();
    setDrafts(data.drafts || []);
    setLoaded(true);
  }

  useEffect(() => {
    loadDrafts().catch((e) => setError(e.message));
  }, []);

  async function handleAction(id, action) {
    setError('');
    try {
      const res = await fetch('/api/drafts/' + id, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Action failed');
      setSelected(null);
      await loadDrafts();
    } catch (e) {
      setError(e.message);
    }
  }

  const pending = drafts.filter((d) => d.status === 'Pending');
  const history = drafts.filter((d) => d.status !== 'Pending');

  return (
    <>
      <Head>
        <title>Riverside School Building Committee — Drafts</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Header active="drafts" />
      <div className="admin-note">Admin Access Only</div>

      <main>
        {error ? <div className="empty">{error}</div> : null}

        <div className="workstream-group">
          <h2>Pending Review ({pending.length})</h2>
          {!loaded ? null : pending.length === 0 ? (
            <div className="empty">No drafts awaiting review. New ones appear here automatically after each Wednesday meeting once minutes are drafted.</div>
          ) : (
            <div className="cards">
              {pending.map((d) => (
                <div className="card" key={d.id}>
                  <p className="title">{d.title}</p>
                  {d.description ? <p className="desc">{d.description}</p> : null}
                  <span className="chip">{d.workstream}</span>
                  {d.assignees.map((a) => <span className="chip" key={a}>{a}</span>)}
                  {d.deadline ? <div className="deadline">Due {formatShortDate(d.deadline)}</div> : null}
                  <div className="deadline">From meeting {formatShortDate(d.sourceMeetingDate)}</div>
                  <div className="modal-actions" style={{ marginTop: 12 }}>
                    <button type="button" className="btn-danger" onClick={() => handleAction(d.id, 'reject')}>Veto</button>
                    <button type="button" className="btn-primary" onClick={() => handleAction(d.id, 'approve')}>OK — Add to Tasks</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="workstream-group">
          <h2>History ({history.length})</h2>
          {history.length === 0 ? (
            <div className="empty">Nothing reviewed yet.</div>
          ) : (
            <div className="compact-list">
              {history.map((d) => (
                <div className="row-compact" key={d.id} onClick={() => setSelected(d)}>
                  <span className="row-title">{d.title}</span>
                  <span className="row-date">{d.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <div className={'overlay' + (selected ? ' open' : '')} onClick={(e) => { if (e.target === e.currentTarget) setSelected(null); }}>
        {selected && (
          <div className="modal contact-card">
            <h3>{selected.title}</h3>
            {selected.description ? <p className="desc" style={{ marginTop: -8, marginBottom: 14 }}>{selected.description}</p> : null}

            <div className="contact-field">
              <span className="contact-label">Status</span>
              <span className="contact-value">{selected.status}</span>
            </div>
            <div className="contact-field">
              <span className="contact-label">Decided by</span>
              <span className="contact-value">{selected.decidedBy || '—'}</span>
            </div>
            <div className="contact-field">
              <span className="contact-label">Decided at</span>
              <span className="contact-value">{formatDateTime(selected.decidedAt) || '—'}</span>
            </div>

            {selected.overrideAt ? (
              <>
                <div className="contact-field">
                  <span className="contact-label">Later override</span>
                  <span className="contact-value">{selected.overrideAction}</span>
                </div>
                <div className="contact-field">
                  <span className="contact-label">Overridden by</span>
                  <span className="contact-value">{selected.overrideBy || '—'}</span>
                </div>
                <div className="contact-field">
                  <span className="contact-label">Overridden at</span>
                  <span className="contact-value">{formatDateTime(selected.overrideAt)}</span>
                </div>
              </>
            ) : null}

            <div className="modal-actions">
              <span />
              <div className="modal-right">
                {selected.status === 'Rejected' ? (
                  <>
                    <button className="btn-secondary" onClick={() => handleAction(selected.id, 'move-to-pending')}>Move to Pending</button>
                    <button className="btn-primary" onClick={() => handleAction(selected.id, 'override-approve')}>Override — Approve</button>
                  </>
                ) : null}
                <button className="btn-secondary" onClick={() => setSelected(null)}>Close</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
