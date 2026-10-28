import { listPresentations, PRESENTATIONS_FOLDER_URL } from '../../lib/presentations';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const presentations = await listPresentations();
    // Live from Drive, but a few minutes stale is fine for a deck library.
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({ presentations, folderUrl: PRESENTATIONS_FOLDER_URL });
  } catch (err) {
    return res.status(500).json({ error: err.message, folderUrl: PRESENTATIONS_FOLDER_URL });
  }
}
