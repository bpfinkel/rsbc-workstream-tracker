import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Header from '../components/Header';
import { driveEmbedUrl } from '../lib/driveEmbed';
import { useModalViewportLock } from '../lib/useViewportLock';
import { loadWithCache } from '../lib/dataCache';

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5" /><path d="M5 20h14" /></svg>
  );
}

function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function downloadUrl(file) {
  return file.mimeType === 'application/vnd.google-apps.presentation'
    ? `https://docs.google.com/presentation/d/${file.id}/export/pptx`
    : `https://drive.google.com/uc?export=download&id=${file.id}`;
}

export default function PresentationsPage() {
  const [decks, setDecks] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [audience, setAudience] = useState('');
  const [viewer, setViewer] = useState(null);

  useEffect(() => {
    loadWithCache('/api/presentations', (data) => {
      setDecks(data.presentations || []);
      setLoaded(true);
    }).catch((e) => { setError(e.message); setLoaded(true); });
  }, []);

  useModalViewportLock(!!viewer);

  const audiences = useMemo(() => Array.from(new Set(decks.map((d) => d.audience))).sort((a, b) => (a === 'Other') - (b === 'Other') || a.localeCompare(b)), [decks]);

  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const shown = decks
    .filter((d) => !audience || d.audience === audience)
    .filter((d) => {
      const hay = `${d.title} ${d.source} ${d.audience} ${formatDate(d.date)}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    });

  return (
    <>
      <Head>
        <title>Riverside School Building Committee — Presentations</title>
      </Head>
      <Header active="presentations" />

      <main className="pres-page">
        {error ? (
          <div className="empty">Couldn&rsquo;t read the presentations folder: {error}</div>
        ) : !loaded ? null : decks.length === 0 ? (
          <div className="empty">No presentations have been filed yet. Final decks saved to RSBC &rsaquo; Presentations &rsaquo; External in Drive appear here automatically.</div>
        ) : (
          <>
            <div className="doc-search" role="search">
              <div className="doc-search-box">
                <SearchIcon />
                <input
                  type="search"
                  aria-label="Search presentations"
                  placeholder="Search by title, audience or date"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
            </div>
            {audiences.length > 1 ? (
              <div className="pres-chips" role="group" aria-label="Audience">
                <button type="button" className={'pres-chip' + (!audience ? ' active' : '')} onClick={() => setAudience('')}>All</button>
                {audiences.map((a) => (
                  <button type="button" key={a} className={'pres-chip' + (audience === a ? ' active' : '')} onClick={() => setAudience(audience === a ? '' : a)}>{a}</button>
                ))}
              </div>
            ) : null}
            {shown.length === 0 ? (
              <div className="empty">No presentations match.</div>
            ) : (
              <div className="pres-list">
                {shown.map((d) => (
                  <div className="pres-row" key={d.id}>
                    <button type="button" className="pres-main" onClick={() => setViewer({ title: d.title, link: d.view.link })}>
                      <span className="pres-date">{formatDate(d.date)}</span>
                      <span className="pres-title">{d.title}</span>
                      <span className="pres-meta">{[d.audience !== 'Other' ? d.audience : '', d.source].filter(Boolean).join(' · ')}</span>
                    </button>
                    {d.slides ? (
                      <a className="btn-secondary pres-download" href={downloadUrl(d.slides)} target="_blank" rel="noreferrer">
                        <DownloadIcon /> Slides
                      </a>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <div className={'overlay' + (viewer ? ' open' : '')} onClick={(e) => { if (e.target === e.currentTarget) setViewer(null); }}>
        {viewer ? (
          <div className="modal pdf-viewer">
            <div className="pdf-viewer-header">
              <h3>{viewer.title}</h3>
              <div className="pdf-viewer-header-actions">
                <button className="btn-secondary" onClick={() => setViewer(null)}>Close</button>
              </div>
            </div>
            <iframe src={driveEmbedUrl(viewer.link)} title={viewer.title} />
          </div>
        ) : null}
      </div>
    </>
  );
}
