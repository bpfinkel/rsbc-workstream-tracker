import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { createClient } from '../lib/supabase/client';
import { isAdmin } from '../lib/admin';

function HomeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="M12 3l9 5-9 5-9-5 9-5z" /><path d="M3 13l9 5 9-5" /></svg>
  );
}

function TasksIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="M3.5 6.5a1 1 0 0 1 1-1h5l2 2.2h8a1 1 0 0 1 1 1v9.3a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1v-11.5z" /></svg>
  );
}

function RosterIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="3.6" /><path d="M22.5 20v-2a4 4 0 0 0-3-3.87" /><path d="M16 4.13a4 4 0 0 1 0 7.75" /></svg>
  );
}

function MeetingsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3.5" y="5" width="17" height="16" rx="2" /><path d="M8 3v4M16 3v4M3.5 10h17" /></svg>
  );
}

function PublicCalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 20.5h18" /><path d="M4.5 20.5v-9M9.5 20.5v-9M14.5 20.5v-9M19.5 20.5v-9" /><path d="M2.6 11.5L12 5.2l9.4 6.3" /></svg>
  );
}

function DocumentsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3.5h8l4 4V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1z" /><path d="M14 3.5V8h4" /><path d="M8.5 12.5h7M8.5 16h7" /></svg>
  );
}

function ScoringIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3.5l2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.1-5.4 3.1 1.3-6-4.6-4.1 6.1-.6z" /></svg>
  );
}

function AccountIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8.4" r="3.4" /><path d="M5 20a7 7 0 0 1 14 0" /></svg>
  );
}

function AdminIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 17.2V20h2.8L17.8 9 15 6.2 4 17.2z" /><path d="M14 5.2l3 3" /></svg>
  );
}

const NAV_ITEMS = [
  { key: 'home', href: '/', label: 'Home', Icon: HomeIcon },
  { key: 'tasks', href: '/tasks', label: 'Tasks', Icon: TasksIcon },
  { key: 'roster', href: '/roster', label: 'Roster', Icon: RosterIcon },
  { key: 'meetings', href: '/meetings', label: 'Meetings', Icon: MeetingsIcon },
  { key: 'public-meetings', href: '/public-meetings', label: 'Public Board Calendar', Icon: PublicCalendarIcon },
  { key: 'documents', href: '/key-documents', label: 'Key Documents', Icon: DocumentsIcon },
  { key: 'scoring', href: '/scoring', label: 'RFP Scoring', Icon: ScoringIcon },
  { key: 'account', href: '/my-account', label: 'My Account', Icon: AccountIcon }
];

const PAGE_NAME_STYLE = { fontSize: 'clamp(9px, 2.9vw, 12px)', letterSpacing: '0.7px', color: '#eaf1f7' };

// The header's second line doubles as the "you are here" cue: on inner pages it
// shows the page name (taken from NAV_ITEMS, so it can't drift from the menu),
// and on Home / the signed-out auth pages it falls back to the portal name.
function pageLabel(active) {
  if (!active || active === 'home') return null;
  if (active === 'admin') return 'Admin';
  const item = NAV_ITEMS.find((i) => i.key === active);
  return item ? item.label : null;
}

export default function Header({ active }) {
  const [admin, setAdmin] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const pageName = pageLabel(active);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (isAdmin(data?.user?.email)) setAdmin(true);
    });
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    function onDocClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    function onKeyDown(e) {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  return (
    <div className="site-header">
      <header>
        <div className="header-left">
          <Link href="/" aria-label="Home" style={{ display: 'flex', flex: 'none' }}>
            <img src="/api/apple-touch-icon" alt="RSBC" className="header-mark" />
          </Link>
          <div className="header-titles">
            <h1>Riverside School Building Committee</h1>
            {/* The page name is the glance target, so it carries a little more
                presence than the constant subtitle it replaces. */}
            <div className="header-sub" style={pageName ? PAGE_NAME_STYLE : undefined}>
              {pageName || 'Committee Member Portal'}
            </div>
          </div>
        </div>
        <div className="nav-menu-wrap" ref={menuRef}>
          <button
            type="button"
            className="hamburger-btn"
            aria-label="Menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          {menuOpen ? (
            <div className="nav-menu">
              <div className="nav-menu-head">
                <span>Go to</span>
                <button type="button" className="nav-menu-close" aria-label="Close" onClick={() => setMenuOpen(false)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                </button>
              </div>
              <div className="nav-menu-list">
                {NAV_ITEMS.map(({ key, href, label, Icon }) => (
                  <Link
                    key={key}
                    href={href}
                    className={'nav-menu-link' + (active === key ? ' active' : '')}
                    onClick={() => setMenuOpen(false)}
                  >
                    <Icon />
                    {label}
                  </Link>
                ))}
                {admin ? (
                  <>
                    <div className="nav-menu-divider" />
                    <Link
                      href="/admin"
                      className={'nav-menu-link admin-link' + (active === 'admin' ? ' active' : '')}
                      onClick={() => setMenuOpen(false)}
                    >
                      <AdminIcon />
                      Admin
                      <span className="admin-tag">Admin</span>
                    </Link>
                  </>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </header>
      <div className="header-accent" />
    </div>
  );
}
