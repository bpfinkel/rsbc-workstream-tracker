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

function parseMeetingRows(tableHtml) {
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
    .filter((m) => m.date);
}

// The committee's website posts one <table> per school year (e.g. "2026-2027
// Meetings", "2025-2026 Meeting", "2024-2025 Meetings"), each immediately
// preceded by an "fsElementTitle" <h2> heading with that exact label. Matching
// heading+table pairs picks up every school year present on the page, not
// just whichever one happens to be first, without hardcoding which years exist.
function parseAllMeetings(html) {
  const sectionRegex = /<h2 class="fsElementTitle"[^>]*>\s*<a[^>]*>([^<]+)<\/a>\s*<\/h2>[\s\S]*?<table[^>]*>([\s\S]*?)<\/table>/g;
  const all = [];
  let sectionMatch;
  while ((sectionMatch = sectionRegex.exec(html))) {
    const headingText = sectionMatch[1];
    const yearMatch = headingText.match(/(\d{4}-\d{4})/);
    const schoolYear = yearMatch ? yearMatch[1] : headingText.trim();
    const rows = parseMeetingRows(sectionMatch[2]).map((m) => ({ ...m, schoolYear }));
    all.push(...rows);
  }
  return all.sort((a, b) => a.date.localeCompare(b.date));
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
    const meetings = parseAllMeetings(html);
    const nextIndex = meetings.findIndex((m) => m.date >= todayET);
    const lastIndex = nextIndex === -1 ? meetings.length - 1 : nextIndex - 1;
    const [location, lastLocation] = await Promise.all([
      nextIndex >= 0 ? detectLocation(meetings[nextIndex].agendaUrl) : Promise.resolve('unknown'),
      lastIndex >= 0 ? detectLocation(meetings[lastIndex].agendaUrl) : Promise.resolve('unknown')
    ]);
    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');
    return res.status(200).json({ meetings, nextIndex, lastIndex, todayET, location, lastLocation, sourceUrl: SOURCE_URL });
  } catch (err) {
    return res.status(200).json({ meetings: [], nextIndex: -1, lastIndex: -1, todayET, location: 'unknown', lastLocation: 'unknown', error: err.message, sourceUrl: SOURCE_URL });
  }
}
