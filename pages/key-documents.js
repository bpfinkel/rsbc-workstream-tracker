import { useEffect, useMemo, useRef, useState } from 'react';
import Head from 'next/head';
import Header from '../components/Header';
import { driveEmbedUrl } from '../lib/driveEmbed';
import { useModalViewportLock } from '../lib/useViewportLock';

function ExternalLinkIcon({ className }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3h7v7M21 3l-9 9" /><path d="M19 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6" /></svg>
  );
}

function FolderIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="M3.5 6.5a1 1 0 0 1 1-1h5l2 2.2h8a1 1 0 0 1 1 1v9.3a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1v-11.5z" /></svg>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
  );
}

function ClearIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
  );
}

// Every word typed must appear somewhere in the title or category, in any
// order, so "enrollment oct" finds "RivSch Enrollment History ... Oct 25.pdf".
function matchesSearch(doc, terms) {
  if (!terms.length) return true;
  const haystack = `${doc.title} ${doc.category || 'Uncategorized'}`.toLowerCase();
  return terms.every((t) => haystack.includes(t));
}

function ChevronIcon({ open, className }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}
      style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform .15s', flexShrink: 0 }}>
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function KeyDocuments() {
  const [documents, setDocuments] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [pdfViewer, setPdfViewer] = useState(null);
  // Sections default open (this is a browsing page, unlike the Admin review
  // queue) — a category only collapses once the member explicitly closes it.
  const [collapsedCategories, setCollapsedCategories] = useState(new Set());
  const [query, setQuery] = useState('');
  const searchRef = useRef(null);
  const terms = useMemo(() => query.trim().toLowerCase().split(/\s+/).filter(Boolean), [query]);
  const searching = terms.length > 0;

  useEffect(() => {
    fetch('/api/key-documents')
      .then((res) => res.json())
      .then((data) => {
        setDocuments(data.documents || []);
        setLoaded(true);
      })
      .catch((e) => setError(e.message));
  }, []);

  useModalViewportLock(!!pdfViewer);

  const groups = useMemo(() => {
    const g = {};
    documents.filter((d) => matchesSearch(d, terms)).forEach((d) => {
      const c = d.category || 'Uncategorized';
      (g[c] = g[c] || []).push(d);
    });
    Object.keys(g).forEach((c) => g[c].sort((a, b) => a.title.localeCompare(b.title)));
    return Object.keys(g)
      .sort((a, b) => (a === 'Uncategorized' ? 1 : b === 'Uncategorized' ? -1 : a.localeCompare(b)))
      .map((c) => ({ category: c, docs: g[c] }));
  }, [documents, terms]);

  const matchCount = groups.reduce((n, g) => n + g.docs.length, 0);

  // Starting a search re-opens any collapsed sections so a match is never
  // hidden behind a closed header; the toggles keep working while searching.
  function updateQuery(value) {
    if (!query.trim() && value.trim()) setCollapsedCategories(new Set());
    setQuery(value);
  }

  function clearSearch() {
    updateQuery('');
    searchRef.current?.focus();
  }

  function toggleCategory(category) {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category); else next.add(category);
      return next;
    });
  }

  function openDoc(title, driveLink) {
    setPdfViewer({ title, driveLink });
  }

  return (
    <>
      <Head>
        <title>Riverside School Building Committee — Key Documents</title>
      </Head>
      <Header active="documents" />

      <main>
        {error ? (
          <div className="empty">Error: {error}</div>
        ) : !loaded ? null : documents.length === 0 ? (
          <div className="empty">No key documents yet.</div>
        ) : (
          <>
          <div className="doc-search" role="search">
            <div className="doc-search-box">
              <SearchIcon />
              <input
                ref={searchRef}
                type="search"
                aria-label="Search documents"
                placeholder="Search by file name or category"
                value={query}
                onChange={(e) => updateQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape' && query) {
                    e.preventDefault();
                    updateQuery('');
                  }
                }}
                autoComplete="off"
                spellCheck={false}
              />
              {query ? (
                <button type="button" className="doc-search-clear" aria-label="Clear search" onClick={clearSearch}>
                  <ClearIcon />
                </button>
              ) : null}
            </div>
            <p className={'doc-search-status' + (searching && !matchCount ? ' visually-hidden' : '')} aria-live="polite">
              {!searching ? '' : matchCount
                ? `${matchCount} of ${documents.length} document${documents.length === 1 ? '' : 's'} match`
                : 'No documents match your search'}
            </p>
          </div>
          {groups.length === 0 ? (
            <div className="doc-search-empty">
              <p className="doc-search-empty-title">No documents match &ldquo;{query.trim()}&rdquo;</p>
              <p className="doc-search-empty-hint">Try a shorter or different word, or browse every category.</p>
              <button type="button" className="btn-secondary" onClick={clearSearch}>Clear search</button>
            </div>
          ) : groups.map((g) => {
            const open = !collapsedCategories.has(g.category);
            return (
              <div className="workstream-group" key={g.category}>
                <button type="button" className="ws-header ws-header-btn" onClick={() => toggleCategory(g.category)}>
                  <FolderIcon />
                  <h2>{g.category}</h2>
                  <span className="ws-count">{g.docs.length}</span>
                  <ChevronIcon open={open} className="ws-header-chevron" />
                </button>
                {open ? (
                  <div className="roster-list">
                    {g.docs.map((d) => (
                      <div className="roster-row" onClick={() => openDoc(d.title, d.driveLink)} key={d.id}>
                        <span className="roster-name">{d.title}</span>
                        <ExternalLinkIcon className="roster-chevron" />
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
          </>
        )}
      </main>

      <div className={'overlay' + (pdfViewer ? ' open' : '')} onClick={(e) => { if (e.target === e.currentTarget) setPdfViewer(null); }}>
        {pdfViewer && (
          <div className="modal pdf-viewer">
            <div className="pdf-viewer-header">
              <h3>{pdfViewer.title}</h3>
              <div className="pdf-viewer-header-actions">
                <button className="btn-secondary" onClick={() => setPdfViewer(null)}>Close</button>
              </div>
            </div>
            <iframe src={driveEmbedUrl(pdfViewer.driveLink)} title={pdfViewer.title} />
          </div>
        )}
      </div>
    </>
  );
}
