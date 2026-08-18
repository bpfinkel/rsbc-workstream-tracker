export default function handler(req, res) {
  return res.status(410).json({ error: 'Disabled. This file should be deleted before merge.' });
}
