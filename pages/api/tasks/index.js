import { listTasks, addTask, STATUSES, listMembers } from '../../../lib/sheets';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const [tasks, members] = await Promise.all([listTasks(), listMembers()]);
      const workstreams = Array.from(new Set(tasks.map((t) => t.workstream).filter(Boolean))).sort();
      return res.status(200).json({ tasks, members, statuses: STATUSES, workstreams });
    }
    if (req.method === 'POST') {
      const task = await addTask(req.body || {});
      return res.status(201).json(task);
    }
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
