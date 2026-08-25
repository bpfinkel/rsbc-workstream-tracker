import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Header from '../components/Header';

const VIEWPORT_LOCKED = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no';
const VIEWPORT_UNLOCKED = 'width=device-width, initial-scale=1';

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

function ChevronIcon({ open, className }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}
      style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform .15s', flexShrink: 0 }}>
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Drive files embed directly via /preview (no Google Docs viewer proxy needed,
// unlike the Meetings page's external agenda/minutes PDFs) — accepts either the
// /file/d/<id>/view share-link shape or the older ?id=<id> download-link shape
// so it works regardless of which format a given DriveLink was saved with.
function driveEmbedUrl(url) {
  const match = String(url || '').match(/\/d\/([^/]+)/) || String(url || '').match(/[?&]id=([^&]+)/);
  const id = match ? match[1] : null;
  return id ? `https://drive.google.com/file/d/${id}/preview` : url;
}

export default function KeyDocuments() {
  const [documents, setDocuments] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [pdfViewer, setPdfViewer] = useState(null);
  // Sections default open (this is a browsing page, unlike the Admin review
  // queue) — a category only collapses once the member explicitly closes it.
  const [collapsedCategories, setCollapsedCategories] = useState(new Set());

  useEffect(() => {
    fetch('/api/key-documents')
      .then((res) => res.json())
      .then((data) => {
        setDocuments(data.documents || []);
        setLoaded(true);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    const meta = document.querySelector('meta[name="viewport"]');
    if (!meta) return;
    meta.setAttribute('content', pdfViewer ? VIEWPORT_UNLOCKED : VIEWPORT_LOCKED);
    return () => { meta.setAttribute('content', VIEWPORT_LOCKED); };
  }, [pdfViewer]);

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
        ) : !loaded ? null : groups.length === 0 ? (
          <div className="empty">No key documents yet.</div>
        ) : (
          groups.map((g) => {
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
          })
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
