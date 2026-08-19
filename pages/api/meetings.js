import pdfParse from 'pdf-parse/lib/pdf-parse.js';

const SOURCE_URL = 'https://www.greenwichschools.org/departments/facilities-rentals/building-grounds-projects/riverside-building-committee';
const BASE_URL = 'https://www.greenwichschools.org';

function stripTags(html) {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function extractLink(cellHtml) {
  const m = cellHtml.match(/href="([^"]+)"/);
  if (!m) return null;
  let href = m[1];
  if (href.startsWith('/')) href = BASE_URL + href;
  return href;
}

function parseDateStr(raw) {
  const m = raw.trim().match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (!m) return null;
  const [, mm, dd, yyyy] = m;
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}

function parseMeetings(html) {
  const tableMatch = html.match(/<table[^>]*>([\s\S]*?)<\/table>/i);
  if (!tableMatch) return [];
  const tableHtml = tableMatch[1];

  const rows = [];
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  while ((rowMatch = rowRegex.exec(tableHtml))) {
    const cells = [];
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let cellMatch;
    while ((cellMatch = cellRegex.exec(rowMatch[1]))) {
      cells.push(cellMatch[1]);
    }
    if (cells.length) rows.push(cells);
  }

  return rows
    .map((cells) => ({
      date: parseDateStr(stripTags(cells[0] || '')),
      time: stripTags(cells[1] || ''),
      noticeUrl: extractLink(cells[2] || ''),
      agendaUrl: extractLink(cells[3] || ''),
      minutesUrl: extractLink(cells[4] || '')
    }))
    .filter((m) => m.date)
    .sort((a, b) => a.date.localeCompare(b.date));
}

// The committee's own agenda-drafting workflow always writes one of two exact
// location lines into the PDF ("Virtual Meeting via Zoom" or "...Media Center...").
// Reading the actual posted agenda beats guessing from a fixed date cutoff, since
// the virtual-vs-hybrid decision is made meeting-by-meeting, not on a set schedule.
async function detectLocation(agendaUrl) {
  if (!agendaUrl) return 'unknown';
  try {
    const pdfRes = await fetch(agendaUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (RSBC Workstream Tracker)' } });
    if (!pdfRes.ok) return 'unknown';
    const buf = Buffer.from(await pdfRes.arrayBuffer());
    const { text } = await pdfParse(buf);
    const t = text.toLowerCase();
    if (t.includes('media center') || t.includes('90 hendrie')) return 'hybrid';
    if (t.includes('virtual meeting via zoom')) return 'virtual';
    return 'unknown';
  } catch (err) {
    return 'unknown';
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const todayET = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  try {
    const pageRes = await fetch(SOURCE_URL, { headers: { 'User-Agent': 'Mozilla/5.0 (RSBC Workstream Tracker)' } });
    if (!pageRes.ok) throw new Error('Committee website returned ' + pageRes.status);
    const html = await pageRes.text();
    const meetings = parseMeetings(html);
    const nextIndex = meetings.findIndex((m) => m.date >= todayET);
    const location = nextIndex >= 0 ? await detectLocation(meetings[nextIndex].agendaUrl) : 'unknown';
    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');
    return res.status(200).json({ meetings, nextIndex, todayET, location, sourceUrl: SOURCE_URL });
  } catch (err) {
    return res.status(200).json({ meetings: [], nextIndex: -1, todayET, location: 'unknown', error: err.message, sourceUrl: SOURCE_URL });
  }
}
