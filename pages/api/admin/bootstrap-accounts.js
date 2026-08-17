export default function handler(req, res) {
  return res.status(410).json({ error: 'Disabled - delete this file before merging to main.' });
}
