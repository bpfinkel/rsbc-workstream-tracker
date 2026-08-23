import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Header from '../components/Header';
import { createClient } from '../lib/supabase/client';
import { isAdmin } from '../lib/admin';

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

function DraftIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 17.2V20h2.8L17.8 9 15 6.2 4 17.2z" /><path d="M14 5.2l3 3" /></svg>
  );
}

const HUB_ITEMS = [
  { href: '/tasks', title: 'Tasks', desc: 'Track tasks, deadlines, and who owns what.', tone: 'blue', Icon: TasksIcon },
  { href: '/roster', title: 'Roster', desc: 'Committee member contact info, roles, and status.', tone: 'accent', Icon: RosterIcon },
  { href: '/meetings', title: 'Meetings', desc: 'Agendas, minutes, and the upcoming schedule.', tone: 'navy', Icon: MeetingsIcon },
  { href: '/scoring', title: 'RFP Scoring', desc: 'Score architect and contractor proposals.', tone: 'amber', Icon: ScoringIcon },
  { href: '/my-account', title: 'My Account', desc: 'Update your password and contact card.', tone: 'slate', Icon: AccountIcon }
];

export default function HomePage() {
  const [admin, setAdmin] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (isAdmin(data?.user?.email)) setAdmin(true);
    });
  }, []);

  return (
    <>
      <Head>
        <title>Riverside School Building Committee</title>
      </Head>
      <Header active="home" />

      <main className="hub">
        <div className="hub-intro">
          <h2>Where would you like to go?</h2>
          <p>Everything the committee tracks, in one place.</p>
        </div>

        <div className="hub-grid">
          {HUB_ITEMS.map(({ href, title, desc, tone, Icon }) => (
            <Link href={href} className="hub-card" key={href}>
              <div className="hub-card-head">
                <div className={'hub-icon hub-icon-' + tone}>
                  <Icon />
                </div>
                <h3>{title}</h3>
                <ChevronRightIcon />
              </div>
              <p>{desc}</p>
            </Link>
          ))}

          {admin ? (
            <Link href="/drafts" className="hub-card">
              <div className="hub-card-head">
                <div className="hub-icon hub-icon-red">
                  <DraftIcon />
                </div>
                <div className="hub-title-row">
                  <h3>Draft Tasks</h3>
                  <span className="hub-badge">Admin</span>
                </div>
              </div>
              <p>Preview tasks auto-imported from meeting notes.</p>
            </Link>
          ) : null}
        </div>
      </main>
    </>
  );
}
