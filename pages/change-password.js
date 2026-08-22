import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { createClient } from '../lib/supabase/client';
import Header from '../components/Header';

const VIEWPORT_LOCKED = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no';

export default function Account() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const meta = document.querySelector('meta[name="viewport"]');
    if (!meta) return;
    meta.setAttribute('content', VIEWPORT_LOCKED);
  }, []);

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
        <title>Riverside School Building Committee — My Account</title>
      </Head>
      <Header active="account" />
      <main style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 40, gap: 20 }}>
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
        <div className="modal" style={{ maxWidth: 360, width: '100%', textAlign: 'center' }}>
          <button type="button" className="btn-secondary" onClick={handleSignOut} style={{ width: '100%' }}>Sign Out</button>
        </div>
      </main>
    </>
  );
}
