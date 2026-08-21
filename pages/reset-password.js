import { useEffect, useState } from 'react';
import Head from 'next/head';
import { createClient } from '../lib/supabase/client';

export default function ResetPassword() {
  const [ready, setReady] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    const code = new URLSearchParams(window.location.search).get('code');

    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) {
          setVerifyError('This reset link is invalid or has expired. Please request a new one.');
        } else {
          setReady(true);
        }
      });
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setReady(true);
      } else {
        setVerifyError('This reset link is invalid or has expired. Please request a new one.');
      }
    });
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
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
    const { error } = await supabase.auth.updateUser({
      password,
      data: { must_change_password: false }
    });
    if (error) {
      setLoading(false);
      setError(error.message);
      return;
    }
    setDone(true);
    setTimeout(() => { window.location.href = '/'; }, 1500);
  }

  return (
    <>
      <Head>
        <title>Riverside School Building Committee — Reset Password</title>
      </Head>
      <header>
        <img src="/rsbc-logo.jpg" alt="Riverside School Building Committee" className="header-logo" />
      </header>
      <main style={{ display: 'flex', justifyContent: 'center', paddingTop: 40 }}>
        <div className="modal" style={{ maxWidth: 360, width: '100%' }}>
          <h3>Set a New Password</h3>
          {verifyError ? (
            <p style={{ fontSize: 13.5, color: 'var(--red)' }}>{verifyError}</p>
          ) : !ready ? (
            <p style={{ fontSize: 13.5, color: 'var(--slate)' }}>Verifying your reset link…</p>
          ) : done ? (
            <p style={{ fontSize: 13.5, color: 'var(--accent)' }}>Password updated. Redirecting…</p>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="field">
                <label>New Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus />
              </div>
              <div className="field">
                <label>Confirm Password</label>
                <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
              </div>
              {error ? <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 14 }}>{error}</div> : null}
              <button className="btn-primary" type="submit" disabled={loading} style={{ width: '100%' }}>
                {loading ? 'Saving…' : 'Set Password'}
              </button>
            </form>
          )}
        </div>
      </main>
    </>
  );
}
