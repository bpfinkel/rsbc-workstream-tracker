import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { createClient } from '../lib/supabase/client';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      setError('Incorrect email or password.');
      return;
    }
    window.location.href = '/';
  }

  return (
    <>
      <Head>
        <title>RSBC Workstream Tracker — Sign In</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <header>
        <h1>Riverside School Building Committee</h1>
        <div className="sub">The Committee Members' App</div>
      </header>
      <main style={{ display: 'flex', justifyContent: 'center', paddingTop: 40 }}>
        <form className="modal" style={{ maxWidth: 360, width: '100%' }} onSubmit={handleSubmit}>
          <h3>Sign In</h3>
          <div className="field">
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error ? <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 14 }}>{error}</div> : null}
          <button className="btn-primary" type="submit" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
          <p style={{ fontSize: 12.5, marginTop: 16, textAlign: 'center' }}>
            <Link href="/forgot-password" style={{ color: 'var(--navy-light)' }}>Forgot password?</Link>
          </p>
        </form>
      </main>
    </>
  );
}
