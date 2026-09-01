import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import { parseAgendaLocation, parseAgendaTime, UNKNOWN_LOCATION } from '../../lib/meetingLocation';
import { parseRsbcMeetings, RSBC_SOURCE_URL } from '../../lib/rsbcSchedule';

const SOURCE_URL = RSBC_SOURCE_URL;

// Read the location — and, since the PDF is already being fetched, the time —
// straight out of the posted agenda rather than trusting the schedule table:
// the committee decides virtual vs. in-person meeting by meeting (and when it
// does meet in person the building varies), and the table has shipped at least
// one AM/PM typo the agenda itself got right. The parsing lives in
// lib/meetingLocation.js so it can be tested directly.
async function detectAgendaDetails(agendaUrl) {
  if (!agendaUrl) return { location: UNKNOWN_LOCATION, time: null };
  try {
    const pdfRes = await fetch(agendaUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (RSBC Workstream Tracker)' } });
    if (!pdfRes.ok) return { location: UNKNOWN_LOCATION, time: null };
    const buf = Buffer.from(await pdfRes.arrayBuffer());
    const { text } = await pdfParse(buf);
    return { location: parseAgendaLocation(text), time: parseAgendaTime(text) };
  } catch (err) {
    return { location: UNKNOWN_LOCATION, time: null };
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
    const [nextDetails, lastDetails] = await Promise.all([
      nextIndex >= 0 ? detectAgendaDetails(meetings[nextIndex].agendaUrl) : Promise.resolve({ location: UNKNOWN_LOCATION, time: null }),
      lastIndex >= 0 ? detectAgendaDetails(meetings[lastIndex].agendaUrl) : Promise.resolve({ location: UNKNOWN_LOCATION, time: null })
    ]);
    // The agenda's time overrides the table's whenever the agenda states one —
    // it's the more authoritative, meeting-specific document.
    if (nextIndex >= 0 && nextDetails.time) meetings[nextIndex] = { ...meetings[nextIndex], time: nextDetails.time };
    if (lastIndex >= 0 && lastDetails.time) meetings[lastIndex] = { ...meetings[lastIndex], time: lastDetails.time };
    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');
    return res.status(200).json({
      meetings,
      nextIndex,
      lastIndex,
      todayET,
      location: nextDetails.location,
      lastLocation: lastDetails.location,
      sourceUrl: SOURCE_URL
    });
  } catch (err) {
    return res.status(200).json({ meetings: [], nextIndex: -1, lastIndex: -1, todayET, location: UNKNOWN_LOCATION, lastLocation: UNKNOWN_LOCATION, error: err.message, sourceUrl: SOURCE_URL });
  }
}
