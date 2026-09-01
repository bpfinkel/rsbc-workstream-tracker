import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import { parseAgendaLocation, UNKNOWN_LOCATION } from '../../lib/meetingLocation';
import { parseRsbcMeetings, RSBC_SOURCE_URL } from '../../lib/rsbcSchedule';

const SOURCE_URL = RSBC_SOURCE_URL;

// Read the location straight out of the posted agenda PDF rather than guessing
// from a date cutoff or a list of known venues: the committee decides virtual vs.
// in-person meeting by meeting, and when it does meet in person the building
// varies (Riverside School's Media Center, the Havemeyer Building downtown).
// The parsing itself lives in lib/meetingLocation.js so it can be tested directly.
async function detectLocation(agendaUrl) {
  if (!agendaUrl) return UNKNOWN_LOCATION;
  try {
    const pdfRes = await fetch(agendaUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (RSBC Workstream Tracker)' } });
    if (!pdfRes.ok) return UNKNOWN_LOCATION;
    const buf = Buffer.from(await pdfRes.arrayBuffer());
    const { text } = await pdfParse(buf);
    return parseAgendaLocation(text);
  } catch (err) {
    return UNKNOWN_LOCATION;
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
    const meetings = parseRsbcMeetings(html);
    const nextIndex = meetings.findIndex((m) => m.date >= todayET);
    const lastIndex = nextIndex === -1 ? meetings.length - 1 : nextIndex - 1;
    const [location, lastLocation] = await Promise.all([
      nextIndex >= 0 ? detectLocation(meetings[nextIndex].agendaUrl) : Promise.resolve(UNKNOWN_LOCATION),
      lastIndex >= 0 ? detectLocation(meetings[lastIndex].agendaUrl) : Promise.resolve(UNKNOWN_LOCATION)
    ]);
    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');
    return res.status(200).json({ meetings, nextIndex, lastIndex, todayET, location, lastLocation, sourceUrl: SOURCE_URL });
  } catch (err) {
    return res.status(200).json({ meetings: [], nextIndex: -1, lastIndex: -1, todayET, location: UNKNOWN_LOCATION, lastLocation: UNKNOWN_LOCATION, error: err.message, sourceUrl: SOURCE_URL });
  }
}
