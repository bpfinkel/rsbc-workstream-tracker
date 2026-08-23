import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { createClient } from '../../lib/supabase/client';
import Header from '../../components/Header';

export default function AuthCallback() {
  const router = useRouter();
  const [error, setError] = useState('');

  useEffect(() => {
    const supabase = createClient();

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        router.replace('/');
      }
    });

    supabase.auth.getSession().then(({ data, error: sessErr }) => {
      if (sessErr) setError(sessErr.message);
      if (data?.session) router.replace('/');
    });

    const timeout = setTimeout(() => {
      setError((e) => e || 'Sign-in did not complete. This Google account may not have access yet — contact Bryan if you believe this is a mistake.');
    }, 6000);

    return () => {
      listener.subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [router]);

  return (
    <>
      <Head>
        <title>Riverside School Building Committee — Signing In</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Header />
      <main style={{ display: 'flex', justifyContent: 'center', paddingTop: 40 }}>
        <div className="modal" style={{ maxWidth: 360, width: '100%', textAlign: 'center' }}>
          {error ? (
            <>
              <p style={{ color: 'var(--red)', fontSize: 13.5 }}>{error}</p>
              <a href="/login" style={{ color: 'var(--navy-light)', fontSize: 13 }}>Back to Sign In</a>
            </>
          ) : (
            <p style={{ fontSize: 13.5, color: 'var(--slate)' }}>Signing you in…</p>
          )}
        </div>
      </main>
    </>
  );
}
