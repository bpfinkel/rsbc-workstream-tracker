import { listDraftDocuments, listKeyDocuments } from '../../../lib/sheets';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const [draftDocuments, keyDocuments] = await Promise.all([listDraftDocuments(), listKeyDocuments()]);
    const categories = Array.from(new Set(keyDocuments.map((d) => d.category).filter(Boolean))).sort();
    return res.status(200).json({ draftDocuments, categories });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
