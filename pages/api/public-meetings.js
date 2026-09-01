import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import { BOARDS, BOARD_ORDER } from '../../lib/publicBoards';
import {
  icalToEvents,
  parseBoeSchedule,
  findBoeCalendarLink,
  sortEvents,
  clockTimeToSortKey
} from '../../lib/publicMeetings';
import { parseAgendaLocation, parseAgendaTime, UNKNOWN_LOCATION } from '../../lib/meetingLocation';
import { parseRsbcMeetings, RSBC_SOURCE_URL } from '../../lib/rsbcSchedule';

const UA = 'Mozilla/5.0 (RSBC Committee Member Portal)';
const TOWN_BASE = 'https://www.greenwichct.gov';
const GPS_BASE = 'https://www.greenwichschools.org';
const BOE_PAGE = `${GPS_BASE}/board-of-education`;

// The town runs CivicPlus, which publishes a real iCal feed per calendar
// category. That beats scraping the rendered calendar page or the posted PDF
// schedules: it carries dates, times and locations as structured data, and the
// town updates it as meetings are added, moved or cancelled.
const icalUrl = (catId) =>
  `${TOWN_BASE}/common/modules/iCalendar/iCalendar.aspx?catID=${catId}&feed=calendar`;

// Each feed mixes a board's headline meeting in with its committee and
// subcommittee meetings. `primaryPattern` marks the headline ones so the page
// can default to the curated view without throwing the rest away.
const TOWN_FEEDS = [
  { board: 'bos', catId: 30, primaryPattern: /^board of selectmen meeting/i, primaryChip: 'Selectmen' },
  { board: 'rtm', catId: 46, primaryPattern: /^rtm full meeting/i, primaryChip: 'RTM Full' },
  { board: 'bet', catId: 38, primaryPattern: /^bet regular\b/i, primaryChip: 'BET Regular' },
  { board: 'pz', catId: 29, primaryPattern: /commission meeting$/i, primaryChip: 'P&Z' }
];

// The feeds still carry a handful of orphaned 2019–2020 events. Anything older
// than this is stale data rather than history worth showing.
const LOOKBACK_DAYS = 180;

function shiftIsoDate(iso, days) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

async function fetchTownFeed({ board, catId, primaryPattern, primaryChip }) {
  const url = icalUrl(catId);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`Town calendar returned ${res.status}`);
    const events = icalToEvents(await res.text(), {
      board,
      primaryPattern,
      primaryChip,
      townBase: TOWN_BASE
    });
    return { board, events, ok: true, error: null };
  } catch (err) {
    return { board, events: [], ok: false, error: err.message };
  }
}

async function fetchBoeSchedule() {
  try {
    const pageRes = await fetch(BOE_PAGE, { headers: { 'User-Agent': UA } });
    if (!pageRes.ok) throw new Error(`Greenwich Public Schools returned ${pageRes.status}`);
    const link = findBoeCalendarLink(await pageRes.text());
    if (!link) throw new Error('No Board of Education meeting calendar is linked on the district page');

    const pdfUrl = link.href.startsWith('http') ? link.href : GPS_BASE + link.href;
    const pdfRes = await fetch(pdfUrl, { headers: { 'User-Agent': UA } });
    if (!pdfRes.ok) throw new Error(`Board of Education calendar returned ${pdfRes.status}`);
    const { text } = await pdfParse(Buffer.from(await pdfRes.arrayBuffer()));

    const events = parseBoeSchedule(text, { defaultYear: link.startYear });
    if (!events.length) throw new Error('Could not read any meeting dates from the posted calendar');
    return {
      board: 'boe',
      events,
      ok: true,
      error: null,
      documentUrl: pdfUrl,
      documentLabel: link.label,
      schoolYear: link.schoolYear
    };
  } catch (err) {
    return { board: 'boe', events: [], ok: false, error: err.message };
  }
}

// Reads a meeting's venue and (as a correction on the schedule table, which
// has shipped an AM/PM typo before) its time straight out of the posted
// agenda PDF. Shares its parsing with pages/api/meetings.js via
// lib/meetingLocation.js; each route still does its own fetch/pdfParse
// wiring, matching this codebase's existing split between pure lib parsers
// and route-owned network calls.
async function detectAgendaDetails(agendaUrl) {
  if (!agendaUrl) return { location: UNKNOWN_LOCATION, time: null };
  try {
    const pdfRes = await fetch(agendaUrl, { headers: { 'User-Agent': UA } });
    if (!pdfRes.ok) return { location: UNKNOWN_LOCATION, time: null };
    const buf = Buffer.from(await pdfRes.arrayBuffer());
    const { text } = await pdfParse(buf);
    return { location: parseAgendaLocation(text), time: parseAgendaTime(text) };
  } catch (err) {
    return { location: UNKNOWN_LOCATION, time: null };
  }
}

function formatEventLocation(details) {
  if (!details || !details.location.address) return null;
  return [details.location.venue, details.location.address].filter(Boolean).join(' — ');
}

// The committee's own schedule table (the same source pages/api/meetings.js
// reads for the Meetings page) carries no attendance-format text, so unlike
// the town feeds every row becomes a single primary event — there's no
// committee/subcommittee split to hide behind the "Include committee &
// subcommittee meetings" toggle. Only the immediate next and most recent
// meetings get their agenda PDF fetched for a corrected time/venue — doing
// that for every row would add 10-15 PDF fetches on top of the other five
// sources' calls.
async function fetchRsbcSchedule() {
  try {
    const pageRes = await fetch(RSBC_SOURCE_URL, { headers: { 'User-Agent': UA } });
    if (!pageRes.ok) throw new Error(`Committee website returned ${pageRes.status}`);
    const meetings = parseRsbcMeetings(await pageRes.text());
    if (!meetings.length) throw new Error('Could not read any meeting dates from the posted schedule');

    const todayET = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    const nextIndex = meetings.findIndex((m) => m.date >= todayET);
    const lastIndex = nextIndex === -1 ? meetings.length - 1 : nextIndex - 1;
    const [nextDetails, lastDetails] = await Promise.all([
      nextIndex >= 0 ? detectAgendaDetails(meetings[nextIndex].agendaUrl) : null,
      lastIndex >= 0 ? detectAgendaDetails(meetings[lastIndex].agendaUrl) : null
    ]);

    const events = meetings.map((m, i) => {
      const details = i === nextIndex ? nextDetails : i === lastIndex ? lastDetails : null;
      const time = (details && details.time) || m.time || null;
      return {
        id: `rsbc-${m.date}`,
        board: 'rsbc',
        title: 'Riverside Building Committee Meeting',
        chipLabel: 'RSBC',
        date: m.date,
        time,
        sortTime: clockTimeToSortKey(time),
        location: formatEventLocation(details),
        format: details && details.location.mode === 'virtual' ? 'Virtual via Zoom' : null,
        url: m.agendaUrl || m.noticeUrl || null,
        primary: true
      };
    });
    return { board: 'rsbc', events, ok: true, error: null };
  } catch (err) {
    return { board: 'rsbc', events: [], ok: false, error: err.message };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const todayET = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  const floorDate = shiftIsoDate(todayET, -LOOKBACK_DAYS);

  const results = await Promise.all([
    ...TOWN_FEEDS.map(fetchTownFeed),
    fetchBoeSchedule(),
    fetchRsbcSchedule()
  ]);

  const byBoard = new Map(results.map((r) => [r.board, r]));
  const events = sortEvents(
    results.flatMap((r) => r.events).filter((e) => e.date >= floorDate)
  );

  const sources = BOARD_ORDER.map((key) => {
    const result = byBoard.get(key) || { ok: false, error: 'Source not configured', events: [] };
    const boardEvents = events.filter((e) => e.board === key);
    return {
      board: key,
      name: BOARDS[key].name,
      sourceLabel: BOARDS[key].sourceLabel,
      sourceUrl: BOARDS[key].sourceUrl,
      documentUrl: result.documentUrl || null,
      documentLabel: result.documentLabel || null,
      ok: result.ok,
      error: result.error || null,
      count: boardEvents.length,
      // Boards publish different distances into the future; showing how far
      // each one's schedule actually runs is more honest than an empty month.
      publishedThrough: boardEvents.length ? boardEvents[boardEvents.length - 1].date : null
    };
  });

  const failed = sources.filter((s) => !s.ok).map((s) => s.name);

  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');
  return res.status(200).json({
    events,
    sources,
    todayET,
    fetchedAt: new Date().toISOString(),
    error: failed.length ? `Could not refresh: ${failed.join(', ')}` : null
  });
}
