import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Header from '../components/Header';
import { useModalViewportLock } from '../lib/useViewportLock';
import { UNKNOWN_LOCATION, mapLinks, normalizeLocation } from '../lib/meetingLocation';
// Moved to lib/zoom.js when the home page's next-meeting panel started showing
// the same details — one definition, two readers.
import { ZOOM_LINK, ZOOM_DIAL_IN, ZOOM_MEETING_ID, ZOOM_PASSCODE } from '../lib/zoom';

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

function HistoryIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3.2 2" /></svg>
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

function ChevronIcon({ open, className }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}
      style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform .15s', flexShrink: 0 }}>
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MeetingLocation({ location, onOpenMaps }) {
  const { mode, venue, address } = normalizeLocation(location);

  if (!address) {
    return (
      <div className="nm-location">
        <LocationIcon />
        <span>{mode === 'virtual' ? 'Virtual Meeting via Zoom' : 'See the agenda below for meeting location'}</span>
      </div>
    );
  }

  return (
    <div className="nm-location">
      <LocationIcon />
      <span>
        {venue ? <>{venue}<br /></> : null}
        <button type="button" className="nm-address-btn" onClick={() => onOpenMaps({ venue, address })}>
          {address}
        </button>
      </span>
    </div>
  );
}

// Apple vs. Google is a per-person preference, and neither platform exposes the
// viewer's default map app, so let them pick rather than guessing from the OS.
function MapChooser({ target, onClose }) {
  const [copied, setCopied] = useState(false);
  const links = mapLinks(target ? target.address : '');

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(target.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch (err) {
      setCopied(false);
    }
  }

  return (
    <div className={'overlay' + (target ? ' open' : '')} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      {target && (
        <div className="modal map-chooser">
          <h3>Open in Maps</h3>
          <p className="map-chooser-address">
            {target.venue ? <><strong>{target.venue}</strong><br /></> : null}
            {target.address}
          </p>
          <div className="map-chooser-actions">
            <a className="btn-secondary map-choice" href={links.apple} target="_blank" rel="noreferrer" onClick={onClose}>Apple Maps</a>
            <a className="btn-secondary map-choice" href={links.google} target="_blank" rel="noreferrer" onClick={onClose}>Google Maps</a>
          </div>
          <div className="map-chooser-foot">
            <button type="button" className="btn-danger" onClick={copyAddress}>{copied ? 'Copied ✓' : 'Copy address'}</button>
            <button type="button" className="btn-secondary" onClick={onClose}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

function MeetingHighlightCard({ meeting, location, openPdf, onOpenMaps }) {
  return (
    <div className="card next-meeting-card">
      <p className="nm-date">{formatFullDate(meeting.date)}</p>
      <p className="nm-time">{meeting.time} ET</p>
      <MeetingLocation location={location} onOpenMaps={onOpenMaps} />
      <div className="zoom-callout">
        <div className="zb-label">Zoom Details</div>
        <div><a href={ZOOM_LINK} target="_blank" rel="noreferrer">{ZOOM_LINK}</a></div>
        <div>Telephone Dial-In: {ZOOM_DIAL_IN}</div>
        <div>Meeting ID: {ZOOM_MEETING_ID}</div>
        <div>Passcode: {ZOOM_PASSCODE}</div>
      </div>
      <div className="nm-links">
        {meeting.agendaUrl ? (
          <a className="meeting-doc-link" href={meeting.agendaUrl} onClick={(e) => openPdf(e, 'Agenda', meeting.agendaUrl, meeting.date)}>
            <DocIcon />
            Agenda
          </a>
        ) : (
          <span className="meeting-doc-pending">Agenda not posted yet</span>
        )}
        {meeting.noticeUrl && meeting.noticeUrl !== meeting.agendaUrl ? (
          <a className="meeting-doc-link" href={meeting.noticeUrl} onClick={(e) => openPdf(e, 'Notice', meeting.noticeUrl, meeting.date)}>
            <DocIcon />
            Notice
          </a>
        ) : null}
        {meeting.minutesUrl ? (
          <a className="meeting-doc-link" href={meeting.minutesUrl} onClick={(e) => openPdf(e, 'Minutes', meeting.minutesUrl, meeting.date)}>
            <DocIcon />
            Minutes
          </a>
        ) : null}
      </div>
    </div>
  );
}

export default function Meetings() {
  const [data, setData] = useState({ meetings: [], nextIndex: -1, lastIndex: -1, location: UNKNOWN_LOCATION, lastLocation: UNKNOWN_LOCATION });
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [pdfViewer, setPdfViewer] = useState(null);
  const [mapTarget, setMapTarget] = useState(null);
  const [nextOpen, setNextOpen] = useState(true);
  // Collapsed by default — the archive and Next Meeting matter more on load,
  // and this keeps the page from opening two full meeting cards deep.
  const [lastOpen, setLastOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(true);
  // null = default state (only the most recent school year open) until the
  // user explicitly expands/collapses one, matching the Drafts History pattern.
  const [expandedYears, setExpandedYears] = useState(null);

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

  useModalViewportLock(!!pdfViewer || !!mapTarget);

  const { meetings, nextIndex, lastIndex, location, lastLocation } = data;
  const nextMeeting = nextIndex >= 0 ? meetings[nextIndex] : null;
  const lastMeeting = lastIndex >= 0 ? meetings[lastIndex] : null;
  const pastMeetings = meetings.filter((_, i) => i !== nextIndex).slice().reverse();

  const yearGroups = useMemo(() => {
    const groups = [];
    const index = new Map();
    pastMeetings.forEach((m) => {
      const key = m.schoolYear || 'Other';
      if (!index.has(key)) {
        index.set(key, groups.length);
        groups.push({ year: key, items: [] });
      }
      groups[index.get(key)].items.push(m);
    });
    return groups;
  }, [pastMeetings]);

  function isYearOpen(year, idx) {
    if (expandedYears === null) return idx === 0;
    return expandedYears.has(year);
  }

  function toggleYear(year) {
    setExpandedYears((prev) => {
      const base = prev === null ? new Set(yearGroups.length > 0 ? [yearGroups[0].year] : []) : prev;
      const next = new Set(base);
      if (next.has(year)) next.delete(year); else next.add(year);
      return next;
    });
  }

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
              <button type="button" className="ws-header ws-header-btn" onClick={() => setNextOpen((o) => !o)}>
                <CalendarIcon />
                <h2>Next Meeting</h2>
                <ChevronIcon open={nextOpen} className="ws-header-chevron" />
              </button>
              {nextOpen ? (
                nextMeeting ? (
                  <MeetingHighlightCard meeting={nextMeeting} location={location} openPdf={openPdf} onOpenMaps={setMapTarget} />
                ) : (
                  <div className="empty">No upcoming meeting found on the committee's public schedule.</div>
                )
              ) : null}
            </div>

            <div className="workstream-group">
              <button type="button" className="ws-header ws-header-btn" onClick={() => setLastOpen((o) => !o)}>
                <HistoryIcon />
                <h2>Last Meeting</h2>
                <ChevronIcon open={lastOpen} className="ws-header-chevron" />
              </button>
              {lastOpen ? (
                lastMeeting ? (
                  <MeetingHighlightCard meeting={lastMeeting} location={lastLocation} openPdf={openPdf} onOpenMaps={setMapTarget} />
                ) : (
                  <div className="empty">No prior meeting found on the committee's public schedule.</div>
                )
              ) : null}
            </div>

            <div className="workstream-group">
              <button type="button" className="ws-header ws-header-btn" onClick={() => setArchiveOpen((o) => !o)}>
                <FolderIcon />
                <h2>Meeting Archive</h2>
                <span className="ws-count">{pastMeetings.length}</span>
                <ChevronIcon open={archiveOpen} className="ws-header-chevron" />
              </button>
              {archiveOpen ? (
                pastMeetings.length === 0 ? (
                  <div className="empty">No past meetings listed yet.</div>
                ) : (
                  yearGroups.map((group, idx) => {
                    const open = isYearOpen(group.year, idx);
                    return (
                      <div key={group.year}>
                        <button type="button" className="date-group-label" onClick={() => toggleYear(group.year)}>
                          <ChevronIcon open={open} />
                          {group.year}
                          <span className="date-group-count">({group.items.length})</span>
                        </button>
                        {open ? (
                          <div className="archive-list">
                            {group.items.map((m) => (
                              <div className="archive-row" key={m.date}>
                                <span className="archive-date">{formatShortDate(m.date)}</span>
                                <span className="archive-links">
                                  {m.agendaUrl ? <a href={m.agendaUrl} onClick={(e) => openPdf(e, 'Agenda', m.agendaUrl, m.date)}>Agenda</a> : null}
                                  {m.minutesUrl ? <a href={m.minutesUrl} onClick={(e) => openPdf(e, 'Minutes', m.minutesUrl, m.date)}>Minutes</a> : <span className="pending">Minutes pending</span>}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                )
              ) : null}
            </div>
          </>
        )}
      </main>

      <MapChooser target={mapTarget} onClose={() => setMapTarget(null)} />

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
