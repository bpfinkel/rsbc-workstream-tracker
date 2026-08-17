import { listMembers } from '../../lib/sheets';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const members = await listMembers();
      return res.status(200).json({ members });
    }
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
