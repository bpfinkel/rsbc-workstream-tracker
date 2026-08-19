import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '../lib/supabase/client';

const ADMIN_EMAIL = 'bfinkel.rsbc@gmail.com';

export default function Header({ active }) {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.email === ADMIN_EMAIL) setIsAdmin(true);
    });
  }, []);

  return (
    <header>
      <h1>Riverside School Building Committee</h1>
      <div className="sub">The Committee Members' App</div>
      <nav className="page-nav">
        <Link href="/" className={'page-nav-link' + (active === 'tasks' ? ' active' : '')}>Tasks</Link>
        <Link href="/roster" className={'page-nav-link' + (active === 'roster' ? ' active' : '')}>Roster</Link>
        <Link href="/meetings" className={'page-nav-link' + (active === 'meetings' ? ' active' : '')}>Meetings</Link>
        <Link href="/change-password" className={'page-nav-link' + (active === 'account' ? ' active' : '')}>My Account</Link>
        {isAdmin ? (
          <Link href="/drafts" className={'page-nav-link' + (active === 'drafts' ? ' active' : '')}>Drafts</Link>
        ) : null}
      </nav>
    </header>
  );
}
