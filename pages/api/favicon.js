import { FAVICON_PNG_B64 } from '../../lib/rsbcIcons';

export default function handler(req, res) {
  const buf = Buffer.from(FAVICON_PNG_B64, 'base64');
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.status(200).send(buf);
}
