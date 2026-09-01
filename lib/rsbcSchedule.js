// Pure parser for the Riverside Building Committee's own posted meeting
// schedule (greenwichschools.org). Shared by pages/api/meetings.js (the
// committee's Meetings page, which adds per-meeting agenda-PDF location
// detection on top of this) and pages/api/public-meetings.js (the Public
// Board Calendar, which treats RSBC as a sixth board and does not fetch a
// PDF per meeting). No Node-only deps, so it stays testable against a saved
// HTML fixture like the rest of lib/publicMeetings.js.

export const RSBC_BASE_URL = 'https://www.greenwichschools.org';
export const RSBC_SOURCE_URL =
  `${RSBC_BASE_URL}/departments/facilities-rentals/building-grounds-projects/riverside-building-committee`;

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
  if (href.startsWith('/')) href = RSBC_BASE_URL + href;
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
// Meetings", "2025-2026 Meeting", "2024-2025 Meetings"), but the page also has
// other "fsElementTitle" headings with no table of their own (the tab-container
// title, "Committee Members", etc). Matching "heading followed eventually by
// any table" would let those unrelated headings steal a school year's table
// out from under it. Instead, find every table and every heading independently,
// then pair each table with whichever heading immediately precedes it — the
// one relationship that's actually true for these pages — and skip any pairing
// whose heading doesn't say "Meeting(s)" so a future unrelated table can't be
// misread as a schedule.
export function parseRsbcMeetings(html) {
  const headingRegex = /<h2 class="fsElementTitle"[^>]*>\s*<a[^>]*>([^<]+)<\/a>\s*<\/h2>/g;
  const headings = [];
  let headingMatch;
  while ((headingMatch = headingRegex.exec(html))) {
    headings.push({ text: headingMatch[1], index: headingMatch.index });
  }

  const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/g;
  const all = [];
  let tableMatch;
  while ((tableMatch = tableRegex.exec(html))) {
    const tableIndex = tableMatch.index;
    let heading = null;
    for (const h of headings) {
      if (h.index < tableIndex && (!heading || h.index > heading.index)) heading = h;
    }
    const headingText = heading ? heading.text : '';
    if (!/\bMeetings?\b/i.test(headingText)) continue;
    const yearMatch = headingText.match(/(\d{4}-\d{4})/);
    const schoolYear = yearMatch ? yearMatch[1] : headingText.trim();
    const rows = parseMeetingRows(tableMatch[1]).map((m) => ({ ...m, schoolYear }));
    all.push(...rows);
  }
  return all.sort((a, b) => a.date.localeCompare(b.date));
}
