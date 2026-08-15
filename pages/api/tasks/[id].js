import { updateTask, deleteTask } from '../../../lib/sheets';

export default async function handler(req, res) {
  const { id } = req.query;
  try {
    if (req.method === 'PUT') {
      const task = await updateTask({ ...(req.body || {}), id });
      return res.status(200).json(task);
    }
    if (req.method === 'DELETE') {
      await deleteTask(id);
      return res.status(204).end();
    }
    res.setHeader('Allow', ['PUT', 'DELETE']);
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
