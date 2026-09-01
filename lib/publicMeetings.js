// Pure parsers for the Public Board Meeting Calendar's primary sources.
// Deliberately free of any Node-only dependency (no pdf-parse, no fetch) so the
// same functions can be unit-tested against saved source fixtures; the API route
// at pages/api/public-meetings.js owns all of the network + PDF-decoding work.

const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december'
];

export function stripHtml(input) {
  return (input || '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#8217;/gi, "'")
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// RFC 5545 line folding: a CRLF followed by a single space or tab is a
// continuation of the previous line, not a new one. Unfold before parsing or
// every long LOCATION/SUMMARY gets truncated mid-word.
function unfold(text) {
  return text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').replace(/\r\n/g, '\n');
}

function unescapeIcal(value) {
  return (value || '')
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

// Parses only VEVENT blocks — the feed's VTIMEZONE block also contains DTSTART
// lines (the DST changeover rules) which would otherwise be read as meetings.
export function parseIcal(icsText) {
  const text = unfold(icsText || '');
  const events = [];
  const blockRegex = /BEGIN:VEVENT\n([\s\S]*?)END:VEVENT/g;
  let block;
  while ((block = blockRegex.exec(text))) {
    const fields = {};
    for (const line of block[1].split('\n')) {
      const m = line.match(/^([A-Z][A-Z-]*)((?:;[^:]*)?):([\s\S]*)$/);
      if (!m) continue;
      const name = m[1];
      // Keep the first occurrence; CivicPlus never repeats these properties.
      if (!(name in fields)) fields[name] = { params: m[2] || '', value: m[3] };
    }
    if (fields.DTSTART) events.push(fields);
  }
  return events;
}

export function formatClockTime(hhmm) {
  if (!hhmm || hhmm.length < 4) return null;
  let hour = parseInt(hhmm.slice(0, 2), 10);
  const minute = hhmm.slice(2, 4);
  if (Number.isNaN(hour)) return null;
  const suffix = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12;
  if (hour === 0) hour = 12;
  return `${hour}:${minute} ${suffix}`;
}

// Converts a plain "7:30 AM" style time string — the verbatim format the
// RSBC schedule table is posted in — into a zero-padded 24-hour sort key, so
// RSBC's events interleave correctly with the other sources' HHMM sortTime
// values in sortEvents().
export function clockTimeToSortKey(raw) {
  const m = (raw || '').match(/(\d{1,2}):(\d{2})\s*([AaPp])/);
  if (!m) return '';
  let hour = parseInt(m[1], 10) % 12;
  if (m[3].toLowerCase() === 'p') hour += 12;
  return String(hour).padStart(2, '0') + m[2];
}

function toIsoDate(raw) {
  const m = (raw || '').match(/^(\d{4})(\d{2})(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

// The town stuffs whatever it likes into LOCATION — sometimes a real room and
// street address, sometimes (Planning & Zoning) an entire HTML block of Zoom
// dial-in instructions. Return a usable place or nothing at all rather than
// showing the reader a wall of markup.
export function cleanLocation(raw) {
  let value = stripHtml(unescapeIcal(raw || ''));
  value = value.replace(/^[\s\-–—]+/, '').replace(/[\s\-–—]+$/, '').trim();
  if (!value) return null;
  if (/zoom\.us|please use the link|toll free|webinar id/i.test(value)) return null;
  if (/^greenwich ct \d{5}$/i.test(value)) return null;
  if (value.length > 160) value = value.slice(0, 157).trimEnd() + '…';
  return value;
}

// CivicPlus's SUMMARY doubles as an attendance-format note for some boards
// ("... In Person at Town Hall and Virtual via Zoom"). Split that back out so
// the calendar chip stays short without losing the information.
function splitFormat(summary) {
  const clean = (summary || '').replace(/\s+/g, ' ').trim();
  let format = null;
  let title = clean;
  const hybrid = /\s*[-–—]?\s*In Person at Town Hall and Virtual via Zoom\s*$/i;
  const inPerson = /\s*[-–—]?\s*In Person at Town Hall\s*$/i;
  const virtual = /\s*[-–—]?\s*Virtual via Zoom\s*$/i;
  if (hybrid.test(clean)) {
    format = 'Hybrid — Town Hall and Zoom';
    title = clean.replace(hybrid, '');
  } else if (inPerson.test(clean)) {
    format = 'In person at Town Hall';
    title = clean.replace(inPerson, '');
  } else if (virtual.test(clean)) {
    format = 'Virtual via Zoom';
    title = clean.replace(virtual, '');
  }
  return { title: title.trim(), format };
}

export function icalToEvents(icsText, { board, primaryPattern, primaryChip, townBase }) {
  return parseIcal(icsText)
    .map((fields) => {
      const rawStart = fields.DTSTART.value.trim();
      const date = toIsoDate(rawStart);
      if (!date) return null;
      const isAllDay = /VALUE=DATE\b/i.test(fields.DTSTART.params) || !/T\d{4}/.test(rawStart);
      const timeMatch = rawStart.match(/T(\d{4})/);
      const summary = unescapeIcal(fields.SUMMARY ? fields.SUMMARY.value : '');
      const { title, format } = splitFormat(summary);
      if (!title) return null;
      const uid = fields.UID ? fields.UID.value.trim() : '';
      // UID is the town calendar's own event id, so it rebuilds the public
      // listing URL directly — the feed's own URL property just points back at
      // the feed and is useless for linking.
      const url = uid && /^\d+$/.test(uid) ? `${townBase}/Calendar.aspx?EID=${uid}` : null;
      const primary = primaryPattern.test(title);
      return {
        id: `${board}-${uid || date + '-' + title.slice(0, 24)}`,
        board,
        title,
        // Short label for a calendar cell, where there is only room for a few
        // characters: the board's own shorthand for its headline meeting, or a
        // trimmed committee name for everything else.
        chipLabel: (primary && primaryChip) || title.replace(/\s+Meeting$/i, ''),
        date,
        time: isAllDay ? null : formatClockTime(timeMatch ? timeMatch[1] : null),
        sortTime: isAllDay ? '' : (timeMatch ? timeMatch[1] : ''),
        location: cleanLocation(fields.LOCATION ? fields.LOCATION.value : ''),
        format,
        url,
        primary
      };
    })
    .filter(Boolean);
}

// Finds the newest "<YYYY>-<YYYY> Board of Education ... Meeting Calendar" PDF
// linked on the BOE landing page, rather than pinning one resource UUID that
// would go stale the moment the district posts a new school year.
export function findBoeCalendarLink(html) {
  const linkRegex = /<a\b([^>]*)href="(\/fs\/resource-manager\/view\/[^"]+)"([^>]*)>([\s\S]*?)<\/a>/gi;
  let match;
  let best = null;
  while ((match = linkRegex.exec(html))) {
    const attrs = match[1] + match[3];
    const titleAttr = (attrs.match(/title="([^"]*)"/i) || [])[1] || '';
    const label = stripHtml(match[4]) || stripHtml(titleAttr);
    if (!/board of education/i.test(label)) continue;
    if (!/meeting calendar/i.test(label)) continue;
    const years = label.match(/(\d{4})\s*[-–—]\s*(\d{4})/);
    if (!years) continue;
    const startYear = parseInt(years[1], 10);
    if (!best || startYear > best.startYear) {
      best = { startYear, href: match[2], label, schoolYear: `${years[1]}-${years[2]}` };
    }
  }
  return best;
}

const BOE_TYPES = /^(Board Recognition|Board Retreat|Organizational|Special Meeting|Public Hearing|Business|Budget|Retreat|Special)(\*?)/i;

// The posted BOE schedule is a plain date/type/location table. pdf-parse hands
// it back as one text run, and its digit spacing is unreliable ("January 1 4,
// 2027"), so day numbers get their whitespace squeezed out before parsing.
export function parseBoeSchedule(pdfText, { defaultYear } = {}) {
  const flat = (pdfText || '').replace(/\s+/g, ' ').trim();

  const defaultTime = (() => {
    const m = flat.match(/meetings\s+begin\s+at\s*(\d{1,2})\s*:\s*(\d{2})\s*([ap])\.?\s*m/i);
    if (!m) return null;
    const hour = m[1].padStart(2, '0');
    const isPm = m[3].toLowerCase() === 'p';
    let h = parseInt(hour, 10) % 12;
    if (isPm) h += 12;
    return formatClockTime(String(h).padStart(2, '0') + m[2]);
  })();

  const recognitionNote = /\*\s*Board Recognition Meeting/i.test(flat)
    ? 'Board Recognition Meeting'
    : null;

  const rowRegex = new RegExp(
    '(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)\\s*,\\s*' +
      '([A-Za-z]+)\\s+([\\d\\s]{1,6}?)\\s*,\\s*(\\d{4})\\s+' +
      '([\\s\\S]*?)(?=(?:Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)\\s*,|$)',
    'g'
  );

  const rows = [];
  let match;
  while ((match = rowRegex.exec(flat))) {
    const monthIndex = MONTHS.indexOf(match[2].toLowerCase());
    if (monthIndex === -1) continue;
    const day = parseInt(match[3].replace(/\s+/g, ''), 10);
    const year = parseInt(match[4], 10) || defaultYear;
    if (!day || day > 31 || !year) continue;

    let rest = match[5].replace(/\s+/g, ' ').trim();

    // A row may carry its own time ("6:00pm"), overriding the sheet-wide default.
    let time = defaultTime;
    const timeMatch = rest.match(/\(?\s*(\d{1,2})\s*:\s*(\d{2})\s*([ap])\.?\s*m\.?\s*\)?/i);
    if (timeMatch) {
      let h = parseInt(timeMatch[1], 10) % 12;
      if (timeMatch[3].toLowerCase() === 'p') h += 12;
      time = formatClockTime(String(h).padStart(2, '0') + timeMatch[2]);
      rest = rest.replace(timeMatch[0], ' ').replace(/\s+/g, ' ').trim();
    }

    let type = rest;
    let location = null;
    let recognition = false;
    const typeMatch = rest.match(BOE_TYPES);
    if (typeMatch) {
      type = typeMatch[1].trim();
      recognition = typeMatch[2] === '*';
      location = rest.slice(typeMatch[0].length).replace(/^[\s*]+/, '').trim() || null;
    }
    if (/^business$/i.test(type)) type = 'Business Meeting';
    if (/^budget$/i.test(type)) type = 'Budget Meeting';
    if (/^(board )?retreat$/i.test(type)) type = 'Board Retreat';

    const date = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const shortType = type.replace(/\s*Meeting$/i, '').replace(/^Board\s+/i, '');
    rows.push({
      id: `boe-${date}`,
      board: 'boe',
      title: `Board of Education — ${type}`,
      chipLabel: `BOE ${shortType}`,
      date,
      time,
      sortTime: '',
      location,
      format: null,
      note: recognition ? recognitionNote : null,
      url: null,
      primary: true
    });
  }

  // The district has posted the same date twice across revisions before; keep
  // the last row for a given date so a corrected line wins over an earlier one.
  const byDate = new Map();
  for (const row of rows) byDate.set(row.date, row);
  return Array.from(byDate.values());
}

export function sortEvents(events) {
  return events.slice().sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    const at = a.sortTime || '9999';
    const bt = b.sortTime || '9999';
    if (at !== bt) return at.localeCompare(bt);
    return a.title.localeCompare(b.title);
  });
}
