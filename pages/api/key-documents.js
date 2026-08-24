import { listKeyDocuments } from '../../lib/sheets';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const documents = await listKeyDocuments();
    return res.status(200).json({ documents });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
