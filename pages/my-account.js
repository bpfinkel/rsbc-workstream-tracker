import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { createClient } from '../lib/supabase/client';
import Header from '../components/Header';

const VIEWPORT_LOCKED = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no';

function formatPhoneInput(raw) {
  const digits = raw.replace(/\D/g, '').slice(0, 10);
  if (digits.length === 0) return '';
  if (digits.length < 4) return `(${digits}`;
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function LockIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
  );
}

function ContactIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3.5" y="5" width="17" height="14" rx="2" /><circle cx="9.5" cy="11" r="2" /><path d="M6 16c.6-1.8 2-2.7 3.5-2.7s2.9.9 3.5 2.7M14.5 10h4M14.5 13h3" /></svg>
  );
}

function ChevronIcon({ open }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="ws-header-chevron"
      style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform .15s', flexShrink: 0 }}>
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Account() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [passwordOpen, setPasswordOpen] = useState(false);

  const [members, setMembers] = useState([]);
  const [membersLoaded, setMembersLoaded] = useState(false);
  const [contactInitialized, setContactInitialized] = useState(false);
  const [contactPhone, setContactPhone] = useState('');
  const [contactError, setContactError] = useState('');
  const [contactSuccess, setContactSuccess] = useState(false);
  const [contactLoading, setContactLoading] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);

  useEffect(() => {
    const meta = document.querySelector('meta[name="viewport"]');
    if (!meta) return;
    meta.setAttribute('content', VIEWPORT_LOCKED);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.email) setEmail(data.user.email);
    });
  }, []);

  useEffect(() => {
    fetch('/api/members')
      .then((res) => res.json())
      .then((data) => {
        setMembers(data.members || []);
        setMembersLoaded(true);
      })
      .catch(() => setMembersLoaded(true));
  }, []);

  const myMember = members.find((m) => m.email && email && m.email.toLowerCase() === email.toLowerCase());

  useEffect(() => {
    if (myMember && !contactInitialized) {
      setContactPhone(formatPhoneInput(myMember.phone || ''));
      setContactInitialized(true);
    }
  }, [myMember, contactInitialized]);

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

  async function handleContactSave(e) {
    e.preventDefault();
    setContactError('');
    setContactSuccess(false);
    setContactLoading(true);
    try {
      const res = await fetch('/api/members', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: myMember.name, phone: contactPhone.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      setMembers((prev) => prev.map((m) => (m.name === myMember.name ? data.member : m)));
      setContactSuccess(true);
    } catch (err) {
      setContactError(err.message);
    } finally {
      setContactLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>Riverside School Building Committee — My Account</title>
      </Head>
      <Header active="account" />
      <main style={{ maxWidth: 420, margin: '0 auto' }}>
        <div className="workstream-group">
          <button type="button" className="ws-header ws-header-btn" onClick={() => setPasswordOpen((o) => !o)}>
            <LockIcon />
            <h2>Change Password</h2>
            <ChevronIcon open={passwordOpen} />
          </button>
          {passwordOpen ? (
            <div className="card static-card">
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
                {success ? <div style={{ color: 'var(--accent)', fontSize: 13, marginBottom: 14 }}>Password updated.</div> : null}
                <button className="btn-primary" type="submit" disabled={loading} style={{ width: '100%' }}>
                  {loading ? 'Saving…' : 'Save Password'}
                </button>
              </form>
            </div>
          ) : null}
        </div>

        {membersLoaded && myMember ? (
          <div className="workstream-group">
            <button type="button" className="ws-header ws-header-btn" onClick={() => setContactOpen((o) => !o)}>
              <ContactIcon />
              <h2>My Contact Card</h2>
              <ChevronIcon open={contactOpen} />
            </button>
            {contactOpen ? (
              <div className="card static-card">
                <form onSubmit={handleContactSave}>
                  <div className="field">
                    <label>Name</label>
                    <div className="contact-value">{myMember.name}</div>
                  </div>
                  <div className="field">
                    <label>Title</label>
                    <div className="contact-value">{myMember.role}</div>
                  </div>
                  <div className="field">
                    <label>Email</label>
                    <div className="contact-value">{myMember.email}</div>
                  </div>
                  <div className="field">
                    <label>Mobile</label>
                    <input type="tel" placeholder="Optional" value={contactPhone} onChange={(e) => setContactPhone(formatPhoneInput(e.target.value))} />
                  </div>
                  {contactError ? <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 14 }}>{contactError}</div> : null}
                  {contactSuccess ? <div style={{ color: 'var(--accent)', fontSize: 13, marginBottom: 14 }}>Contact card updated.</div> : null}
                  <button className="btn-primary" type="submit" disabled={contactLoading} style={{ width: '100%' }}>
                    {contactLoading ? 'Saving…' : 'Save Contact Card'}
                  </button>
                </form>
              </div>
            ) : null}
          </div>
        ) : membersLoaded && !myMember ? (
          <div className="workstream-group">
            <div className="ws-header">
              <ContactIcon />
              <h2>My Contact Card</h2>
            </div>
            <div className="card static-card">
              <p style={{ fontSize: 13, color: 'var(--slate)', margin: 0 }}>
                We couldn't match your sign-in email to a roster entry. Contact the secretary to link your account.
              </p>
            </div>
          </div>
        ) : null}

        <div className="card static-card" style={{ textAlign: 'center' }}>
          <button type="button" className="btn-secondary" onClick={handleSignOut} style={{ width: '100%' }}>Sign Out</button>
        </div>
        {email ? <div className="account-note" style={{ marginTop: 12 }}>Signed in as {email}</div> : null}
      </main>
    </>
  );
}
