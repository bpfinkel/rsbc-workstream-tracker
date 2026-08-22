import { listMembers, updateMember } from '../../lib/sheets';
import { getUserFromRequest } from '../../lib/supabase/server';
import { isAdmin } from '../../lib/admin';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const members = await listMembers();
      return res.status(200).json({ members });
    }
    if (req.method === 'PUT') {
      const user = await getUserFromRequest(req, res);
      if (!user?.email) return res.status(401).json({ error: 'Unauthorized' });

      const { name, email, phone } = req.body || {};
      if (!name) return res.status(400).json({ error: 'name is required' });

      const members = await listMembers();
      const target = members.find((m) => m.name === name);
      if (!target) return res.status(404).json({ error: 'Member not found' });

      const admin = isAdmin(user.email);
      const isSelf = target.email && target.email.toLowerCase() === user.email.toLowerCase();
      if (!isSelf && !admin) {
        return res.status(403).json({ error: 'You can only edit your own contact card' });
      }

      // Email is what matches a signed-in user to their roster row, so only an
      // admin may change it — letting someone edit their own would risk them
      // locking themselves out of self-service editing on the next visit.
      const fields = admin ? { email, phone } : { phone };
      const member = await updateMember(name, fields);
      return res.status(200).json({ member });
    }
    res.setHeader('Allow', ['GET', 'PUT']);
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
