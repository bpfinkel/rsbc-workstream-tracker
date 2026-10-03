import { useEffect, useState } from 'react';
import { RFP_PHASES, RFP_SHORTLIST, phaseTotal } from '../lib/rfpCriteria';
import {
  INTERVIEW_QUESTIONS,
  INTERVIEW_SHEET_TITLE,
  INTERVIEW_SHEET_SUBTITLE,
  INTERVIEW_SHEET_FOOTNOTE
} from '../lib/interviewSheet';

// The member's working copy of the interviewer sheet. It is a worksheet only:
// nothing is sent to the server, and the official scores are still entered with
// "Score the Firms". Drafts persist in this browser (one set of notes and scores
// per firm) so a reload mid-interview does not lose anything. Once the
// interview phase is open, "Use these scores" hands the four numbers to the
// official scoring modal so nobody has to type them twice.
const STORAGE_KEY = 'rsbc-interview-sheet-v1';

function blankFirm() {
  return { notes: INTERVIEW_QUESTIONS.map(() => ''), scores: RFP_PHASES.Interview.criteria.map(() => '') };
}

function sheetHasContent(s) {
  return !!s && (s.notes.some((n) => n.trim()) || s.scores.some((v) => v !== ''));
}

// YYYY-MM-DD in the member's own time zone (toISOString would give UTC, which
// flips to tomorrow during an evening interview).
function todayLocal() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function readDraft() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === 'object') return parsed;
  } catch (e) {
    /* private mode / storage disabled / corrupt JSON: start blank */
  }
  return {};
}

function writeDraft(draft) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch (e) {
    /* the sheet still works for this session */
  }
}

// `firms` and `myScores` come from the page so the sheet knows whether the
// interview phase is open for a firm and whether the member already submitted.
// `memberName` and today's date are shown as defaults but only saved once the
// member edits them, so an old date never sticks to a later interview.
export default function InterviewSheet({ firms = [], myScores = [], memberName = '', onUseScores }) {
  const criteria = RFP_PHASES.Interview.criteria;
  const max = phaseTotal('Interview');
  const [draft, setDraft] = useState({ firms: {}, interviewer: '', date: '' });
  const [firm, setFirm] = useState('');
  const [ready, setReady] = useState(false);
  const [today, setToday] = useState('');

  // localStorage is unavailable during SSR, so the draft loads after mount.
  useEffect(() => {
    const saved = readDraft();
    setToday(todayLocal());
    setDraft({ firms: saved.firms || {}, interviewer: saved.interviewer || '', date: saved.date || '' });
    setFirm(saved.firm && RFP_SHORTLIST.includes(saved.firm) ? saved.firm : '');
    setReady(true);
  }, []);

  function update(next, nextFirm = firm) {
    setDraft(next);
    writeDraft({ ...next, firm: nextFirm });
  }

  const sheet = (firm && draft.firms[firm]) || blankFirm();

  function setField(key, value) {
    update({ ...draft, [key]: value });
  }

  function setNote(i, value) {
    const notes = sheet.notes.slice();
    notes[i] = value;
    update({ ...draft, firms: { ...draft.firms, [firm]: { ...sheet, notes } } });
  }

  function setScore(i, value) {
    const scores = sheet.scores.slice();
    scores[i] = value === '' ? '' : String(Math.max(0, Math.min(criteria[i].max, Math.round(Number(value) || 0))));
    update({ ...draft, firms: { ...draft.firms, [firm]: { ...sheet, scores } } });
  }

  function chooseFirm(value) {
    setFirm(value);
    writeDraft({ ...draft, firm: value });
  }

  function clearSheet() {
    if (!window.confirm(`Clear your notes and scores on this sheet for ${firm}? This cannot be undone.`)) return;
    const firms = { ...draft.firms };
    delete firms[firm];
    update({ ...draft, firms });
  }

  const total = sheet.scores.reduce((sum, v) => sum + (Number(v) || 0), 0);
  const filled = sheet.scores.filter((v) => v !== '').length;
  const firmRow = firms.find((f) => f.firm === firm);
  const interviewOpen = !!(firmRow && firmRow.interviewUnlocked);
  const submitted = myScores.some((s) => s.firm === firm && s.phase === 'Interview');

  function sendScores() {
    onUseScores(firm, sheet.scores.map((v) => (v === '' ? null : Number(v))));
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

      {!firm ? (
        <p className="interview-pick">Select a firm to start taking notes. Each firm keeps its own notes and scores.</p>
      ) : (
        <>
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
            <span className="interview-saved">{ready ? 'Notes are saved in this browser only and are never submitted.' : ''}</span>
            <button type="button" className="btn-secondary" onClick={clearSheet}>Clear this sheet</button>
          </div>
        </>
      )}
    </div>
  );
}
