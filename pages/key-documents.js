import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Header from '../components/Header';

function ExternalLinkIcon({ className }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3h7v7M21 3l-9 9" /><path d="M19 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6" /></svg>
  );
}

export default function KeyDocuments() {
  const [documents, setDocuments] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/key-documents')
      .then((res) => res.json())
      .then((data) => {
        setDocuments(data.documents || []);
        setLoaded(true);
      })
      .catch((e) => setError(e.message));
  }, []);

  const groups = useMemo(() => {
    const g = {};
    documents.forEach((d) => {
      const c = d.category || 'Uncategorized';
      (g[c] = g[c] || []).push(d);
    });
    Object.keys(g).forEach((c) => g[c].sort((a, b) => a.title.localeCompare(b.title)));
    return Object.keys(g)
      .sort((a, b) => (a === 'Uncategorized' ? 1 : b === 'Uncategorized' ? -1 : a.localeCompare(b)))
      .map((c) => ({ category: c, docs: g[c] }));
  }, [documents]);

  return (
    <>
      <Head>
        <title>Riverside School Building Committee — Key Documents</title>
      </Head>
      <Header active="documents" />

      <main>
        {error ? (
          <div className="empty">Error: {error}</div>
        ) : !loaded ? null : groups.length === 0 ? (
          <div className="empty">No key documents yet.</div>
        ) : (
          groups.map((g) => (
            <div className="workstream-group" key={g.category}>
              <h2>{g.category} ({g.docs.length})</h2>
              <div className="roster-list">
                {g.docs.map((d) => (
                  <a className="roster-row" href={d.driveLink} target="_blank" rel="noopener noreferrer" key={d.id}>
                    <span className="roster-name">{d.title}</span>
                    <ExternalLinkIcon className="roster-chevron" />
                  </a>
                ))}
              </div>
            </div>
          ))
        )}
      </main>
    </>
  );
}
