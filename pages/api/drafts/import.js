import { addDrafts } from '../../../lib/sheets';

// Server-to-server import used by the recurring Cowork minutes task, which has
// no browser session to authenticate with. Guarded by a shared secret instead
// of the Supabase cookie check middleware.js uses everywhere else.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secret = process.env.DRAFTS_IMPORT_SECRET;
  const provided = req.headers['x-import-secret'];
  if (!secret || provided !== secret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { sourceMeetingDate, drafts } = req.body || {};
  if (!sourceMeetingDate || !Array.isArray(drafts) || drafts.length === 0) {
    return res.status(400).json({ error: 'sourceMeetingDate and a non-empty drafts array are required' });
  }

  try {
    const saved = await addDrafts(drafts, sourceMeetingDate);
    return res.status(200).json({ drafts: saved });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
