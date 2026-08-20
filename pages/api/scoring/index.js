import { listScores, submitScore } from '../../../lib/sheets';
import { getUserFromRequest } from '../../../lib/supabase/server';
import { RFP_PHASES } from '../../../lib/rfpCriteria';

const ADMIN_EMAIL = 'bfinkel.rsbc@gmail.com';

export default async function handler(req, res) {
  const user = await getUserFromRequest(req, res);
  const email = user?.email || 'unknown';

  if (req.method === 'GET') {
    const wantAll = req.query.all === '1';
    if (wantAll && email !== ADMIN_EMAIL) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const scores = await listScores(wantAll ? undefined : email);
    return res.status(200).json({ scores });
  }

  if (req.method === 'POST') {
    const { phase, firm, scores, notes } = req.body || {};
    if (!RFP_PHASES[phase]) return res.status(400).json({ error: 'Invalid phase' });
    if (!firm) return res.status(400).json({ error: 'firm is required' });
    try {
      const saved = await submitScore({ phase, firm, scorerEmail: email, scores: scores || [], notes: notes || '' });
      return res.status(200).json({ score: saved });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ error: 'Method not allowed' });
}
