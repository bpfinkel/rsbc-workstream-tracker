import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { createClient } from '../lib/supabase/client';

export default function Account() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    if (!window.confirm('Are you sure you want to sign out?')) return;
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess(false);
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setPassword('');
    setConfirm('');
    setSuccess(true);
  }

  return (
    <>
      <Head>
        <title>RSBC Workstream Tracker — My Account</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <header>
        <h1>Riverside School Building Committee</h1>
        <div className="sub">The Committee Members' App</div>
        <nav className="page-nav">
          <Link href="/" className="page-nav-link">Tasks</Link>
          <Link href="/roster" className="page-nav-link">Roster</Link>
          <Link href="/change-password" className="page-nav-link active">My Account</Link>
          <button
            type="button"
            className="page-nav-link"
            onClick={handleSignOut}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: '2px solid transparent',
              padding: 0,
              paddingBottom: 3,
              margin: 0,
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 12,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.4px',
              lineHeight: 'inherit',
              color: '#b9c4cf'
            }}
          >
            Sign Out
          </button>
        </nav>
      </header>
      <main style={{ display: 'flex', justifyContent: 'center', paddingTop: 40 }}>
        <form className="modal" style={{ maxWidth: 360, width: '100%' }} onSubmit={handleSubmit}>
          <h3>Change Password</h3>
          <div className="field">
            <label>New Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus />
          </div>
          <div className="field">
            <label>Confirm Password</label>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </div>
          {error ? <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 14 }}>{error}</div> : null}
          {success ? <div style={{ color: 'var(--accent)', fontSize: 13, marginBottom: 14 }}>Password updated.</div> : null}
          <button className="btn-primary" type="submit" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Saving…' : 'Save Password'}
          </button>
        </form>
      </main>
    </>
  );
}
