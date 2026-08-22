import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '../lib/supabase/client';
import { isAdmin } from '../lib/admin';

export default function Header({ active }) {
  const [admin, setAdmin] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (isAdmin(data?.user?.email)) setAdmin(true);
    });
  }, []);

  return (
    <>
      <header>
        <div className="header-left">
          <img src="/api/apple-touch-icon" alt="RSBC" className="header-mark" />
          <div className="header-titles">
            <h1>Riverside School Building Committee</h1>
            <div className="header-sub">Committee Member Portal</div>
          </div>
        </div>
      </header>
      <div className="header-accent" />
      <div className="nav-bar">
        <nav className="page-nav">
          <Link href="/" className={'page-nav-link' + (active === 'tasks' ? ' active' : '')}>Tasks</Link>
          <Link href="/roster" className={'page-nav-link' + (active === 'roster' ? ' active' : '')}>Roster</Link>
          <Link href="/meetings" className={'page-nav-link' + (active === 'meetings' ? ' active' : '')}>Meetings</Link>
          <Link href="/scoring" className={'page-nav-link' + (active === 'scoring' ? ' active' : '')}>RFP Scoring</Link>
          <Link href="/change-password" className={'page-nav-link' + (active === 'account' ? ' active' : '')}>My Account</Link>
          {admin ? (
            <Link href="/drafts" className={'page-nav-link admin-link' + (active === 'drafts' ? ' active' : '')}>Drafts</Link>
          ) : null}
        </nav>
      </div>
    </>
  );
}
