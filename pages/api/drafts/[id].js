import { approveDraft, rejectDraft, moveDraftToPending, overrideApproveDraft } from '../../../lib/sheets';
import { getUserFromRequest } from '../../../lib/supabase/server';

export default async function handler(req, res) {
  const { id } = req.query;
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { action } = req.body || {};
  const user = await getUserFromRequest(req, res);
  const actor = user?.email || 'unknown';
  try {
    if (action === 'approve') {
      const task = await approveDraft(id, actor);
      return res.status(200).json({ task });
    }
    if (action === 'reject') {
      await rejectDraft(id, actor);
      return res.status(200).json({ ok: true });
    }
    if (action === 'move-to-pending') {
      await moveDraftToPending(id, actor);
      return res.status(200).json({ ok: true });
    }
    if (action === 'override-approve') {
      const task = await overrideApproveDraft(id, actor);
      return res.status(200).json({ task });
    }
    return res.status(400).json({ error: 'action must be "approve", "reject", "move-to-pending", or "override-approve"' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
