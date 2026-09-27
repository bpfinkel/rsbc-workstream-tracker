import { RFP_PHASES, RFP_PHASE_ORDER } from '../lib/rfpCriteria';

// The signed-in member's own scoring progress, one row per open phase ("You've
// scored 4 of 7 firms" + a bar). Shared by /scoring and the home page's RFP
// Scoring box so the two always count the same way.
export const PHASE_UNLOCK_FLAG = { Written: 'writtenUnlocked', Interview: 'interviewUnlocked' };

// A firm counts toward a phase's total once that phase is open for it, or once
// the member has already scored it (so a later re-lock can't push "done" past
// the total). Interviews are often limited to a shortlist, so the denominator
// follows the unlock flags rather than always being every firm.
export function phaseProgress(firms, myScores, phase) {
  const scored = new Set(myScores.filter((s) => s.phase === phase).map((s) => s.firm));
  const scorable = firms.filter((f) => f[PHASE_UNLOCK_FLAG[phase]] || scored.has(f.firm));
  return { phase, done: scorable.filter((f) => scored.has(f.firm)).length, total: scorable.length };
}

export function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7" /></svg>
  );
}

export default function ScoringProgress({ firms, myScores }) {
  const phases = RFP_PHASE_ORDER.map((p) => phaseProgress(firms, myScores, p)).filter((p) => p.total > 0);
  if (!phases.length) return null;
  return (
    <div className="score-progress" aria-live="polite">
      {phases.map(({ phase, done, total }) => {
        const complete = done === total;
        const pct = Math.round((done / total) * 100);
        return (
          <div className={'score-progress-row' + (complete ? ' complete' : '')} key={phase}>
            <div className="score-progress-top">
              <span className="score-progress-text">
                {complete ? <CheckIcon /> : null}
                {complete
                  ? `You've scored all ${total} firm${total === 1 ? '' : 's'}`
                  : `You've scored ${done} of ${total} firm${total === 1 ? '' : 's'}`}
              </span>
              <span className="score-progress-phase">{RFP_PHASES[phase].shortLabel}</span>
            </div>
            <div
              className="score-progress-track"
              role="progressbar"
              aria-label={`${RFP_PHASES[phase].shortLabel} scoring progress`}
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={done}
              aria-valuetext={`${done} of ${total} firms scored`}
            >
              <span className="score-progress-fill" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
