import { listFirms, setFirmInterviewUnlocked } from '../../../lib/sheets';
import { getUserFromRequest } from '../../../lib/supabase/server';
import { isAdmin } from '../../../lib/admin';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const firms = await listFirms();
    return res.status(200).json({ firms });
  }

  if (req.method === 'POST') {
    const user = await getUserFromRequest(req, res);
    if (!isAdmin(user?.email)) {
      return res.status(403).json({ error: 'Only an admin can change interview-scoring access' });
    }
    const { firm, interviewUnlocked } = req.body || {};
    if (!firm) return res.status(400).json({ error: 'firm is required' });
    try {
      await setFirmInterviewUnlocked(firm, !!interviewUnlocked);
      return res.status(200).json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ error: 'Method not allowed' });
}
