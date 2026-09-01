// Pure helpers for reading a meeting's location out of its posted agenda PDF and
// turning it into map links. No Node or React specifics here, so both the API
// route (which does the PDF fetch) and the Meetings page can import them.

// A street address as the agendas write it: number, street, town, state, ZIP —
// "290 Greenwich Ave, Greenwich, CT 06830", "90 Hendrie Ave, Riverside, CT 06878".
// Reading the address out of the agenda beats matching on a list of known venues,
// since the committee moves between buildings meeting to meeting.
const ADDRESS_RE = /\d+[A-Za-z]?\s+[^,|\n]{2,60},\s*[A-Za-z .'’-]{2,40},\s*[A-Z]{2}\.?\s*\d{5}(?:-\d{4})?/;

export const UNKNOWN_LOCATION = { mode: 'unknown', venue: null, address: null };

// Everything above the numbered agenda is the meeting's header block. Confining
// the address search to it keeps an address that merely appears inside an agenda
// item (a site visit, a mailing address) from being read as the meeting's own.
function headerBlock(text) {
  const cut = text.search(/^\s*MEETING\s+AGENDA\s*$/im);
  return cut === -1 ? text.split(/\r?\n/).slice(0, 14).join('\n') : text.slice(0, cut);
}

function cleanLine(s) {
  return s.replace(/\s+/g, ' ').trim();
}

// The agendas put venue and address on one line separated by a pipe
// ("Havemeyer Building | 290 Greenwich Ave, ..."), but a venue name can itself
// contain a dash ("Riverside School – Media Center"), so the pipe is the only
// separator that's safe to split on.
function venueFromLine(line, address) {
  const before = line.slice(0, line.indexOf(address));
  return cleanLine(before).replace(/[|,–—-]\s*$/, '').trim() || null;
}

export function parseAgendaLocation(text) {
  if (!text) return UNKNOWN_LOCATION;
  const header = headerBlock(text);
  const hasZoom = /zoom/i.test(text);

  const match = header.match(ADDRESS_RE);
  if (match) {
    const address = cleanLine(match[0]);
    const line = header.split(/\r?\n/).map(cleanLine).find((l) => l.includes(address));
    return {
      mode: hasZoom ? 'hybrid' : 'in-person',
      venue: line ? venueFromLine(line, address) : null,
      address
    };
  }

  if (/virtual\s+meeting\s+via\s+zoom/i.test(header)) {
    return { mode: 'virtual', venue: null, address: null };
  }

  // Last resort for the one venue the committee has used for years, in case an
  // agenda ever names it without spelling out the street address.
  if (/media\s+center/i.test(header)) {
    return {
      mode: hasZoom ? 'hybrid' : 'in-person',
      venue: 'Riverside School – Media Center',
      address: '90 Hendrie Ave, Riverside, CT 06878'
    };
  }

  return UNKNOWN_LOCATION;
}

// The agenda's header states the meeting's actual time right next to its date
// ("Wednesday, September 2nd, 2026 | 5:30 PM ET"). The posted schedule table on
// greenwichschools.org is hand-typed per row and has shipped an AM/PM typo
// before (confirmed 2026-09-01: table said "5:30 am", agenda said "5:30 PM") —
// the agenda is the authoritative source for one specific meeting, so callers
// that already fetch it for a location should prefer this over the table.
export function parseAgendaTime(text) {
  if (!text) return null;
  const header = headerBlock(text);
  const match = header.match(/(\d{1,2}):(\d{2})\s*([AaPp])\.?\s*[Mm]\.?\s*ET\b/);
  return match ? `${match[1]}:${match[2]} ${match[3].toUpperCase()}M` : null;
}

// The API responses are cached for 30 minutes, so a page load right after a
// deploy can still receive the old shape (a bare 'hybrid'/'virtual' string).
export function normalizeLocation(location) {
  if (!location) return UNKNOWN_LOCATION;
  if (typeof location === 'string') return { mode: location, venue: null, address: null };
  return location;
}

// Both are documented universal links: they hand off to the installed map app on
// iOS/Android and fall back to the web map elsewhere. The address alone is the
// query — venue names like "Media Center" only confuse the geocoders.
export function mapLinks(address) {
  const q = encodeURIComponent(address || '');
  return {
    apple: `https://maps.apple.com/?q=${q}`,
    google: `https://www.google.com/maps/search/?api=1&query=${q}`
  };
}
