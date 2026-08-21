import { useEffect, useState } from 'react';
import Head from 'next/head';
import Header from '../components/Header';
import { createClient } from '../lib/supabase/client';
import { RFP_PHASES } from '../lib/rfpCriteria';
import { isAdmin as checkIsAdmin } from '../lib/admin';

const VIEWPORT_LOCKED = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no';
const VIEWPORT_UNLOCKED = 'width=device-width, initial-scale=1';

function embedUrl(pdfUrl) {
  return `https://docs.google.com/viewer?url=${encodeURIComponent(pdfUrl)}&embedded=true`;
}

function emptyScores() {
  return [null, null, null, null, null, null];
}

function totalFor(scores, criteria) {
  return criteria.reduce((sum, c, i) => sum + (Number(scores[i]) || 0), 0);
}

function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function UnlockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M8 11V7a4 4 0 0 1 7.4-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function LockToggle({ unlocked, label, onClick }) {
  return (
    <button type="button" className={'lock-toggle ' + (unlocked ? 'unlocked' : 'locked')} onClick={onClick}
      title={unlocked ? `${label} scoring open — click to lock` : `${label} scoring locked — click to unlock`}>
      {unlocked ? <UnlockIcon /> : <LockIcon />}
      {label}
    </button>
  );
}

export default function Scoring() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [firms, setFirms] = useState([]);
  const [myScores, setMyScores] = useState([]);
  const [allScores, setAllScores] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [editing, setEditing] = useState(null);
  const [pdfViewer, setPdfViewer] = useState(null);

  async function load() {
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    const email = data?.user?.email || '';
    const admin = checkIsAdmin(email);
    setIsAdmin(admin);

    const [firmsRes, myRes] = await Promise.all([
      fetch('/api/scoring/firms').then((r) => r.json()),
      fetch('/api/scoring').then((r) => r.json())
    ]);
    setFirms((firmsRes.firms || []).slice().sort((a, b) => a.firm.localeCompare(b.firm)));
    setMyScores(myRes.scores || []);

    if (admin) {
      const allRes = await fetch('/api/scoring?all=1').then((r) => r.json());
      setAllScores(allRes.scores || []);
    }
    setLoaded(true);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    const meta = document.querySelector('meta[name="viewport"]');
    if (!meta) return;
    meta.setAttribute('content', pdfViewer ? VIEWPORT_UNLOCKED : VIEWPORT_LOCKED);
    return () => { meta.setAttribute('content', VIEWPORT_LOCKED); };
  }, [pdfViewer]);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  }

  function myScoreFor(firm, phase) {
    return myScores.find((s) => s.firm === firm && s.phase === phase);
  }

  function scorersFor(firm, phase) {
    return allScores.filter((s) => s.firm === firm && s.phase === phase);
  }

  function openPdf(e, firm, url) {
    e.preventDefault();
    setPdfViewer({ title: `${firm} — Proposal`, url });
  }

  async function toggleFirmLock(firm, phase, unlocked) {
    setError('');
    try {
      const res = await fetch('/api/scoring/firms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firm, phase, unlocked })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update');
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function toggleAllLock(phase, unlocked) {
    setError('');
    try {
      const res = await fetch('/api/scoring/firms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phase, unlocked })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update');
      showToast(`${phase} scoring ${unlocked ? 'unlocked' : 'locked'} for all firms`);
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleSubmit(scores, notes) {
    setError('');
    try {
      const res = await fetch('/api/scoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phase: editing.phase, firm: editing.firm, scores, notes })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit');
      setEditing(null);
      showToast('Scores saved');
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleClear() {
    if (!window.confirm('Clear your scores and notes for this firm? This cannot be undone.')) return;
    setError('');
    try {
      const res = await fetch('/api/scoring', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phase: editing.phase, firm: editing.firm })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to clear');
      setEditing(null);
      showToast('Cleared');
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  const allWrittenUnlocked = firms.length > 0 && firms.every((f) => f.writtenUnlocked);
  const allInterviewUnlocked = firms.length > 0 && firms.every((f) => f.interviewUnlocked);

  return (
    <>
      <Head>
        <title>Riverside School Building Committee — RFP Scoring</title>
      </Head>
      <Header active="scoring" />

      <main>
        {error ? <div className="empty">{error}</div> : null}

        <div className="workstream-group">
          <h2>Owner&rsquo;s Rep RFP — Score the Firms</h2>
          {!loaded ? null : (
            <div className="cards">
              {firms.map((f) => {
                const written = myScoreFor(f.firm, 'Written');
                const interview = myScoreFor(f.firm, 'Interview');
                return (
                  <div className="card" key={f.firm} style={{ cursor: 'default' }}>
                    <p className="title">{f.firm}</p>
                    <div className="modal-actions" style={{ marginTop: 10 }}>
                      {f.proposalPdfUrl ? (
                        <a className="chip chip-link" href={f.proposalPdfUrl} onClick={(e) => openPdf(e, f.firm, f.proposalPdfUrl)}>Proposal PDF</a>
                      ) : (
                        <span className="chip">Proposal PDF not yet posted</span>
                      )}
                    </div>
                    <div className="modal-actions" style={{ marginTop: 10 }}>
                      {f.writtenUnlocked ? (
                        <>
                          <span className="chip">{written ? 'Written: submitted' : 'Written: not started'}</span>
                          <button type="button" className="btn-secondary" onClick={() => setEditing({ firm: f.firm, phase: 'Written' })}>
                            {written ? 'Edit' : 'Score'}
                          </button>
                        </>
                      ) : (
                        <span className="deadline">Written scoring not yet open</span>
                      )}
                    </div>
                    <div className="modal-actions" style={{ marginTop: 8 }}>
                      {f.interviewUnlocked ? (
                        <>
                          <span className="chip">{interview ? 'Interview: submitted' : 'Interview: not started'}</span>
                          <button type="button" className="btn-secondary" onClick={() => setEditing({ firm: f.firm, phase: 'Interview' })}>
                            {interview ? 'Edit' : 'Score'}
                          </button>
                        </>
                      ) : (
                        <span className="deadline">Interview scoring not yet open</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {isAdmin ? (
          <div className="workstream-group">
            <h2>Admin — Submission Status</h2>
            <div className="compact-list">
              {firms.map((f) => {
                const w = scorersFor(f.firm, 'Written');
                const iv = scorersFor(f.firm, 'Interview');
                return (
                  <div className="row-compact" key={f.firm} style={{ cursor: 'default', flexDirection: 'column', alignItems: 'stretch', gap: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                      <span className="row-title">{f.firm}</span>
                      <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
                        <LockToggle unlocked={f.writtenUnlocked} label="Written" onClick={() => toggleFirmLock(f.firm, 'Written', !f.writtenUnlocked)} />
                        <LockToggle unlocked={f.interviewUnlocked} label="Interview" onClick={() => toggleFirmLock(f.firm, 'Interview', !f.interviewUnlocked)} />
                      </div>
                    </div>
                    <span className="row-date">
                      Written: {w.length} submitted{w.length ? ` (${w.map((s) => s.scorerEmail).join(', ')})` : ''}
                    </span>
                    {f.interviewUnlocked ? (
                      <span className="row-date">
                        Interview: {iv.length} submitted{iv.length ? ` (${iv.map((s) => s.scorerEmail).join(', ')})` : ''}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
              <button type="button" className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}
                onClick={() => toggleAllLock('Written', !allWrittenUnlocked)}>
                {allWrittenUnlocked ? <LockIcon /> : <UnlockIcon />}
                {allWrittenUnlocked ? 'Lock All — Written' : 'Unlock All — Written'}
              </button>
              <button type="button" className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}
                onClick={() => toggleAllLock('Interview', !allInterviewUnlocked)}>
                {allInterviewUnlocked ? <LockIcon /> : <UnlockIcon />}
                {allInterviewUnlocked ? 'Lock All — Interview' : 'Unlock All — Interview'}
              </button>
            </div>
          </div>
        ) : null}
      </main>

      {editing ? (
        <ScoreModal
          firm={editing.firm}
          phase={editing.phase}
          existing={myScoreFor(editing.firm, editing.phase)}
          onCancel={() => setEditing(null)}
          onSubmit={handleSubmit}
          onClear={handleClear}
        />
      ) : null}

      <div className={'overlay' + (pdfViewer ? ' open' : '')} onClick={(e) => { if (e.target === e.currentTarget) setPdfViewer(null); }}>
        {pdfViewer && (
          <div className="modal pdf-viewer">
            <div className="pdf-viewer-header">
              <h3>{pdfViewer.title}</h3>
              <div className="pdf-viewer-header-actions">
                <a href={pdfViewer.url} target="_blank" rel="noreferrer">Open in new tab ↗</a>
                <button className="btn-secondary" onClick={() => setPdfViewer(null)}>Close</button>
              </div>
            </div>
            <iframe src={embedUrl(pdfViewer.url)} title={pdfViewer.title} />
          </div>
        )}
      </div>

      <div id="toast" style={{ display: toast ? 'block' : 'none' }}>{toast}</div>
    </>
  );
}

function ScoreModal({ firm, phase, existing, onCancel, onSubmit, onClear }) {
  const criteria = RFP_PHASES[phase].criteria;
  const [scores, setScores] = useState(() => {
    const base = emptyScores();
    if (existing) existing.scores.forEach((v, i) => { base[i] = v; });
    return base;
  });
  const [notes, setNotes] = useState(existing?.notes || '');
  const [saving, setSaving] = useState(false);

  const total = totalFor(scores, criteria);
  const maxTotal = criteria.reduce((sum, c) => sum + c.max, 0);

  function setScore(i, value) {
    const next = scores.slice();
    next[i] = value === '' ? null : Math.max(0, Math.min(criteria[i].max, Number(value)));
    setScores(next);
  }

  async function submit() {
    setSaving(true);
    await onSubmit(scores, notes);
    setSaving(false);
  }

  return (
    <div className="overlay open" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal">
        <h3>{firm} — {RFP_PHASES[phase].label}</h3>
        {criteria.map((c, i) => (
          <div className="field" key={c.key}>
            <label>{c.label} — {scores[i] === null || scores[i] === undefined ? 0 : scores[i]} / {c.max}</label>
            <input
              type="range"
              min="0"
              max={c.max}
              step="1"
              value={scores[i] === null || scores[i] === undefined ? 0 : scores[i]}
              onChange={(e) => setScore(i, e.target.value)}
            />
          </div>
        ))}
        <div className="field">
          <label>Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="deadline">Total: {total} / {maxTotal}</div>
        <div className="modal-actions">
          {existing ? (
            <button className="btn-danger" onClick={onClear}>Clear</button>
          ) : <span />}
          <div className="modal-right">
            <button className="btn-secondary" onClick={onCancel}>Cancel</button>
            <button className="btn-primary" disabled={saving} onClick={submit}>{saving ? 'Saving…' : 'Submit'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
