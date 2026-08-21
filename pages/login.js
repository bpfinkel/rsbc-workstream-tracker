import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { createClient } from '../lib/supabase/client';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

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

  async function handleGoogleSignIn() {
    setError('');
    setGoogleLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` }
    });
    if (error) {
      setGoogleLoading(false);
      setError(error.message);
    }
  }

  return (
    <>
      <Head>
        <title>Riverside School Building Committee — Sign In</title>
      </Head>
      <header>
        <img src="/rsbc-logo.jpg" alt="Riverside School Building Committee" className="header-logo" />
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span style={{ fontSize: 11.5, color: 'var(--slate)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>or</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z" />
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
              <path fill="#4CAF50" d="M24 44c5.4 0 10.3-2.1 14-5.5l-6.5-5.4C29.4 34.9 26.8 36 24 36c-5.3 0-9.7-3.1-11.3-7.5l-6.6 5.1C9.6 39.6 16.2 44 24 44z" />
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.9 2.5-2.5 4.6-4.6 6.1l6.5 5.4C40.7 36.5 44 30.9 44 24c0-1.3-.1-2.7-.4-3.5z" />
            </svg>
            {googleLoading ? 'Redirecting…' : 'Sign in with Google'}
          </button>
          <p style={{ fontSize: 12.5, marginTop: 16, textAlign: 'center' }}>
            <Link href="/forgot-password" style={{ color: 'var(--navy-light)' }}>Forgot password?</Link>
          </p>
        </form>
      </main>
    </>
  );
}
