import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { createClient } from '../lib/supabase/client';
import { RSBC_MARK } from '../lib/rsbcMark';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const supabase = createClient();
    const redirectTo = `${window.location.origin}/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSent(true);
  }

  return (
    <>
      <Head>
        <title>Riverside School Building Committee — Forgot Password</title>
      </Head>
      <header>
        <div className="header-left">
          <img src={RSBC_MARK} alt="RSBC" className="header-mark" />
          <div className="header-titles">
            <h1>Riverside School Building Committee</h1>
            <div className="header-sub">Committee Member Portal</div>
          </div>
        </div>
      </header>
      <div className="header-accent" />
      <main style={{ display: 'flex', justifyContent: 'center', paddingTop: 40 }}>
        <div className="modal" style={{ maxWidth: 360, width: '100%' }}>
          <h3>Reset Password</h3>
          {sent ? (
            <p style={{ fontSize: 13.5, color: 'var(--slate)' }}>
              If that email has an account, a reset link is on its way. Check your inbox.
            </p>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="field">
                <label>Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
              </div>
              {error ? <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 14 }}>{error}</div> : null}
              <button className="btn-primary" type="submit" disabled={loading} style={{ width: '100%' }}>
                {loading ? 'Sending…' : 'Send Reset Link'}
              </button>
            </form>
          )}
          <p style={{ fontSize: 12.5, marginTop: 16 }}>
            <Link href="/login" style={{ color: 'var(--navy-light)' }}>Back to Sign In</Link>
          </p>
        </div>
      </main>
    </>
  );
}
