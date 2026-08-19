import { approveDraft, rejectDraft } from '../../../lib/sheets';

export default async function handler(req, res) {
  const { id } = req.query;
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { action } = req.body || {};
  try {
    if (action === 'approve') {
      const task = await approveDraft(id);
      return res.status(200).json({ task });
    }
    if (action === 'reject') {
      await rejectDraft(id);
      return res.status(200).json({ ok: true });
    }
    return res.status(400).json({ error: 'action must be "approve" or "reject"' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
