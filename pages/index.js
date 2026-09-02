import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Header from '../components/Header';
import { createClient } from '../lib/supabase/client';
import { isAdmin } from '../lib/admin';
import { UNKNOWN_LOCATION, normalizeLocation } from '../lib/meetingLocation';
import { ZOOM_LINK, ZOOM_MEETING_ID, ZOOM_PASSCODE } from '../lib/zoom';

function ChevronRightIcon() {
  return (
    <svg className="hub-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
  );
}

function TasksIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="M3.5 6.5a1 1 0 0 1 1-1h5l2 2.2h8a1 1 0 0 1 1 1v9.3a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1v-11.5z" /></svg>
  );
}

function RosterIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="3.6" /><path d="M22.5 20v-2a4 4 0 0 0-3-3.87" /><path d="M16 4.13a4 4 0 0 1 0 7.75" /></svg>
  );
}

function MeetingsIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3.5" y="5" width="17" height="16" rx="2" /><path d="M8 3v4M16 3v4M3.5 10h17" /></svg>
  );
}

function PublicCalendarIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 20.5h18" /><path d="M4.5 20.5v-9M9.5 20.5v-9M14.5 20.5v-9M19.5 20.5v-9" /><path d="M2.6 11.5L12 5.2l9.4 6.3" /></svg>
  );
}

function DocumentsIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3.5h8l4 4V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1z" /><path d="M14 3.5V8h4" /><path d="M8.5 12.5h7M8.5 16h7" /></svg>
  );
}

function ScoringIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3.5l2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.1-5.4 3.1 1.3-6-4.6-4.1 6.1-.6z" /></svg>
  );
}

function AccountIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8.4" r="3.4" /><path d="M5 20a7 7 0 0 1 14 0" /></svg>
  );
}

function AdminIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 17.2V20h2.8L17.8 9 15 6.2 4 17.2z" /><path d="M14 5.2l3 3" /></svg>
  );
}

function LocationIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s7-6.5 7-11.5A7 7 0 0 0 5 9.5C5 14.5 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.3" /></svg>
  );
}

function VideoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="12" height="12" rx="2" /><path d="M15 10.5l6-3.5v10l-6-3.5" /></svg>
  );
}

function SmallDocIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3.5h8l4 4V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1z" /><path d="M14 3.5V8h4" /></svg>
  );
}

const HUB_ITEMS = [
  { href: '/tasks', title: 'Tasks', tone: 'blue', Icon: TasksIcon },
  { href: '/roster', title: 'Roster', tone: 'accent', Icon: RosterIcon },
  { href: '/meetings', title: 'Meetings', tone: 'navy', Icon: MeetingsIcon },
  { href: '/public-meetings', title: 'Public Board Calendar', tone: 'teal', Icon: PublicCalendarIcon },
  { href: '/key-documents', title: 'Key Documents', tone: 'purple', Icon: DocumentsIcon },
  { href: '/scoring', title: 'RFP Scoring', tone: 'amber', Icon: ScoringIcon },
  { href: '/my-account', title: 'My Account', tone: 'slate', Icon: AccountIcon }
];

// Same conventions as the Tasks page, so a deadline reads identically wherever
// it appears: local midnight-to-midnight day counting, M/D/YYYY dates.
function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + 'T00:00:00');
  return Math.round((d - today) / 86400000);
}

function formatShortDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${m}/${d}/${y}`;
}

function statusClass(s) {
  return 'status-' + String(s || '').replace(/\s+/g, '-');
}

function formatMeetingDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

// Everything the committee does is on Eastern time, and Vercel runs in UTC —
// the same reason pages/api/meetings.js computes its own todayET.
function todayInET() {
  return new Date().toLocaleDateString('en-US', {
    timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  });
}

function greetingFor(name) {
  const hour = Number(new Date().toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', hourCycle: 'h23' })) % 24;
  const part = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const first = name ? String(name).trim().split(/\s+/)[0] : '';
  return first ? `${part}, ${first}` : part;
}

function NextMeetingPanel({ data }) {
  if (!data) {
    return (
      <div className="home-next">
        <div className="home-next-when">Checking the schedule&hellip;</div>
      </div>
    );
  }

  const { meetings = [], nextIndex = -1, location } = data;
  const meeting = nextIndex >= 0 ? meetings[nextIndex] : null;

  if (!meeting) {
    return (
      <div className="home-next">
        <div className="home-next-when">Not posted yet</div>
        <div className="home-next-where">
          <LocationIcon />
          <span>Nothing upcoming appears on the committee&rsquo;s public schedule.</span>
        </div>
        <div className="home-next-actions">
          <Link href="/meetings" className="btn-secondary">Meeting archive</Link>
        </div>
      </div>
    );
  }

  const { mode, venue, address } = normalizeLocation(location || UNKNOWN_LOCATION);
  const onZoom = mode !== 'in-person';
  const whereText = address
    ? [venue, address].filter(Boolean).join(' · ')
    : mode === 'virtual'
      ? 'Virtual meeting via Zoom'
      : 'See the agenda for the meeting location';

  return (
    <div className="home-next">
      <div className="home-next-when">
        {formatMeetingDate(meeting.date)}{meeting.time ? ` · ${meeting.time}` : ''}
      </div>
      <div className="home-next-where">
        {onZoom && !address ? <VideoIcon /> : <LocationIcon />}
        <span>{whereText}</span>
      </div>
      {onZoom ? (
        <div className="home-next-zoom">Zoom meeting ID {ZOOM_MEETING_ID} · Passcode {ZOOM_PASSCODE}</div>
      ) : null}
      <div className="home-next-actions">
        <Link href="/meetings" className="btn-primary">Agenda &amp; details</Link>
        {onZoom ? (
          <a className="btn-secondary" href={ZOOM_LINK} target="_blank" rel="noreferrer">Join Zoom</a>
        ) : null}
      </div>
    </div>
  );
}

function MyTasksPanel({ tasks, myName, loaded }) {
  // Overdue first, then soonest deadline; anything without a deadline sits at
  // the bottom rather than sorting as if it were due in 1970.
  const mine = useMemo(() => {
    if (!myName) return [];
    return tasks
      .filter((t) => t.status !== 'Completed' && t.assignees.includes(myName))
      .slice()
      .sort((a, b) => {
        if (!a.deadline && !b.deadline) return 0;
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return a.deadline.localeCompare(b.deadline);
      })
      .slice(0, 5);
  }, [tasks, myName]);

  return (
    <div className="home-panel">
      <div className="home-panel-head">
        <h2>Assigned to me{mine.length ? ` (${mine.length})` : ''}</h2>
        <Link href="/tasks" className="home-panel-link">View all tasks</Link>
      </div>
      {!loaded ? (
        <div className="home-panel-note">Loading your tasks&hellip;</div>
      ) : !myName ? (
        <div className="home-panel-note">
          The roster doesn&rsquo;t list the address you signed in with, so we can&rsquo;t match tasks to you yet.
        </div>
      ) : mine.length === 0 ? (
        <div className="home-panel-note">Nothing open is assigned to you right now.</div>
      ) : (
        mine.map((t) => {
          const du = daysUntil(t.deadline);
          let dueClass = '';
          let dueLabel = 'No deadline';
          if (du !== null) {
            dueLabel = formatShortDate(t.deadline);
            if (du < 0) dueClass = 'overdue';
            else if (du <= 7) dueClass = 'soon';
          }
          return (
            <div className="home-task" key={t.id}>
              <Link href="/tasks" className="home-task-title">{t.title}</Link>
              <span className={'badge ' + statusClass(t.status)}>{t.status}</span>
              <span className={'home-task-due ' + dueClass}>{dueLabel}</span>
            </div>
          );
        })
      )}
    </div>
  );
}

export default function HomePage() {
  const [admin, setAdmin] = useState(false);
  const [myEmail, setMyEmail] = useState(null);
  const [meetingData, setMeetingData] = useState(null);
  const [taskData, setTaskData] = useState(null);
  const [documents, setDocuments] = useState([]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      const email = data?.user?.email || null;
      setMyEmail(email);
      if (isAdmin(email)) setAdmin(true);
    });
  }, []);

  // Three independent loads: a panel that fails leaves the rest of the page
  // intact rather than blanking the hub, which is still the page's main job.
  useEffect(() => {
    fetch('/api/meetings').then((r) => r.json()).then(setMeetingData).catch(() => setMeetingData({ meetings: [], nextIndex: -1 }));
    fetch('/api/tasks').then((r) => r.json()).then(setTaskData).catch(() => setTaskData({ tasks: [], members: [] }));
    fetch('/api/key-documents').then((r) => r.json()).then((d) => setDocuments(d.documents || [])).catch(() => setDocuments([]));
  }, []);

  const tasks = taskData?.tasks || [];
  const members = taskData?.members || [];

  // Same roster-email match the Tasks page uses for "Mark Complete": the sheet
  // is the only place that maps a sign-in address to an assignee name.
  const myName = useMemo(() => {
    if (!myEmail) return null;
    const me = members.find((m) => m.email && m.email.toLowerCase() === myEmail.toLowerCase());
    return me ? me.name : null;
  }, [members, myEmail]);

  const recentDocs = useMemo(() => {
    return documents
      .slice()
      .sort((a, b) => String(b.addedAt || '').localeCompare(String(a.addedAt || '')))
      .slice(0, 3);
  }, [documents]);

  return (
    <>
      <Head>
        <title>Riverside School Building Committee</title>
      </Head>
      <Header active="home" />

      <main className="hub">
        <div className="home-inner">
          <h1 className="home-greet">{greetingFor(myName)}</h1>
          <div className="home-date">{todayInET()}</div>

          <div className="home-cols">
            <div className="home-main">
              <div className="home-main-block">
                <div className="home-section-label">Meetings</div>
                <NextMeetingPanel data={meetingData} />
              </div>
              <div className="home-main-block">
                <div className="home-section-label">Tasks</div>
                <MyTasksPanel tasks={tasks} myName={myName} loaded={!!taskData} />
              </div>
            </div>

            <div className="home-rail">
              <div className="home-rail-block">
                <div className="home-section-label">Go to</div>
                <div className="home-rail-links">
                  {HUB_ITEMS.map(({ href, title, tone, Icon }) => (
                    <Link href={href} className="hub-card" key={href}>
                      <div className="hub-card-head">
                        <div className={'hub-icon hub-icon-' + tone}>
                          <Icon />
                        </div>
                        <h3>{title}</h3>
                        <ChevronRightIcon />
                      </div>
                    </Link>
                  ))}
                  {admin ? (
                    <Link href="/admin" className="hub-card">
                      <div className="hub-card-head">
                        <div className="hub-icon hub-icon-red">
                          <AdminIcon />
                        </div>
                        <div className="hub-title-row">
                          <h3>Admin</h3>
                          <span className="hub-badge">Admin</span>
                        </div>
                      </div>
                    </Link>
                  ) : null}
                </div>
              </div>

              {recentDocs.length ? (
                <div className="home-rail-block">
                  <div className="home-section-label">Recently added documents</div>
                  <div className="home-panel">
                    {recentDocs.map((doc) => (
                      <Link href="/key-documents" className="home-doc" key={doc.id}>
                        <span className="home-doc-icon hub-icon-purple"><SmallDocIcon /></span>
                        <span className="home-doc-title">{doc.title}</span>
                        {doc.category ? <span className="home-doc-cat">{doc.category}</span> : null}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
