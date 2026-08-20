import { useEffect, useState } from 'react';
import Head from 'next/head';
import Header from '../components/Header';
import { createClient } from '../lib/supabase/client';
import { RFP_PHASES } from '../lib/rfpCriteria';

const ADMIN_EMAIL = 'bfinkel.rsbc@gmail.com';

function emptyScores() {
  return [null, null, null, null, null, null];
}

function totalFor(scores, criteria) {
  return criteria.reduce((sum, c, i) => sum + (Number(scores[i]) || 0), 0);
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

  async function load() {
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    const email = data?.user?.email || '';
    const admin = email === ADMIN_EMAIL;
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

  async function toggleInterview(firm, unlocked) {
    setError('');
    try {
      const res = await fetch('/api/scoring/firms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firm, interviewUnlocked: unlocked })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update');
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
                      <span className="chip">{written ? 'Written: submitted' : 'Written: not started'}</span>
                      <button type="button" className="btn-secondary" onClick={() => setEditing({ firm: f.firm, phase: 'Written' })}>
                        {written ? 'Edit' : 'Score'}
                      </button>
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                      <span className="row-title">{f.firm}</span>
                      <label style={{ fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input
                          type="checkbox"
                          checked={f.interviewUnlocked}
                          onChange={(e) => toggleInterview(f.firm, e.target.checked)}
                        />
                        Interview open
                      </label>
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
