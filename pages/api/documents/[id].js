import { approveDraftDocument, rejectDraftDocument, moveDraftDocumentToPending, overrideApproveDraftDocument, updateKeyDocument } from '../../../lib/sheets';
import { getUserFromRequest } from '../../../lib/supabase/server';

export default async function handler(req, res) {
  const { id } = req.query;
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { action, title, category, driveLink } = req.body || {};
  const fields = { title, category, driveLink };
  const user = await getUserFromRequest(req, res);
  const actor = user?.email || 'unknown';
  try {
    if (action === 'approve') {
      const document = await approveDraftDocument(id, fields, actor);
      return res.status(200).json({ document });
    }
    if (action === 'reject') {
      await rejectDraftDocument(id, actor);
      return res.status(200).json({ ok: true });
    }
    if (action === 'move-to-pending') {
      await moveDraftDocumentToPending(id, actor);
      return res.status(200).json({ ok: true });
    }
    if (action === 'override-approve') {
      const document = await overrideApproveDraftDocument(id, fields, actor);
      return res.status(200).json({ document });
    }
    if (action === 'update') {
      const document = await updateKeyDocument(id, { title, category });
      return res.status(200).json({ document });
    }
    return res.status(400).json({ error: 'action must be "approve", "reject", "move-to-pending", "override-approve", or "update"' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
