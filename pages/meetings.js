import { useEffect, useState } from 'react';
import Head from 'next/head';
import Header from '../components/Header';

const ZOOM_LINK = 'https://greenwichct.zoom.us/j/84949247205?pwd=7V3GrwayaIY0i0aw1rAcg81RFRUKWc.1';
const ZOOM_DIAL_IN = '(646) 518-9805';
const ZOOM_MEETING_ID = '849 4924 7205';
const ZOOM_PASSCODE = '2155103';

const VIEWPORT_LOCKED = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no';
const VIEWPORT_UNLOCKED = 'width=device-width, initial-scale=1';

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

function embedUrl(pdfUrl) {
  return `https://docs.google.com/viewer?url=${encodeURIComponent(pdfUrl)}&embedded=true`;
}

function CalendarIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3.5" y="5" width="17" height="16" rx="2" /><path d="M8 3v4M16 3v4M3.5 10h17" /></svg>
  );
}

function FolderIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="M3.5 6.5a1 1 0 0 1 1-1h5l2 2.2h8a1 1 0 0 1 1 1v9.3a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1v-11.5z" /></svg>
  );
}

function LocationIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s7-6.5 7-11.5A7 7 0 0 0 5 9.5C5 14.5 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.3" /></svg>
  );
}

function DocIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3v5h5M6 3h8l5 5v13H6z" /></svg>
  );
}

export default function Meetings() {
  const [data, setData] = useState({ meetings: [], nextIndex: -1, location: 'unknown' });
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [pdfViewer, setPdfViewer] = useState(null);

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

  useEffect(() => {
    const meta = document.querySelector('meta[name="viewport"]');
    if (!meta) return;
    meta.setAttribute('content', pdfViewer ? VIEWPORT_UNLOCKED : VIEWPORT_LOCKED);
    return () => { meta.setAttribute('content', VIEWPORT_LOCKED); };
  }, [pdfViewer]);

  const { meetings, nextIndex, location } = data;
  const nextMeeting = nextIndex >= 0 ? meetings[nextIndex] : null;
  const pastMeetings = meetings.filter((_, i) => i !== nextIndex).slice().reverse();

  function openPdf(e, label, url, dateStr) {
    e.preventDefault();
    setPdfViewer({ title: dateStr ? `${label} — ${formatShortDate(dateStr)}` : label, url });
  }

  return (
    <>
      <Head>
        <title>Riverside School Building Committee — Meetings</title>
      </Head>
      <Header active="meetings" />

      <main>
        {!loaded ? null : (
          <>
            {error ? <div className="empty">{error}</div> : null}

            <div className="workstream-group">
              <div className="ws-header">
                <CalendarIcon />
                <h2>Next Meeting</h2>
              </div>
              {nextMeeting ? (
                <div className="card next-meeting-card">
                  <p className="nm-date">{formatFullDate(nextMeeting.date)}</p>
                  <p className="nm-time">{nextMeeting.time} ET</p>
                  <div className="nm-location">
                    <LocationIcon />
                    <span>
                      {location === 'hybrid' ? (
                        <>Riverside School – Media Center | 90 Hendrie Ave, Riverside, CT 06878<br />Or via Zoom</>
                      ) : location === 'virtual' ? (
                        'Virtual Meeting via Zoom'
                      ) : (
                        'See the agenda below for meeting location'
                      )}
                    </span>
                  </div>
                  <div className="zoom-callout">
                    <div className="zb-label">Zoom Details</div>
                    <div><a href={ZOOM_LINK} target="_blank" rel="noreferrer">{ZOOM_LINK}</a></div>
                    <div>Telephone Dial-In: {ZOOM_DIAL_IN}</div>
                    <div>Meeting ID: {ZOOM_MEETING_ID}</div>
                    <div>Passcode: {ZOOM_PASSCODE}</div>
                  </div>
                  <div className="nm-links">
                    {nextMeeting.agendaUrl ? (
                      <a className="meeting-doc-link" href={nextMeeting.agendaUrl} onClick={(e) => openPdf(e, 'Agenda', nextMeeting.agendaUrl, nextMeeting.date)}>
                        <DocIcon />
                        Agenda
                      </a>
                    ) : (
                      <span className="meeting-doc-pending">Agenda not posted yet</span>
                    )}
                    {nextMeeting.noticeUrl && nextMeeting.noticeUrl !== nextMeeting.agendaUrl ? (
                      <a className="meeting-doc-link" href={nextMeeting.noticeUrl} onClick={(e) => openPdf(e, 'Notice', nextMeeting.noticeUrl, nextMeeting.date)}>
                        <DocIcon />
                        Notice
                      </a>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="empty">No upcoming meeting found on the committee's public schedule.</div>
              )}
            </div>

            <div className="workstream-group">
              <div className="ws-header">
                <FolderIcon />
                <h2>Meeting Archive</h2>
                <span className="ws-count">{pastMeetings.length}</span>
              </div>
              {pastMeetings.length === 0 ? (
                <div className="empty">No past meetings listed yet.</div>
              ) : (
                <div className="archive-list">
                  {pastMeetings.map((m) => (
                    <div className="archive-row" key={m.date}>
                      <span className="archive-date">{formatShortDate(m.date)}</span>
                      <span className="archive-links">
                        {m.agendaUrl ? <a href={m.agendaUrl} onClick={(e) => openPdf(e, 'Agenda', m.agendaUrl, m.date)}>Agenda</a> : null}
                        {m.minutesUrl ? <a href={m.minutesUrl} onClick={(e) => openPdf(e, 'Minutes', m.minutesUrl, m.date)}>Minutes</a> : <span className="pending">Minutes pending</span>}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </main>

      <div className={'overlay' + (pdfViewer ? ' open' : '')} onClick={(e) => { if (e.target === e.currentTarget) setPdfViewer(null); }}>
        {pdfViewer && (
          <div className="modal pdf-viewer">
            <div className="pdf-viewer-header">
              <h3>{pdfViewer.title}</h3>
              <div className="pdf-viewer-header-actions">
                <a href={pdfViewer.url} target="_blank" rel="noreferrer">Open in new tab ↗</a>
                <button className="btn-secondary" onClick={() => setPdfViewer(null)}>Close</button>
              </div>
            </div>
            <iframe src={embedUrl(pdfViewer.url)} title={pdfViewer.title} />
          </div>
        )}
      </div>
    </>
  );
}
