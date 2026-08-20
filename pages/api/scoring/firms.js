import { listFirms, setFirmUnlocked, setAllFirmsUnlocked } from '../../../lib/sheets';
import { getUserFromRequest } from '../../../lib/supabase/server';
import { RFP_PHASES } from '../../../lib/rfpCriteria';

const ADMIN_EMAIL = 'bfinkel.rsbc@gmail.com';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const firms = await listFirms();
    return res.status(200).json({ firms });
  }

  if (req.method === 'POST') {
    const user = await getUserFromRequest(req, res);
    if (user?.email !== ADMIN_EMAIL) {
      return res.status(403).json({ error: 'Only the admin can change scoring access' });
    }
    const { firm, phase, unlocked } = req.body || {};
    if (!RFP_PHASES[phase]) return res.status(400).json({ error: 'Invalid phase' });
    try {
      if (firm) {
        await setFirmUnlocked(firm, phase, !!unlocked);
      } else {
        await setAllFirmsUnlocked(phase, !!unlocked);
      }
      return res.status(200).json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ error: 'Method not allowed' });
}
