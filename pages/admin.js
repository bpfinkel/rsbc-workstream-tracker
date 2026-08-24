import { useEffect, useState } from 'react';
import Head from 'next/head';
import Header from '../components/Header';

const VIEWPORT_LOCKED = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no';

function formatShortDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${m}/${d}/${y}`;
}

function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}

// Groups a History list by the calendar day an item was created (ET, matching
// the rest of the app), not by when it was decided.
function dateKeyET(date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

function shiftDateKey(key, days) {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dateKeyET(dt);
}

function createdDateKey(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return dateKeyET(d);
}

function formatGroupLabel(key, todayKey, yesterdayKey) {
  if (key === todayKey) return 'Today';
  if (key === yesterdayKey) return 'Yesterday';
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function groupByCreatedDate(items, yesterdayKey) {
  const groups = [];
  const index = new Map();
  items.forEach((item) => {
    const key = createdDateKey(item.createdAt) || yesterdayKey;
    if (!index.has(key)) {
      index.set(key, groups.length);
      groups.push({ key, items: [] });
    }
    groups[index.get(key)].items.push(item);
  });
  groups.sort((a, b) => (a.key < b.key ? 1 : a.key > b.key ? -1 : 0));
  return groups;
}

function ChevronIcon({ open, className }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}
      style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform .15s', flexShrink: 0 }}>
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PendingIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3.2 2" /></svg>
  );
}

function HistoryIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8.5" /><path d="M8.2 12.3l2.6 2.6 5-5.4" /></svg>
  );
}

function DocIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3.5h8l4 4V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1z" /><path d="M14 3.5V8h4" /><path d="M8.5 12.5h7M8.5 16h7" /></svg>
  );
}

export default function Admin() {
  const [error, setError] = useState('');

  const [tasks, setTasks] = useState([]);
  const [tasksLoaded, setTasksLoaded] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [taskHistoryOpen, setTaskHistoryOpen] = useState(null);

  const [documents, setDocuments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [docsLoaded, setDocsLoaded] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [docHistoryOpen, setDocHistoryOpen] = useState(null);
  const [docEdits, setDocEdits] = useState({});

  const [sectionOpen, setSectionOpen] = useState({
    tasksPending: false, tasksHistory: false, docsPending: false, docsHistory: false
  });

  function toggleSection(key) {
    setSectionOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function loadTasks() {
    const res = await fetch('/api/drafts');
    const data = await res.json();
    setTasks(data.drafts || []);
    setTasksLoaded(true);
  }

  async function loadDocuments() {
    const res = await fetch('/api/documents');
    const data = await res.json();
    setDocuments(data.draftDocuments || []);
    setCategories(data.categories || []);
    setDocsLoaded(true);
  }

  useEffect(() => {
    loadTasks().catch((e) => setError(e.message));
    loadDocuments().catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    const meta = document.querySelector('meta[name="viewport"]');
    if (!meta) return;
    meta.setAttribute('content', VIEWPORT_LOCKED);
  }, []);

  async function handleTaskAction(id, action) {
    setError('');
    try {
      const res = await fetch('/api/drafts/' + id, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Action failed');
      setSelectedTask(null);
      await loadTasks();
    } catch (e) {
      setError(e.message);
    }
  }

  function setDocEdit(id, field, value) {
    setDocEdits((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }

  async function handleDocAction(id, action, draft) {
    setError('');
    try {
      const edits = docEdits[id] || {};
      const body = { action };
      if (action === 'approve' || action === 'override-approve') {
        body.title = edits.title ?? draft?.title;
        body.category = edits.category ?? draft?.category;
      }
      const res = await fetch('/api/documents/' + id, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Action failed');
      setSelectedDoc(null);
      setDocEdits((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      await loadDocuments();
    } catch (e) {
      setError(e.message);
    }
  }

  const pendingTasks = tasks.filter((d) => d.status === 'Pending');
  const taskHistory = tasks.filter((d) => d.status !== 'Pending');
  const pendingDocs = documents.filter((d) => d.status === 'Pending');
  const docHistory = documents.filter((d) => d.status !== 'Pending');

  const todayKey = dateKeyET(new Date());
  const yesterdayKey = shiftDateKey(todayKey, -1);
  const taskHistoryGroups = groupByCreatedDate(taskHistory, yesterdayKey);
  const docHistoryGroups = groupByCreatedDate(docHistory, yesterdayKey);

  function isGroupOpen(openState, key, idx) {
    if (openState === null) return idx === 0;
    return openState.has(key);
  }

  function toggleTaskGroup(key) {
    setTaskHistoryOpen((prev) => {
      const base = prev === null ? new Set(taskHistoryGroups.length > 0 ? [taskHistoryGroups[0].key] : []) : prev;
      const next = new Set(base);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function toggleDocGroup(key) {
    setDocHistoryOpen((prev) => {
      const base = prev === null ? new Set(docHistoryGroups.length > 0 ? [docHistoryGroups[0].key] : []) : prev;
      const next = new Set(base);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  return (
    <>
      <Head>
        <title>Riverside School Building Committee — Admin</title>
      </Head>
      <Header active="admin" />
      <div className="admin-note">Admin Access Only</div>

      <main>
        {error ? <div className="empty">{error}</div> : null}

        <div className="workstream-group">
          <button type="button" className="ws-header ws-header-btn" onClick={() => toggleSection('tasksPending')}>
            <PendingIcon />
            <h2>Tasks Pending Review ({pendingTasks.length})</h2>
            <ChevronIcon open={sectionOpen.tasksPending} className="ws-header-chevron" />
          </button>
          {sectionOpen.tasksPending ? (
            !tasksLoaded ? null : pendingTasks.length === 0 ? (
              <div className="empty">No drafts awaiting review. New ones appear here automatically after each Wednesday meeting once minutes are drafted.</div>
            ) : (
              <div className="cards">
                {pendingTasks.map((d) => (
                  <div className="card draft-pending" key={d.id}>
                    <p className="title">{d.title}</p>
                    {d.description ? <p className="desc">{d.description}</p> : null}
                    <span className="chip">{d.workstream}</span>
                    {d.assignees.map((a) => <span className="chip" key={a}>{a}</span>)}
                    {d.deadline ? <div className="deadline">Due {formatShortDate(d.deadline)}</div> : null}
                    <div className="deadline">From meeting {formatShortDate(d.sourceMeetingDate)}</div>
                    <div className="draft-actions">
                      <button type="button" className="btn-veto" onClick={() => handleTaskAction(d.id, 'reject')}>Veto</button>
                      <button type="button" className="btn-primary" onClick={() => handleTaskAction(d.id, 'approve')}>OK — Add to Tasks</button>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : null}
        </div>

        <div className="workstream-group">
          <button type="button" className="ws-header ws-header-btn" onClick={() => toggleSection('tasksHistory')}>
            <HistoryIcon />
            <h2>Task Approval History ({taskHistory.length})</h2>
            <ChevronIcon open={sectionOpen.tasksHistory} className="ws-header-chevron" />
          </button>
          {sectionOpen.tasksHistory ? (
            taskHistory.length === 0 ? (
              <div className="empty">Nothing reviewed yet.</div>
            ) : (
              taskHistoryGroups.map((group, idx) => {
                const open = isGroupOpen(taskHistoryOpen, group.key, idx);
                return (
                  <div key={group.key}>
                    <button type="button" className="date-group-label" onClick={() => toggleTaskGroup(group.key)}>
                      <ChevronIcon open={open} />
                      {formatGroupLabel(group.key, todayKey, yesterdayKey)}
                      <span className="date-group-count">({group.items.length})</span>
                    </button>
                    {open ? (
                      <div className="compact-list">
                        {group.items.map((d) => (
                          <div className="row-compact" key={d.id} onClick={() => setSelectedTask(d)}>
                            <span className="row-title">{d.title}</span>
                            <span className={'row-status ' + String(d.status || '').toLowerCase()}>{d.status}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })
            )
          ) : null}
        </div>

        <div className="workstream-group">
          <button type="button" className="ws-header ws-header-btn" onClick={() => toggleSection('docsPending')}>
            <DocIcon />
            <h2>Key Documents Pending Review ({pendingDocs.length})</h2>
            <ChevronIcon open={sectionOpen.docsPending} className="ws-header-chevron" />
          </button>
          {sectionOpen.docsPending ? (
            !docsLoaded ? null : pendingDocs.length === 0 ? (
              <div className="empty">No documents awaiting review. New ones appear here after the weekly Drive scan finds a file you haven't decided on yet.</div>
            ) : (
              <div className="cards">
                {pendingDocs.map((d) => (
                  <div className="card draft-pending" key={d.id}>
                    <div className="field">
                      <label>Title</label>
                      <input type="text" value={docEdits[d.id]?.title ?? d.title}
                        onChange={(e) => setDocEdit(d.id, 'title', e.target.value)} />
                    </div>
                    <div className="field">
                      <label>Category</label>
                      <input type="text" list="docCategoryList" value={docEdits[d.id]?.category ?? d.category}
                        onChange={(e) => setDocEdit(d.id, 'category', e.target.value)} />
                    </div>
                    {d.driveLink ? (
                      <a className="chip chip-link" href={d.driveLink} target="_blank" rel="noopener noreferrer">View file ↗</a>
                    ) : null}
                    <div className="draft-actions">
                      <button type="button" className="btn-veto" onClick={() => handleDocAction(d.id, 'reject')}>Veto</button>
                      <button type="button" className="btn-primary" onClick={() => handleDocAction(d.id, 'approve', d)}>OK — Add to Key Documents</button>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : null}
        </div>

        <div className="workstream-group">
          <button type="button" className="ws-header ws-header-btn" onClick={() => toggleSection('docsHistory')}>
            <HistoryIcon />
            <h2>Key Documents History ({docHistory.length})</h2>
            <ChevronIcon open={sectionOpen.docsHistory} className="ws-header-chevron" />
          </button>
          {sectionOpen.docsHistory ? (
            docHistory.length === 0 ? (
              <div className="empty">Nothing reviewed yet.</div>
            ) : (
              docHistoryGroups.map((group, idx) => {
                const open = isGroupOpen(docHistoryOpen, group.key, idx);
                return (
                  <div key={group.key}>
                    <button type="button" className="date-group-label" onClick={() => toggleDocGroup(group.key)}>
                      <ChevronIcon open={open} />
                      {formatGroupLabel(group.key, todayKey, yesterdayKey)}
                      <span className="date-group-count">({group.items.length})</span>
                    </button>
                    {open ? (
                      <div className="compact-list">
                        {group.items.map((d) => (
                          <div className="row-compact" key={d.id} onClick={() => setSelectedDoc(d)}>
                            <span className="row-title">{d.title}</span>
                            <span className={'row-status ' + String(d.status || '').toLowerCase()}>{d.status}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })
            )
          ) : null}
        </div>
      </main>

      <datalist id="docCategoryList">
        {categories.map((c) => <option value={c} key={c} />)}
      </datalist>

      <div className={'overlay' + (selectedTask ? ' open' : '')} onClick={(e) => { if (e.target === e.currentTarget) setSelectedTask(null); }}>
        {selectedTask && (
          <div className="modal contact-card">
            <h3>{selectedTask.title}</h3>
            {selectedTask.description ? <p className="desc" style={{ marginTop: -8, marginBottom: 14 }}>{selectedTask.description}</p> : null}

            <div className="contact-field">
              <span className="contact-label">Status</span>
              <span className="contact-value">{selectedTask.status}</span>
            </div>
            <div className="contact-field">
              <span className="contact-label">Decided by</span>
              <span className="contact-value">{selectedTask.decidedBy || '—'}</span>
            </div>
            <div className="contact-field">
              <span className="contact-label">Decided at</span>
              <span className="contact-value">{formatDateTime(selectedTask.decidedAt) || '—'}</span>
            </div>

            {selectedTask.overrideAt ? (
              <>
                <div className="contact-field">
                  <span className="contact-label">Later override</span>
                  <span className="contact-value">{selectedTask.overrideAction}</span>
                </div>
                <div className="contact-field">
                  <span className="contact-label">Overridden by</span>
                  <span className="contact-value">{selectedTask.overrideBy || '—'}</span>
                </div>
                <div className="contact-field">
                  <span className="contact-label">Overridden at</span>
                  <span className="contact-value">{formatDateTime(selectedTask.overrideAt)}</span>
                </div>
              </>
            ) : null}

            <div className="modal-actions">
              <span />
              <div className="modal-right">
                {selectedTask.status === 'Rejected' ? (
                  <>
                    <button className="btn-secondary" onClick={() => handleTaskAction(selectedTask.id, 'move-to-pending')}>Move to Pending</button>
                    <button className="btn-primary" onClick={() => handleTaskAction(selectedTask.id, 'override-approve')}>Override — Approve</button>
                  </>
                ) : null}
                <button className="btn-secondary" onClick={() => setSelectedTask(null)}>Close</button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className={'overlay' + (selectedDoc ? ' open' : '')} onClick={(e) => { if (e.target === e.currentTarget) setSelectedDoc(null); }}>
        {selectedDoc && (
          <div className="modal contact-card">
            <h3>{selectedDoc.title}</h3>

            <div className="contact-field">
              <span className="contact-label">Category</span>
              <span className="contact-value">{selectedDoc.category || '—'}</span>
            </div>
            <div className="contact-field">
              <span className="contact-label">File</span>
              <span className="contact-value">
                {selectedDoc.driveLink ? <a href={selectedDoc.driveLink} target="_blank" rel="noopener noreferrer">View in Drive ↗</a> : '—'}
              </span>
            </div>
            <div className="contact-field">
              <span className="contact-label">Status</span>
              <span className="contact-value">{selectedDoc.status}</span>
            </div>
            <div className="contact-field">
              <span className="contact-label">Decided by</span>
              <span className="contact-value">{selectedDoc.decidedBy || '—'}</span>
            </div>
            <div className="contact-field">
              <span className="contact-label">Decided at</span>
              <span className="contact-value">{formatDateTime(selectedDoc.decidedAt) || '—'}</span>
            </div>

            {selectedDoc.overrideAt ? (
              <>
                <div className="contact-field">
                  <span className="contact-label">Later override</span>
                  <span className="contact-value">{selectedDoc.overrideAction}</span>
                </div>
                <div className="contact-field">
                  <span className="contact-label">Overridden by</span>
                  <span className="contact-value">{selectedDoc.overrideBy || '—'}</span>
                </div>
                <div className="contact-field">
                  <span className="contact-label">Overridden at</span>
                  <span className="contact-value">{formatDateTime(selectedDoc.overrideAt)}</span>
                </div>
              </>
            ) : null}

            <div className="modal-actions">
              <span />
              <div className="modal-right">
                {selectedDoc.status === 'Rejected' ? (
                  <>
                    <button className="btn-secondary" onClick={() => handleDocAction(selectedDoc.id, 'move-to-pending')}>Move to Pending</button>
                    <button className="btn-primary" onClick={() => handleDocAction(selectedDoc.id, 'override-approve', selectedDoc)}>Override — Approve</button>
                  </>
                ) : null}
                <button className="btn-secondary" onClick={() => setSelectedDoc(null)}>Close</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
