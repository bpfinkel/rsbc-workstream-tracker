import { useEffect, useState } from 'react';
import Head from 'next/head';
import Header from '../components/Header';
import { createClient } from '../lib/supabase/client';
import { RFP_PHASES, RFP_PHASE_ORDER, RFP_RUBRIC_INTRO, RFP_RUBRIC_NOTE, phaseTotal } from '../lib/rfpCriteria';
import { isAdmin as checkIsAdmin } from '../lib/admin';
import { useModalViewportLock } from '../lib/useViewportLock';

function embedUrl(pdfUrl) {
  return `https://docs.google.com/viewer?url=${encodeURIComponent(pdfUrl)}&embedded=true`;
}

// The roster stores full names; the Admin submission list shows last names so a
// glance tells you who's outstanding without parsing addresses. Two members with
// the same last name are disambiguated with a first initial ("J. Smith").
const NAME_SUFFIXES = /^(jr|sr|ii|iii|iv|phd|ed\.?d|m\.?d|esq)\.?$/i;

// Nobiliary particles belong to the surname: "Julian De La Rosa" -> "De La Rosa".
const NAME_PARTICLES = new Set(['de', 'del', 'della', 'di', 'da', 'du', 'la', 'le', 'van', 'von', 'der', 'den', 'ter', 'bin', 'al', 'mac', 'st', "st.", 'saint', 'dos', 'das']);

// Surnames the rule above can't infer — a two-word surname with no particle is
// indistinguishable from a middle name. Add a row here if a member displays wrong.
const LAST_NAME_OVERRIDES = {
  'mary dolan collette': 'Dolan Collette'
};

function lastNameOf(fullName) {
  const override = LAST_NAME_OVERRIDES[String(fullName || '').trim().toLowerCase()];
  if (override) return override;

  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';

  let end = parts.length - 1;
  if (end > 1 && NAME_SUFFIXES.test(parts[end])) end -= 1;

  // Walk back over any particles, but never consume the first name itself.
  let start = end;
  while (start > 1 && NAME_PARTICLES.has(parts[start - 1].toLowerCase().replace(/\.$/, ''))) start -= 1;

  return parts.slice(start, end + 1).join(' ');
}

function buildScorerNames(members) {
  const rows = (members || []).filter((m) => m && m.email && m.name);
  const lastNameCounts = {};
  rows.forEach((m) => {
    const key = lastNameOf(m.name).toLowerCase();
    lastNameCounts[key] = (lastNameCounts[key] || 0) + 1;
  });
  const map = {};
  rows.forEach((m) => {
    const parts = String(m.name).trim().split(/\s+/).filter(Boolean);
    const last = lastNameOf(m.name);
    const collides = lastNameCounts[last.toLowerCase()] > 1 && parts.length > 1;
    map[m.email.toLowerCase()] = collides ? `${parts[0][0]}. ${last}` : last;
  });
  return map;
}

function emptyScores() {
  return [null, null, null, null, null, null];
}

function totalFor(scores, criteria) {
  return criteria.reduce((sum, c, i) => sum + (Number(scores[i]) || 0), 0);
}

function median(nums) {
  const sorted = nums.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function mean(nums) {
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function fmt1(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

// Median/average/low/high in one shot — used for both a firm's overall totals
// and, when a row is expanded, each individual rubric category.
function statsOf(nums) {
  return {
    med: median(nums),
    avg: mean(nums),
    lo: Math.min(...nums),
    hi: Math.max(...nums)
  };
}

// The low-high range bar with median tick and average dot, scaled to `max`,
// flanked by the low/high numbers themselves so the range reads at a glance
// without hovering. Shared between a firm's overall row and its per-category
// breakdown rows.
function RangeBar({ lo, hi, med, avg, max }) {
  return (
    <span className="range-wrap">
      <span className="range-endpoint range-lo">{fmt1(lo)}</span>
      <span className="range-track">
        <span
          className="range-bar"
          style={{ left: `${(lo / max) * 100}%`, width: `${Math.max(((hi - lo) / max) * 100, 1.5)}%` }}
        />
        <span className="range-median" style={{ left: `${(med / max) * 100}%` }} />
        <span className="range-mean" style={{ left: `${(avg / max) * 100}%` }} title={`Average ${fmt1(avg)}`} />
      </span>
      <span className="range-endpoint range-hi">{fmt1(hi)}</span>
    </span>
  );
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

function SummaryIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 20V13M11 20V6M17 20V16M3 20h18" /></svg>
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

function GuideIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5z" /><path d="M8 7.5h7M8 11h7" /></svg>
  );
}

function ChevronIcon({ open, className }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
  );
}

// Generic collapsible top-level section: a clickable ws-header with a chevron
// that shows/hides its children. Every workstream-group on this page uses it
// (Scoring Criteria started this way; the others were made to match).
function CollapsibleSection({ icon, title, count, defaultOpen, children }) {
  const [open, setOpen] = useState(defaultOpen !== false);
  return (
    <div className="workstream-group">
      <button type="button" className="ws-header ws-header-btn" onClick={() => setOpen(!open)}
        aria-expanded={open}>
        {icon}
        <h2>{title}</h2>
        {count != null ? <span className="ws-count">{count}</span> : null}
        <ChevronIcon open={open} className="ws-header-chevron" />
      </button>
      {open ? children : null}
    </div>
  );
}

// Whether the scoring modal shows the rubric's "What to look for" commentary
// under each slider. Defaults to ON so every member sees the guidance the first
// time they score; the choice is remembered per-browser after that.
const GUIDANCE_PREF_KEY = 'rsbc-scoring-guidance';

function readGuidancePref() {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(GUIDANCE_PREF_KEY) !== '0';
  } catch (e) {
    return true;
  }
}

function writeGuidancePref(on) {
  try {
    window.localStorage.setItem(GUIDANCE_PREF_KEY, on ? '1' : '0');
  } catch (e) {
    /* private mode / storage disabled — the toggle still works for this session */
  }
}

// The full rubric, collapsed by default, so the commentary is available as a
// standalone reference and not only from inside a scoring modal.
function ScoringGuide() {
  return (
    <CollapsibleSection icon={<GuideIcon />} title="Scoring Criteria" defaultOpen={false}>
      <div className="card static-card guide-card">
        <p className="guide-intro">{RFP_RUBRIC_INTRO}</p>
        {RFP_PHASE_ORDER.map((phase) => (
          <div className="guide-phase" key={phase}>
            <p className="guide-phase-title">
              {RFP_PHASES[phase].label} &mdash; {phaseTotal(phase)} points
            </p>
            {RFP_PHASES[phase].criteria.map((c) => (
              <div className="guide-criterion" key={c.key}>
                <div className="guide-criterion-top">
                  <span className="guide-criterion-label">{c.label}</span>
                  <span className="guide-criterion-pts">{c.max} pts</span>
                </div>
                <p className="guide-text">{c.guidance}</p>
              </div>
            ))}
          </div>
        ))}
        <p className="guide-note">{RFP_RUBRIC_NOTE}</p>
      </div>
    </CollapsibleSection>
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

// Admin-only "quick glance" rollup of running scores per firm/phase: median,
// average, and range across everyone who has scored so far, ranked by median
// (highest first) the same way the committee's own scoring-review deck is. It
// recomputes live from allScores on every page load, so it always reflects
// whatever has been submitted up to that moment — a firm/phase with no
// submissions yet is simply left out rather than shown as zero. Clicking a
// firm's row expands it into the same stats broken down by rubric category,
// reusing each score row's raw per-criterion values rather than re-fetching.
function ScoringSummary({ firms, allScores }) {
  const [expanded, setExpanded] = useState({});

  function toggleExpanded(key) {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const blocks = RFP_PHASE_ORDER.map((phase) => {
    const max = phaseTotal(phase);
    const criteria = RFP_PHASES[phase].criteria;
    const rows = firms
      .map((f) => {
        const scoreRows = allScores.filter((s) => s.phase === phase && s.firm === f.firm);
        if (!scoreRows.length) return null;
        const totals = scoreRows.map((s) => totalFor(s.scores, criteria));
        const { med, avg, lo, hi } = statsOf(totals);
        return { firm: f.firm, med, avg, lo, hi, n: totals.length, scoreRows };
      })
      .filter(Boolean)
      .sort((a, b) => b.med - a.med || b.avg - a.avg || a.firm.localeCompare(b.firm));
    return { phase, max, criteria, rows };
  }).filter((b) => b.rows.length > 0);

  if (!blocks.length) return null;

  return (
    <CollapsibleSection icon={<SummaryIcon />} title="Admin — Scoring Summary">
      <p className="summary-legend">
        Ranked by median. Click a firm to break its score down by rubric category. The bar spans the low&ndash;high range; the red tick marks the median and the navy dot marks the average.
      </p>
      {blocks.map(({ phase, max, criteria, rows }) => (
        <div className="summary-block" key={phase}>
          <p className="summary-block-title">
            {RFP_PHASES[phase].label} <span className="summary-block-sub">(out of {max})</span>
          </p>
          <div className="summary-table">
            <div className="summary-head-row">
              <span className="summary-col-firm">Firm</span>
              <span className="summary-col-range">Range</span>
              <span className="summary-col-num">Med.</span>
              <span className="summary-col-num">Avg.</span>
              <span className="summary-col-num">n</span>
            </div>
            {rows.map((r) => {
              const key = `${phase}::${r.firm}`;
              const isOpen = !!expanded[key];
              return (
                <div className="summary-item" key={r.firm}>
                  <div
                    className={'summary-row summary-row-clickable' + (isOpen ? ' open' : '')}
                    role="button"
                    tabIndex={0}
                    aria-expanded={isOpen}
                    onClick={() => toggleExpanded(key)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleExpanded(key);
                      }
                    }}
                  >
                    <span className="summary-col-firm">
                      <ChevronIcon open={isOpen} className="summary-row-chevron" />
                      {r.firm}
                    </span>
                    <span className="summary-col-range">
                      <RangeBar lo={r.lo} hi={r.hi} med={r.med} avg={r.avg} max={max} />
                    </span>
                    <span className="summary-col-num summary-med">{fmt1(r.med)}</span>
                    <span className="summary-col-num">{fmt1(r.avg)}</span>
                    <span className="summary-col-num summary-n">{r.n}</span>
                  </div>
                  {isOpen ? (
                    <div className="summary-detail">
                      {criteria.map((c, i) => {
                        const vals = r.scoreRows.map((s) => Number(s.scores[i]) || 0);
                        const cs = statsOf(vals);
                        return (
                          <div className="summary-row summary-row-detail" key={c.key}>
                            <span className="summary-col-firm summary-detail-label">
                              {c.label} <span className="summary-detail-max">/ {c.max}</span>
                            </span>
                            <span className="summary-col-range">
                              <RangeBar lo={cs.lo} hi={cs.hi} med={cs.med} avg={cs.avg} max={c.max} />
                            </span>
                            <span className="summary-col-num summary-med">{fmt1(cs.med)}</span>
                            <span className="summary-col-num">{fmt1(cs.avg)}</span>
                            <span className="summary-col-num summary-n" />
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </CollapsibleSection>
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
  const [scorerNames, setScorerNames] = useState({});

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

    // Only the admin section names scorers, so the roster is fetched just for admins.
    if (admin) {
      const [allRes, membersRes] = await Promise.all([
        fetch('/api/scoring?all=1').then((r) => r.json()),
        fetch('/api/members').then((r) => r.json())
      ]);
      setAllScores(allRes.scores || []);
      setScorerNames(buildScorerNames(membersRes.members));
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

  // Falls back to the raw address when a scorer has no matching roster row, so an
  // unrecognized submitter stays visible rather than being silently mislabeled.
  function scorerLabel(email) {
    return scorerNames[String(email || '').toLowerCase()] || email;
  }

  // Hovering a name reveals the address it resolved from.
  function renderScorers(scores) {
    return scores.map((s, i) => (
      <span key={s.scorerEmail} title={s.scorerEmail}>{i ? ', ' : ''}{scorerLabel(s.scorerEmail)}</span>
    ));
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
      showToast(`${RFP_PHASES[phase].shortLabel} scoring ${unlocked ? 'unlocked' : 'locked'} for all firms`);
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

        <ScoringGuide />

        <CollapsibleSection icon={<ScoringIcon />} title={'Owner’s Rep RFP — Score the Firms'} count={firms.length}>
          {!loaded ? null : (
            <div className="cards">
              {firms.map((f) => {
                const written = myScoreFor(f.firm, 'Written');
                const interview = myScoreFor(f.firm, 'Interview');
                return (
                  <div className="firm-card" key={f.firm}>
                    <p className="firm-name">{f.firm}</p>
                    <div className="firm-row">
                      <span className="firm-row-label">Submission</span>
                      {f.proposalPdfUrl ? (
                        <a className="chip chip-link" href={f.proposalPdfUrl} onClick={(e) => openPdf(e, f.firm, f.proposalPdfUrl)}>Proposal PDF</a>
                      ) : (
                        <span className="locked-note">Not yet posted</span>
                      )}
                    </div>
                    <div className="firm-row">
                      <span className="firm-row-label">{RFP_PHASES.Written.shortLabel}</span>
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
                      <span className="firm-row-label">{RFP_PHASES.Interview.shortLabel}</span>
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
        </CollapsibleSection>

        {isAdmin ? (
          <>
            <CollapsibleSection icon={<AdminSectionIcon />} title="Admin — Submission Status">
              <div className="admin-list">
                {firms.map((f) => {
                  const w = scorersFor(f.firm, 'Written');
                  const iv = scorersFor(f.firm, 'Interview');
                  return (
                    <div className="admin-row" key={f.firm}>
                      <div className="admin-row-top">
                        <span className="admin-firm-name">{f.firm}</span>
                        <div className="admin-toggles">
                          <LockToggle unlocked={f.writtenUnlocked} label={RFP_PHASES.Written.shortLabel} onClick={() => toggleFirmLock(f.firm, 'Written', !f.writtenUnlocked)} />
                          <LockToggle unlocked={f.interviewUnlocked} label={RFP_PHASES.Interview.shortLabel} onClick={() => toggleFirmLock(f.firm, 'Interview', !f.interviewUnlocked)} />
                        </div>
                      </div>
                      <span className="admin-detail">
                        {RFP_PHASES.Written.shortLabel}: {w.length} submitted{w.length ? <> ({renderScorers(w)})</> : ''}
                      </span>
                      {f.interviewUnlocked ? (
                        <span className="admin-detail">
                          {RFP_PHASES.Interview.shortLabel}: {iv.length} submitted{iv.length ? <> ({renderScorers(iv)})</> : ''}
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
                  {(allWrittenUnlocked ? 'Lock All — ' : 'Unlock All — ') + RFP_PHASES.Written.shortLabel}
                </button>
                <button type="button" className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}
                  onClick={() => toggleAllLock('Interview', !allInterviewUnlocked)}>
                  {allInterviewUnlocked ? <LockIcon /> : <UnlockIcon />}
                  {(allInterviewUnlocked ? 'Lock All — ' : 'Unlock All — ') + RFP_PHASES.Interview.shortLabel}
                </button>
              </div>
            </CollapsibleSection>

            <ScoringSummary firms={firms} allScores={allScores} />
          </>
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
  const [showGuidance, setShowGuidance] = useState(true);

  // Read the remembered preference after mount so server and client render the
  // same markup on the first pass (localStorage isn't available during SSR).
  useEffect(() => { setShowGuidance(readGuidancePref()); }, []);

  function toggleGuidance() {
    const next = !showGuidance;
    setShowGuidance(next);
    writeGuidancePref(next);
  }

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
        <div className="guidance-bar">
          <span className="guidance-bar-total">{maxTotal} points across {criteria.length} criteria</span>
          <button type="button" className="guidance-toggle" onClick={toggleGuidance} aria-expanded={showGuidance}>
            {showGuidance ? 'Hide' : 'Show'} what to look for
          </button>
        </div>
        {criteria.map((c, i) => {
          const val = scores[i] === null || scores[i] === undefined ? 0 : scores[i];
          const fillPct = c.max ? (val / c.max) * 100 : 0;
          return (
            <div className="criterion" key={c.key}>
              <div className="criterion-top">
                <span className="criterion-label">{c.label}</span>
                <span className="criterion-score">{val} / {c.max}</span>
              </div>
              <div className="track-wrap">
                <input
                  type="range"
                  min="0"
                  max={c.max}
                  step="1"
                  value={val}
                  onChange={(e) => setScore(i, e.target.value)}
                  style={{
                    '--w': `${(c.max / maxPoints) * 100}%`,
                    background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${fillPct}%, var(--border) ${fillPct}%, var(--border) 100%)`
                  }}
                />
                <span className="track-max">{c.max} pts</span>
              </div>
              {showGuidance && c.guidance ? (
                <p className="criterion-guidance">{c.guidance}</p>
              ) : null}
            </div>
          );
        })}
        <div className="field">
          <label>Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="total-row">
          <span>Total</span>
          <span className="value">{total} / {maxTotal}</span>
        </div>
        <p className="modal-footnote">{RFP_RUBRIC_NOTE}</p>
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
