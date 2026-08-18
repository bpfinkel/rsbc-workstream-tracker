import { useState } from 'react';
import Head from 'next/head';
import { createClient } from '../lib/supabase/client';

export default function ChangePassword() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
    window.location.href = '/';
  }

  return (
    <>
      <Head>
        <title>RSBC Workstream Tracker — Set Your Password</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <header>
        <h1>Riverside School Building Committee</h1>
        <div className="sub">The Committee Members' App</div>
      </header>
      <main style={{ display: 'flex', justifyContent: 'center', paddingTop: 40 }}>
        <form className="modal" style={{ maxWidth: 360, width: '100%' }} onSubmit={handleSubmit}>
          <h3>Choose a New Password</h3>
          <p style={{ fontSize: 12.5, color: 'var(--slate)', marginTop: -8, marginBottom: 16 }}>
            You're signing in with a temporary password. Set your own before continuing.
          </p>
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
      </main>
    </>
  );
}
