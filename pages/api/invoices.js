import {
  listContracts,
  listInvoices,
  summarize,
  updateInvoice,
  setInvoiceStatus,
  updateContract,
  addContract
} from '../../lib/invoices';
import { getUserFromRequest } from '../../lib/supabase/server';
import { canEditInvoices } from '../../lib/admin';

// Every member can read the ledger and dashboard. Invoice editors (lib/admin.js)
// also get the review queue and may change invoices and contracts.
export default async function handler(req, res) {
  const user = await getUserFromRequest(req, res);
  if (!user?.email) return res.status(401).json({ error: 'Unauthorized' });
  const canEdit = canEditInvoices(user.email);

  try {
    if (req.method === 'GET') {
      const [contracts, invoices] = await Promise.all([listContracts(), listInvoices()]);
      return res.status(200).json({
        canEdit,
        summary: summarize(contracts, invoices),
        // Pending and rejected invoices are the editors' working queue, not
        // part of the record members browse.
        invoices: canEdit ? invoices : invoices.filter((i) => i.status !== 'pending' && i.status !== 'rejected')
      });
    }

    if (req.method === 'POST') {
      if (!canEdit) return res.status(403).json({ error: 'Only invoice editors can change invoices' });
      const { action, id, fields = {}, status, paidDate } = req.body || {};
      const actor = user.email;

      if (action === 'update') {
        if (!id) return res.status(400).json({ error: 'id is required' });
        return res.status(200).json({ invoice: await updateInvoice(id, fields, actor) });
      }
      if (action === 'status') {
        if (!id) return res.status(400).json({ error: 'id is required' });
        return res.status(200).json({ invoice: await setInvoiceStatus(id, status, actor, { paidDate }) });
      }
      if (action === 'update-contract') {
        if (!id) return res.status(400).json({ error: 'id is required' });
        return res.status(200).json({ contract: await updateContract(id, fields) });
      }
      if (action === 'add-contract') {
        return res.status(200).json({ contract: await addContract(fields) });
      }
      return res.status(400).json({ error: 'Unknown action' });
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
