import { listMembers, addMember } from '../../../lib/sheets';
import { getUserFromRequest } from '../../../lib/supabase/server';
import { isAdmin } from '../../../lib/admin';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const members = await listMembers();
      return res.status(200).json({ members });
    }
    if (req.method === 'POST') {
      const user = await getUserFromRequest(req, res);
      if (!isAdmin(user?.email)) return res.status(403).json({ error: 'Forbidden' });

      const { name, role, status, email, phone } = req.body || {};
      if (!name) return res.status(400).json({ error: 'name is required' });

      const member = await addMember({ name, role, status, email, phone });
      return res.status(201).json({ member });
    }
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
