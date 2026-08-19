import pdfParse from 'pdf-parse/lib/pdf-parse.js';

export async function extractPdfText(url) {
  if (!url) return '';
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (RSBC Workstream Tracker)' } });
  if (!res.ok) throw new Error('Failed to fetch PDF: ' + res.status);
  const buf = Buffer.from(await res.arrayBuffer());
  const { text } = await pdfParse(buf);
  return text || '';
}
