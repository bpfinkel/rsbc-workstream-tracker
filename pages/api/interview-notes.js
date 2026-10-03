import { listInterviewNotes, saveInterviewNote, deleteInterviewNote } from '../../lib/interviewNotes';
import { getUserFromRequest } from '../../lib/supabase/server';
import { isAdmin } from '../../lib/admin';
import { RFP_PHASES, isFirmShown } from '../../lib/rfpCriteria';
import { INTERVIEW_QUESTIONS } from '../../lib/interviewSheet';

// Interviewer Sheet notes. A member reads and writes only their own rows (the
// scorer is always the signed-in user, never a value from the request); an
// admin may also read everyone's with ?all=1. Nobody else can see them.
const MAX_NOTE_LENGTH = 20000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function cleanNotes(notes) {
  return INTERVIEW_QUESTIONS.map((_, i) => String((Array.isArray(notes) && notes[i]) || '').slice(0, MAX_NOTE_LENGTH));
}

function cleanScores(scores) {
  return RFP_PHASES.Interview.criteria.map((c, i) => {
    const v = Array.isArray(scores) ? scores[i] : null;
    if (v === null || v === undefined || v === '') return null;
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.max(0, Math.min(c.max, n)) : null;
  });
}

export default async function handler(req, res) {
  const user = await getUserFromRequest(req, res);
  const email = (user?.email || '').toLowerCase();
  if (!email) return res.status(401).json({ error: 'Unauthorized' });

  try {
    if (req.method === 'GET') {
      const wantAll = req.query.all === '1';
      if (wantAll && !isAdmin(email)) return res.status(403).json({ error: 'Forbidden' });
      const notes = await listInterviewNotes(wantAll ? undefined : email);
      return res.status(200).json({ notes });
    }

    if (req.method === 'PUT') {
      const { firm, interviewer, date, notes, scores } = req.body || {};
      if (!firm || typeof firm !== 'string' || !isFirmShown(firm)) return res.status(400).json({ error: 'Invalid firm' });
      const saved = await saveInterviewNote({
        scorerEmail: email,
        firm,
        interviewer: String(interviewer || '').slice(0, 200),
        date: DATE_RE.test(String(date || '')) ? date : null,
        notes: cleanNotes(notes),
        scores: cleanScores(scores)
      });
      return res.status(200).json({ note: saved });
    }

    if (req.method === 'DELETE') {
      const { firm } = req.body || {};
      if (!firm || typeof firm !== 'string') return res.status(400).json({ error: 'firm is required' });
      await deleteInterviewNote(email, firm);
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
