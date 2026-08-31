import { useEffect, useState } from 'react';
import Head from 'next/head';
import Header from '../components/Header';
import { createClient } from '../lib/supabase/client';
import { RFP_PHASES } from '../lib/rfpCriteria';
import { isAdmin as checkIsAdmin } from '../lib/admin';
import { useModalViewportLock } from '../lib/useViewportLock';

function embedUrl(pdfUrl) {
  return `https://docs.google.com/viewer?url=${encodeURIComponent(pdfUrl)}&embedded=true`;
}

function emptyScores() {
  return [null, null, null, null, null, null];
}

function totalFor(scores, criteria) {
  return criteria.reduce((sum, c, i) => sum + (Number(scores[i]) || 0), 0);
}

function ScoringIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3.5l2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.1-5.4 3.1 1.3-6-4.6-4.1 6.1-.6z" /></svg>
  );
}

function AdminSectionIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 17.2V20h2.8L17.8 9 15 6.2 4 17.2z" /><path d="M14 5.2l3 3" /></svg>
  );
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

  useModalViewportLock(!!pdfViewer);

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
          <div className="ws-header">
            <ScoringIcon />
            <h2>Owner&rsquo;s Rep RFP — Score the Firms</h2>
            <span className="ws-count">{firms.length}</span>
          </div>
          {!loaded ? null : (
            <div className="cards">
              {firms.map((f) => {
                const written = myScoreFor(f.firm, 'Written');
                const interview = myScoreFor(f.firm, 'Interview');
                return (
                  <div className="firm-card" key={f.firm}>
                    <p className="firm-name">{f.firm}</p>
                    <div className="firm-row">
                      <span className="firm-row-label">Proposal</span>
                      {f.proposalPdfUrl ? (
                        <a className="chip chip-link" href={f.proposalPdfUrl} onClick={(e) => openPdf(e, f.firm, f.proposalPdfUrl)}>Proposal PDF</a>
                      ) : (
                        <span className="locked-note">Not yet posted</span>
                      )}
                    </div>
                    <div className="firm-row">
                      <span className="firm-row-label">Written</span>
                      {f.writtenUnlocked ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span className={'status-chip' + (written ? ' done' : '')}>{written ? 'Submitted' : 'Not started'}</span>
                          <button type="button" className="btn-secondary" onClick={() => setEditing({ firm: f.firm, phase: 'Written' })}>
                            {written ? 'Edit' : 'Score'}
                          </button>
                        </div>
                      ) : (
                        <span className="locked-note">Not yet open</span>
                      )}
                    </div>
                    <div className="firm-row">
                      <span className="firm-row-label">Interview</span>
                      {f.interviewUnlocked ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span className={'status-chip' + (interview ? ' done' : '')}>{interview ? 'Submitted' : 'Not started'}</span>
                          <button type="button" className="btn-secondary" onClick={() => setEditing({ firm: f.firm, phase: 'Interview' })}>
                            {interview ? 'Edit' : 'Score'}
                          </button>
                        </div>
                      ) : (
                        <span className="locked-note">Not yet open</span>
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
            <div className="ws-header">
              <AdminSectionIcon />
              <h2>Admin — Submission Status</h2>
            </div>
            <div className="admin-list">
              {firms.map((f) => {
                const w = scorersFor(f.firm, 'Written');
                const iv = scorersFor(f.firm, 'Interview');
                return (
                  <div className="admin-row" key={f.firm}>
                    <div className="admin-row-top">
                      <span className="admin-firm-name">{f.firm}</span>
                      <div className="admin-toggles">
                        <LockToggle unlocked={f.writtenUnlocked} label="Written" onClick={() => toggleFirmLock(f.firm, 'Written', !f.writtenUnlocked)} />
                        <LockToggle unlocked={f.interviewUnlocked} label="Interview" onClick={() => toggleFirmLock(f.firm, 'Interview', !f.interviewUnlocked)} />
                      </div>
                    </div>
                    <span className="admin-detail">
                      Written: {w.length} submitted{w.length ? ` (${w.map((s) => s.scorerEmail).join(', ')})` : ''}
                    </span>
                    {f.interviewUnlocked ? (
                      <span className="admin-detail">
                        Interview: {iv.length} submitted{iv.length ? ` (${iv.map((s) => s.scorerEmail).join(', ')})` : ''}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <div className="admin-actions">
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
  const maxPoints = Math.max(...criteria.map((c) => c.max));

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
          <div className="criterion" key={c.key}>
            <div className="criterion-top">
              <span className="criterion-label">{c.label}</span>
              <span className="criterion-score">{scores[i] === null || scores[i] === undefined ? 0 : scores[i]} / {c.max}</span>
            </div>
            <div className="track-wrap">
              <input
                type="range"
                min="0"
                max={c.max}
                step="1"
                value={scores[i] === null || scores[i] === undefined ? 0 : scores[i]}
                onChange={(e) => setScore(i, e.target.value)}
                style={{ '--w': `${(c.max / maxPoints) * 100}%` }}
              />
              <span className="track-max">{c.max} pts</span>
            </div>
          </div>
        ))}
        <div className="field">
          <label>Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="total-row">
          <span>Total</span>
          <span className="value">{total} / {maxTotal}</span>
        </div>
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
