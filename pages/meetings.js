import { useEffect, useState } from 'react';
import Head from 'next/head';
import Header from '../components/Header';

const ZOOM_LINK = 'https://greenwichct.zoom.us/j/84949247205?pwd=7V3GrwayaIY0i0aw1rAcg81RFRUKWc.1';
const ZOOM_DIAL_IN = '(646) 518-9805';
const ZOOM_MEETING_ID = '849 4924 7205';
const ZOOM_PASSCODE = '2155103';

function formatFullDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function formatShortDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${m}/${d}/${y}`;
}

export default function Meetings() {
  const [data, setData] = useState({ meetings: [], nextIndex: -1, location: 'unknown' });
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/meetings')
      .then((res) => res.json())
      .then((d) => {
        setData(d);
        if (d.error) setError('Live meeting schedule is temporarily unavailable — showing what we have.');
        setLoaded(true);
      })
      .catch((e) => { setError(e.message); setLoaded(true); });
  }, []);

  const { meetings, nextIndex, location } = data;
  const nextMeeting = nextIndex >= 0 ? meetings[nextIndex] : null;
  const pastMeetings = meetings.filter((_, i) => i !== nextIndex).slice().reverse();

  return (
    <>
      <Head>
        <title>Riverside School Building Committee — Meetings</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Header active="meetings" />

      <main>
        {!loaded ? null : (
          <>
            {error ? <div className="empty">{error}</div> : null}

            <div className="workstream-group">
              <h2>Next Meeting</h2>
              {nextMeeting ? (
                <div className="card next-meeting-card">
                  <p className="title">{formatFullDate(nextMeeting.date)}</p>
                  <p className="desc">{nextMeeting.time} ET</p>
                  <p className="desc">
                    {location === 'hybrid' ? (
                      <>Riverside School – Media Center | 90 Hendrie Ave, Riverside, CT 06878<br />Or via Zoom</>
                    ) : location === 'virtual' ? (
                      'Virtual Meeting via Zoom'
                    ) : (
                      'See the agenda below for meeting location'
                    )}
                  </p>
                  <div className="zoom-block">
                    <div><a href={ZOOM_LINK} target="_blank" rel="noreferrer">{ZOOM_LINK}</a></div>
                    <div>Telephone Dial-In: {ZOOM_DIAL_IN}</div>
                    <div>Meeting ID: {ZOOM_MEETING_ID}</div>
                    <div>Passcode: {ZOOM_PASSCODE}</div>
                  </div>
                  <div style={{ marginTop: 12 }}>
                    {nextMeeting.agendaUrl ? (
                      <a className="chip chip-link" href={nextMeeting.agendaUrl} target="_blank" rel="noreferrer">Agenda</a>
                    ) : (
                      <span className="chip">Agenda not posted yet</span>
                    )}
                    {nextMeeting.noticeUrl && nextMeeting.noticeUrl !== nextMeeting.agendaUrl ? (
                      <a className="chip chip-link" href={nextMeeting.noticeUrl} target="_blank" rel="noreferrer">Notice</a>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="empty">No upcoming meeting found on the committee's public schedule.</div>
              )}
            </div>

            <div className="workstream-group">
              <h2>Meeting Archive ({pastMeetings.length})</h2>
              {pastMeetings.length === 0 ? (
                <div className="empty">No past meetings listed yet.</div>
              ) : (
                <div className="roster-list">
                  {pastMeetings.map((m) => (
                    <div className="roster-row" key={m.date}>
                      <span className="roster-name">{formatShortDate(m.date)}</span>
                      <span className="roster-role">
                        {m.agendaUrl ? <a href={m.agendaUrl} target="_blank" rel="noreferrer" style={{ marginRight: 10 }}>Agenda</a> : null}
                        {m.minutesUrl ? <a href={m.minutesUrl} target="_blank" rel="noreferrer">Minutes</a> : <span style={{ color: 'var(--muted)' }}>Minutes pending</span>}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </>
  );
}
