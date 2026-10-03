import { useEffect, useRef, useState } from 'react';
import { RFP_PHASES, RFP_SHORTLIST, phaseTotal } from '../lib/rfpCriteria';
import {
  INTERVIEW_QUESTIONS,
  INTERVIEW_SHEET_TITLE,
  INTERVIEW_SHEET_SUBTITLE,
  INTERVIEW_SHEET_FOOTNOTE
} from '../lib/interviewSheet';

// The member's interviewer sheet: one set of notes and worksheet scores per
// firm. Every edit autosaves to the member's portal account
// (/api/interview-notes -> Supabase `interview_notes`), where only that member
// and the admins can read it, so notes follow the member to any device and are
// there again when they score. A copy is also kept in this browser, keyed to the
// signed-in member, so a dropped connection mid-interview loses nothing; a
// browser copy marked `dirty` has edits the server has not confirmed yet and is
// re-sent on the next visit. "Use these scores" hands the four numbers to the
// official scoring modal so nobody types them twice.
const STORAGE_PREFIX = 'rsbc-interview-sheet-v2:';
const LEGACY_STORAGE_KEY = 'rsbc-interview-sheet-v1'; // pre-account, browser-only drafts
const SAVE_DELAY_MS = 800;
const RETRY_DELAY_MS = 8000;

function blankFirm() {
  return { notes: INTERVIEW_QUESTIONS.map(() => ''), scores: RFP_PHASES.Interview.criteria.map(() => '') };
}

export function sheetHasContent(s) {
  return !!s && ((s.notes || []).some((n) => String(n || '').trim()) || (s.scores || []).some((v) => v !== '' && v !== null && v !== undefined));
}

// YYYY-MM-DD in the member's own time zone (toISOString would give UTC, which
// flips to tomorrow during an evening interview).
function todayLocal() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function readStorage(key) {
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === 'object') return parsed;
  } catch (e) {
    /* private mode / storage disabled / corrupt JSON: start blank */
  }
  return null;
}

function writeStorage(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    /* the sheet still works and still saves to the account */
  }
}

function removeStorage(key) {
  try {
    window.localStorage.removeItem(key);
  } catch (e) {
    /* nothing to do */
  }
}

// Server rows store scores as numbers/null; the sheet's inputs use strings.
function fromServer(row) {
  return {
    notes: INTERVIEW_QUESTIONS.map((_, i) => String(row.notes[i] || '')),
    scores: RFP_PHASES.Interview.criteria.map((_, i) => (row.scores[i] === null || row.scores[i] === undefined ? '' : String(row.scores[i]))),
    savedAt: row.updatedAt,
    dirty: false
  };
}

function formatTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch (e) {
    return '';
  }
}

// `firms` and `myScores` come from the page so the sheet knows whether the
// interview phase is open for a firm and whether the member already submitted.
// `memberName` and today's date are shown as defaults until the member edits
// them. `onSheetsChange` reports every edit up to the page so the scoring
// modal can show the latest notes.
export default function InterviewSheet({ email = '', firms = [], myScores = [], memberName = '', onUseScores, onSheetsChange }) {
  const criteria = RFP_PHASES.Interview.criteria;
  const max = phaseTotal('Interview');
  const [draft, setDraft] = useState({ firms: {}, interviewer: '', date: '' });
  const [firm, setFirm] = useState('');
  const [ready, setReady] = useState(false);
  const [today, setToday] = useState('');
  // Per-firm save status: 'saving' | 'saved' | 'error'.
  const [status, setStatus] = useState({});

  const draftRef = useRef(draft);
  const firmRef = useRef(firm);
  const memberNameRef = useRef(memberName);
  memberNameRef.current = memberName;
  const timers = useRef({});
  const storageKey = email ? STORAGE_PREFIX + email.toLowerCase() : '';

  function commit(next, nextFirm) {
    if (nextFirm !== undefined) firmRef.current = nextFirm;
    draftRef.current = next;
    setDraft(next);
    if (storageKey) writeStorage(storageKey, { ...next, firm: firmRef.current });
    if (onSheetsChange) onSheetsChange(next.firms);
  }

  function bodyFor(f) {
    const d = draftRef.current;
    const s = d.firms[f] || blankFirm();
    return JSON.stringify({
      firm: f,
      interviewer: d.interviewer || memberNameRef.current,
      date: d.date || todayLocal(),
      notes: s.notes,
      scores: s.scores.map((v) => (v === '' ? null : Number(v)))
    });
  }

  async function saveNow(f) {
    clearTimeout(timers.current[f]);
    delete timers.current[f];
    setStatus((prev) => ({ ...prev, [f]: 'saving' }));
    try {
      const res = await fetch('/api/interview-notes', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: bodyFor(f) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      const d = draftRef.current;
      // Only clear `dirty` if nothing new was queued while this request was in flight.
      if (d.firms[f] && !timers.current[f]) {
        commit({ ...d, firms: { ...d.firms, [f]: { ...d.firms[f], dirty: false, savedAt: data.note.updatedAt } } });
        setStatus((prev) => ({ ...prev, [f]: 'saved' }));
      }
    } catch (e) {
      setStatus((prev) => ({ ...prev, [f]: 'error' }));
      if (!timers.current[f]) timers.current[f] = setTimeout(() => saveNow(f), RETRY_DELAY_MS);
    }
  }

  function queueSave(f) {
    clearTimeout(timers.current[f]);
    timers.current[f] = setTimeout(() => saveNow(f), SAVE_DELAY_MS);
    setStatus((prev) => (prev[f] === 'error' ? prev : { ...prev, [f]: 'saving' }));
  }

  // Load once the signed-in member is known: browser copy first (instant), then
  // the account's saved notes. The account copy wins unless the browser copy
  // holds edits the server never confirmed, which are re-sent instead.
  useEffect(() => {
    if (!email) return undefined;
    let cancelled = false;
    setToday(todayLocal());

    const saved = readStorage(storageKey) || {};
    let localFirms = saved.firms || {};
    // Adopt pre-account drafts once, then drop the unscoped key so they can't
    // surface for a different member on a shared computer.
    const legacy = readStorage(LEGACY_STORAGE_KEY);
    if (legacy && legacy.firms) {
      Object.entries(legacy.firms).forEach(([f, s]) => {
        if (!localFirms[f] && sheetHasContent(s)) localFirms = { ...localFirms, [f]: { ...s, dirty: true } };
      });
      removeStorage(LEGACY_STORAGE_KEY);
    }
    const lastFirm = saved.firm || (legacy && legacy.firm);
    const initialFirm = lastFirm && RFP_SHORTLIST.includes(lastFirm) ? lastFirm : '';
    setFirm(initialFirm);
    commit({ firms: localFirms, interviewer: saved.interviewer || (legacy && legacy.interviewer) || '', date: saved.date || '' }, initialFirm);
    setReady(true);

    fetch('/api/interview-notes')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('load failed'))))
      .then((data) => {
        if (cancelled) return;
        const d = draftRef.current;
        const merged = { ...d.firms };
        const resend = [];
        (data.notes || []).forEach((row) => {
          if (merged[row.firm] && merged[row.firm].dirty) resend.push(row.firm);
          else merged[row.firm] = fromServer(row);
        });
        Object.entries(merged).forEach(([f, s]) => {
          if (s.dirty && !resend.includes(f) && sheetHasContent(s)) resend.push(f);
        });
        commit({ ...d, firms: merged });
        const loaded = {};
        Object.entries(merged).forEach(([f, s]) => { if (!s.dirty && s.savedAt) loaded[f] = 'saved'; });
        setStatus(loaded);
        resend.forEach((f) => saveNow(f));
      })
      .catch(() => {
        // Offline or server error: keep working from the browser copy; the next
        // edit (or visit) sends anything unsaved.
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  // Leaving the page mid-debounce: send pending saves with keepalive so the
  // last few keystrokes aren't lost.
  useEffect(() => {
    function flush() {
      Object.keys(timers.current).forEach((f) => {
        clearTimeout(timers.current[f]);
        try {
          fetch('/api/interview-notes', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: bodyFor(f), keepalive: true });
        } catch (e) {
          /* the dirty browser copy is re-sent on the next visit */
        }
      });
      timers.current = {};
    }
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sheet = (firm && draft.firms[firm]) || blankFirm();

  function editSheet(patch) {
    const d = draftRef.current;
    const current = d.firms[firm] || blankFirm();
    commit({ ...d, firms: { ...d.firms, [firm]: { ...current, ...patch, dirty: true } } });
    queueSave(firm);
  }

  function setNote(i, value) {
    const notes = sheet.notes.slice();
    notes[i] = value;
    editSheet({ notes });
  }

  function setScore(i, value) {
    const scores = sheet.scores.slice();
    scores[i] = value === '' ? '' : String(Math.max(0, Math.min(criteria[i].max, Math.round(Number(value) || 0))));
    editSheet({ scores });
  }

  // Interviewer and date are shared across firms; re-save the open firm's sheet
  // (if it has anything in it) so its saved row carries the new value.
  function setField(key, value) {
    commit({ ...draftRef.current, [key]: value });
    if (firm && sheetHasContent(draftRef.current.firms[firm])) queueSave(firm);
  }

  function chooseFirm(value) {
    setFirm(value);
    commit(draftRef.current, value);
  }

  async function clearSheet() {
    if (!window.confirm(`Delete your notes and scores on this sheet for ${firm}? This removes them from your account and cannot be undone.`)) return;
    const f = firm;
    clearTimeout(timers.current[f]);
    delete timers.current[f];
    const d = draftRef.current;
    const nextFirms = { ...d.firms };
    delete nextFirms[f];
    commit({ ...d, firms: nextFirms });
    setStatus((prev) => ({ ...prev, [f]: undefined }));
    try {
      const res = await fetch('/api/interview-notes', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ firm: f }) });
      if (!res.ok) throw new Error('Delete failed');
    } catch (e) {
      window.alert('Could not delete the saved copy from your account. Please try again.');
    }
  }

  const total = sheet.scores.reduce((sum, v) => sum + (Number(v) || 0), 0);
  const filled = sheet.scores.filter((v) => v !== '').length;
  const firmRow = firms.find((f) => f.firm === firm);
  const interviewOpen = !!(firmRow && firmRow.interviewUnlocked);
  const submitted = myScores.some((s) => s.firm === firm && s.phase === 'Interview');

  function sendScores() {
    onUseScores(firm, sheet.scores.map((v) => (v === '' ? null : Number(v))));
  }

  const firmStatus = status[firm];
  let statusText = 'Notes save to your account automatically. Only you and the committee admins can see them.';
  let statusClass = '';
  if (firmStatus === 'saving') statusText = 'Saving…';
  else if (firmStatus === 'error') {
    statusText = 'Couldn’t reach the portal. Your notes are kept in this browser and will save when the connection returns.';
    statusClass = ' error';
  } else if (firmStatus === 'saved' && sheet.savedAt) {
    statusText = `Saved to your account at ${formatTime(sheet.savedAt)}. Only you and the committee admins can see these notes.`;
    statusClass = ' saved';
  }

  return (
    <div className="card static-card interview-sheet">
      <h3 className="interview-title">{INTERVIEW_SHEET_TITLE}</h3>
      <p className="interview-sub">{INTERVIEW_SHEET_SUBTITLE}</p>

      <div className="interview-meta">
        <div className="field">
          <label htmlFor="iv-firm">Firm</label>
          <select id="iv-firm" value={firm} onChange={(e) => chooseFirm(e.target.value)}>
            <option value="">Select a firm…</option>
            {RFP_SHORTLIST.slice().sort((a, b) => a.localeCompare(b)).map((f) => (
              <option key={f} value={f}>{f}{sheetHasContent(draft.firms[f]) ? ' (notes started)' : ''}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="iv-interviewer">Interviewer</label>
          <input id="iv-interviewer" type="text" value={draft.interviewer || memberName} onChange={(e) => setField('interviewer', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="iv-date">Date</label>
          <input id="iv-date" type="date" value={draft.date || today} onChange={(e) => setField('date', e.target.value)} />
        </div>
      </div>

      {!ready ? null : !firm ? (
        <p className="interview-pick">Select a firm to start taking notes. Each firm keeps its own notes and scores, saved to your account.</p>
      ) : (
        <>
          <p className={'interview-status' + statusClass} role="status" aria-live="polite">{statusText}</p>
          {INTERVIEW_QUESTIONS.map((q, i) => (
            <div className="interview-q" key={i}>
              <p className="interview-q-text"><span className="interview-q-num">{i + 1}.</span> {q}</p>
              <div className="field">
                <label htmlFor={`iv-note-${i}`}>Notes</label>
                <textarea id={`iv-note-${i}`} rows={4} value={sheet.notes[i]} onChange={(e) => setNote(i, e.target.value)} />
              </div>
            </div>
          ))}

          <p className="interview-scores-title">Scores</p>
          <div className="interview-table" role="table" aria-label="Interview scores">
            <div className="interview-row interview-row-head" role="row">
              <span role="columnheader">Criterion</span>
              <span role="columnheader" className="interview-col-look">What to look for</span>
              <span role="columnheader" className="interview-col-num">Max</span>
              <span role="columnheader" className="interview-col-num">Score</span>
            </div>
            {criteria.map((c, i) => (
              <div className="interview-row" role="row" key={c.key}>
                <span role="cell" className="interview-col-label">{c.label}</span>
                <span role="cell" className="interview-col-look">{c.guidance}</span>
                <span role="cell" className="interview-col-num">{c.max}</span>
                <span role="cell" className="interview-col-num">
                  <input
                    type="number" inputMode="numeric" min="0" max={c.max} step="1"
                    aria-label={`${c.label} score out of ${c.max}`}
                    value={sheet.scores[i]} onChange={(e) => setScore(i, e.target.value)}
                  />
                </span>
              </div>
            ))}
            <div className="interview-row interview-row-total" role="row">
              <span role="cell" className="interview-col-label">Interview total</span>
              <span role="cell" className="interview-col-look" />
              <span role="cell" className="interview-col-num">{max}</span>
              <span role="cell" className="interview-col-num interview-total">{total}</span>
            </div>
          </div>
          <p className="modal-footnote">{INTERVIEW_SHEET_FOOTNOTE}</p>
          <div className="interview-send">
            {!onUseScores ? null : !interviewOpen ? (
              <span className="interview-send-note">Interview scoring for {firm} is not open yet. Your sheet is saved; come back once it opens.</span>
            ) : (
              <>
                <span className="interview-send-note">
                  {submitted ? 'You have already submitted interview scores for this firm. ' : ''}
                  {filled < criteria.length
                    ? `Enter all ${criteria.length} scores to send them to your official scorecard.`
                    : 'Review these scores in your official scorecard, then Submit.'}
                </span>
                <button type="button" className="btn-primary" disabled={filled < criteria.length} onClick={sendScores}>
                  {submitted ? 'Update my submitted scores' : 'Use these scores'}
                </button>
              </>
            )}
          </div>
          <div className="interview-foot">
            <span />
            <button type="button" className="btn-secondary" onClick={clearSheet}>Delete this sheet</button>
          </div>
        </>
      )}
    </div>
  );
}

// Read-only view of one sheet's notes and worksheet scores. Used in the
// scoring modal (the member recalling their own notes) and in the admin
// Interview Notes section. Questions with no notes are skipped.
export function InterviewNotesView({ sheet, onUseScores }) {
  const notes = (sheet && sheet.notes) || [];
  const scores = (sheet && sheet.scores) || [];
  const criteria = RFP_PHASES.Interview.criteria;
  const answered = INTERVIEW_QUESTIONS.map((q, i) => ({ q, i, text: String(notes[i] || '').trim() })).filter((x) => x.text);
  const blank = (v) => v === '' || v === null || v === undefined;
  const hasScores = scores.some((v) => !blank(v));
  const allScores = criteria.every((_, i) => !blank(scores[i]));
  return (
    <div className="iv-notes-view">
      {answered.length ? answered.map(({ q, i, text }) => (
        <div className="iv-notes-item" key={i}>
          <p className="iv-notes-q" title={q}><span className="interview-q-num">{i + 1}.</span> {q}</p>
          <p className="iv-notes-text">{text}</p>
        </div>
      )) : <p className="iv-notes-empty">No notes written.</p>}
      {hasScores ? (
        <ul className="iv-notes-scores">
          {criteria.map((c, i) => (
            <li key={c.key}><span>{c.label}</span><strong>{blank(scores[i]) ? '–' : scores[i]} / {c.max}</strong></li>
          ))}
        </ul>
      ) : null}
      {onUseScores && allScores ? (
        <button type="button" className="guidance-toggle iv-notes-use" onClick={() => onUseScores(criteria.map((_, i) => Number(scores[i])))}>
          Use my sheet scores
        </button>
      ) : null}
    </div>
  );
}
