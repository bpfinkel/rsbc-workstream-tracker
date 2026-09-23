import { updateMemberById, deleteMember } from '../../../lib/sheets';
import { getUserFromRequest } from '../../../lib/supabase/server';
import { isAdmin } from '../../../lib/admin';

export default async function handler(req, res) {
  const { id } = req.query;
  const user = await getUserFromRequest(req, res);
  if (!isAdmin(user?.email)) return res.status(403).json({ error: 'Forbidden' });

  try {
    if (req.method === 'PUT') {
      const member = await updateMemberById(id, req.body || {});
      return res.status(200).json({ member });
    }
    if (req.method === 'DELETE') {
      await deleteMember(id);
      return res.status(204).end();
    }
    res.setHeader('Allow', ['PUT', 'DELETE']);
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
