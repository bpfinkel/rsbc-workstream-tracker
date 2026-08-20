import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Header from '../components/Header';

const EMPTY_FORM = {
  id: '',
  title: '',
  description: '',
  workstream: '',
  deadline: '',
  status: '',
  assignees: [],
  notes: ''
};

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + 'T00:00:00');
  return Math.round((d - today) / 86400000);
}

function statusClass(s) {
  return 'status-' + String(s || '').replace(/\s+/g, '-');
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${m}/${d}/${y}`;
}

export default function Home() {
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [workstreams, setWorkstreams] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const [search, setSearch] = useState('');
  const [filterWorkstream, setFilterWorkstream] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterOverdue, setFilterOverdue] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [toast, setToast] = useState('');
  const [customAssigneeInput, setCustomAssigneeInput] = useState('');
  const [viewMode, setViewMode] = useState('detailed');

  useEffect(() => {
    const saved = localStorage.getItem('rsbc-view-mode');
    if (saved === 'detailed' || saved === 'compact') setViewMode(saved);
  }, []);

  function setView(mode) {
    setViewMode(mode);
    localStorage.setItem('rsbc-view-mode', mode);
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 2200);
  }

  async function loadData() {
    const res = await fetch('/api/tasks');
    const data = await res.json();
    setTasks(data.tasks || []);
    setMembers(data.members || []);
    setStatuses(data.statuses || []);
    setWorkstreams(data.workstreams || []);
    setLoaded(true);
  }

  useEffect(() => {
    loadData().catch((e) => showToast('Error: ' + e.message));
  }, []);

  function openAddModal() {
    setForm({ ...EMPTY_FORM, status: statuses[0] || '' });
    setCustomAssigneeInput('');
    setModalOpen(true);
  }

  function openEditModal(task) {
    setForm({
      id: task.id,
      title: task.title,
      description: task.description,
      workstream: task.workstream,
      deadline: task.deadline,
      status: task.status,
      assignees: task.assignees,
      notes: task.notes
    });
    setCustomAssigneeInput('');
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
  }

  function toggleAssignee(name) {
    setForm((f) => {
      const has = f.assignees.includes(name);
      return { ...f, assignees: has ? f.assignees.filter((a) => a !== name) : [...f.assignees, name] };
    });
  }

  function addCustomAssignee() {
    const name = customAssigneeInput.trim();
    if (!name) return;
    setForm((f) => (f.assignees.includes(name) ? f : { ...f, assignees: [...f.assignees, name] }));
    setCustomAssigneeInput('');
  }

  function removeAssignee(name) {
    setForm((f) => ({ ...f, assignees: f.assignees.filter((a) => a !== name) }));
  }

  async function handleSave() {
    if (!form.title.trim()) {
      showToast('Title is required');
      return;
    }
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      workstream: form.workstream.trim() || 'Unsorted',
      deadline: form.deadline,
      status: form.status,
      assignees: form.assignees,
      notes: form.notes.trim()
    };
    setModalOpen(false);
    try {
      if (form.id) {
        await fetch('/api/tasks/' + form.id, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        showToast('Task updated');
      } else {
        await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        showToast('Task added');
      }
      await loadData();
    } catch (e) {
      showToast('Error: ' + e.message);
    }
  }

  async function handleDelete() {
    if (!form.id) return;
    if (!confirm('Delete this task? This cannot be undone.')) return;
    setModalOpen(false);
    try {
      await fetch('/api/tasks/' + form.id, { method: 'DELETE' });
      showToast('Task deleted');
      await loadData();
    } catch (e) {
      showToast('Error: ' + e.message);
    }
  }

  async function quickStatus(task) {
    const idx = statuses.indexOf(task.status);
    const next = statuses[(idx + 1) % statuses.length];
    try {
      await fetch('/api/tasks/' + task.id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...task, status: next })
      });
      await loadData();
    } catch (e) {
      showToast('Error: ' + e.message);
    }
  }

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((t) => {
      if (filterWorkstream && t.workstream !== filterWorkstream) return false;
      if (filterAssignee && !t.assignees.includes(filterAssignee)) return false;
      if (filterStatus) {
        if (t.status !== filterStatus) return false;
      } else if (t.status === 'Completed') {
        return false;
      }
      if (filterOverdue) {
        const du = daysUntil(t.deadline);
        if (!(t.status !== 'Completed' && du !== null && du < 0)) return false;
      }
      if (q && !(t.title + ' ' + t.description).toLowerCase().includes(q)) return false;
      return true;
    });
  }, [tasks, search, filterWorkstream, filterAssignee, filterStatus, filterOverdue]);

  function selectStatusFilter(status) {
    setFilterOverdue(false);
    setFilterStatus((cur) => (cur === status ? '' : status));
  }

  function selectOverdueFilter() {
    setFilterStatus('');
    setFilterOverdue((cur) => !cur);
  }

  function clearStatusFilters() {
    setFilterStatus('');
    setFilterOverdue(false);
  }

  const summary = useMemo(() => {
    let overdue = 0, inProgress = 0, done = 0;
    tasks.forEach((t) => {
      const du = daysUntil(t.deadline);
      if (t.status !== 'Completed' && du !== null && du < 0) overdue++;
      if (t.status === 'In Progress') inProgress++;
      if (t.status === 'Completed') done++;
    });
    return { total: tasks.length - done, overdue, inProgress, done };
  }, [tasks]);

  const allAssigneeNames = useMemo(() => {
    const names = new Set(members.map((m) => m.name));
    tasks.forEach((t) => t.assignees.forEach((a) => names.add(a)));
    return Array.from(names).sort();
  }, [members, tasks]);

  const groups = useMemo(() => {
    const g = {};
    filteredTasks.forEach((t) => {
      const w = t.workstream || 'Unsorted';
      (g[w] = g[w] || []).push(t);
    });
    Object.keys(g).forEach((w) => {
      g[w].sort((a, b) => {
        const da = a.deadline || '9999';
        const db = b.deadline || '9999';
        return da < db ? -1 : da > db ? 1 : 0;
      });
    });
    return g;
  }, [filteredTasks]);
  const groupNames = Object.keys(groups).sort();

  return (
    <>
      <Head>
        <title>Riverside School Building Committee</title>
      </Head>
      <Header active="tasks" />

      <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 28px 0 28px' }}>
        <button className="btn-primary" onClick={openAddModal}>+ Add Task</button>
      </div>

      <div className="summary">
        <button type="button" className={'stat' + (!filterStatus && !filterOverdue ? ' active' : '')} onClick={clearStatusFilters}>
          <div className="n">{summary.total}</div><div className="l">Active tasks</div>
        </button>
        <button type="button" className={'stat overdue' + (filterOverdue ? ' active' : '')} onClick={selectOverdueFilter}>
          <div className="n">{summary.overdue}</div><div className="l">Overdue</div>
        </button>
        <button type="button" className={'stat' + (filterStatus === 'In Progress' ? ' active' : '')} onClick={() => selectStatusFilter('In Progress')}>
          <div className="n">{summary.inProgress}</div><div className="l">In progress</div>
        </button>
        <button type="button" className={'stat done' + (filterStatus === 'Completed' ? ' active' : '')} onClick={() => selectStatusFilter('Completed')}>
          <div className="n">{summary.done}</div><div className="l">Completed</div>
        </button>
      </div>

      <div className="filters">
        <input type="text" placeholder="Search tasks..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={filterWorkstream} onChange={(e) => setFilterWorkstream(e.target.value)}>
          <option value="">All workstreams</option>
          {workstreams.map((w) => <option key={w} value={w}>{w}</option>)}
        </select>
        <select value={filterAssignee} onChange={(e) => setFilterAssignee(e.target.value)}>
          <option value="">All assignees</option>
          {allAssigneeNames.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setFilterOverdue(false); }}>
          <option value="">All statuses</option>
          {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="view-toggle">
        <button type="button" className={'view-btn' + (viewMode === 'detailed' ? ' active' : '')} onClick={() => setView('detailed')}>Detailed</button>
        <button type="button" className={'view-btn' + (viewMode === 'compact' ? ' active' : '')} onClick={() => setView('compact')}>Compact</button>
      </div>

      <main>
        {!loaded ? null : groupNames.length === 0 ? (
          <div className="empty">No tasks match. Try clearing filters, or add a new task.</div>
        ) : (
          groupNames.map((w) => (
            <div className="workstream-group" key={w}>
              <h2>{w} ({groups[w].length})</h2>
              {viewMode === 'compact' ? (
                <div className="compact-list">
                  {groups[w].map((t) => {
                    const du = daysUntil(t.deadline);
                    let deadlineClass = '';
                    if (t.deadline && t.status !== 'Completed') {
                      if (du < 0) deadlineClass = 'overdue';
                      else if (du <= 7) deadlineClass = 'soon';
                    }
                    return (
                      <div className="row-compact" key={t.id} onClick={() => openEditModal(t)}>
                        <span className="row-title">{t.title}</span>
                        <span className={'row-date ' + deadlineClass}>{t.deadline ? formatDate(t.deadline) : 'No deadline'}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="cards">
                  {groups[w].map((t) => {
                    const du = daysUntil(t.deadline);
                    let deadlineClass = '';
                    let deadlineLabel = 'No deadline set';
                    if (t.deadline) {
                      if (t.status !== 'Completed' && du < 0) {
                        deadlineClass = 'overdue';
                        deadlineLabel = 'Overdue — was due ' + formatDate(t.deadline);
                      } else if (t.status !== 'Completed' && du <= 7) {
                        deadlineClass = 'soon';
                        deadlineLabel = 'Due ' + formatDate(t.deadline) + ' (' + du + 'd)';
                      } else {
                        deadlineLabel = 'Due ' + formatDate(t.deadline);
                      }
                    }
                    return (
                      <div className={'card ' + statusClass(t.status)} key={t.id} onClick={() => openEditModal(t)}>
                        <div className="card-actions">
                          <button className="icon-btn" onClick={(e) => { e.stopPropagation(); quickStatus(t); }}>&#8635;</button>
                        </div>
                        <p className="title">{t.title}</p>
                        {t.description ? <p className="desc">{t.description}</p> : null}
                        <span className={'badge ' + statusClass(t.status)}>{t.status}</span>
                        {t.assignees.map((a) => <span className="chip" key={a}>{a}</span>)}
                        <div className={'deadline ' + deadlineClass}>{deadlineLabel}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))
        )}
      </main>

      <div className={'overlay' + (modalOpen ? ' open' : '')} onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
        <div className="modal">
          <h3>{form.id ? 'Edit Task' : 'Add Task'}</h3>
          <div className="field">
            <label>Title</label>
            <input type="text" placeholder="e.g. Finalize architect RFP scope" value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="field">
            <label>Description</label>
            <textarea placeholder="Optional detail" value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="row2">
            <div className="field">
              <label>Workstream</label>
              <input type="text" list="workstreamList" placeholder="e.g. Architect Selection" value={form.workstream}
                onChange={(e) => setForm({ ...form, workstream: e.target.value })} />
              <datalist id="workstreamList">
                {workstreams.map((w) => <option value={w} key={w} />)}
              </datalist>
            </div>
            <div className="field">
              <label>Deadline</label>
              <input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
            </div>
          </div>
          <div className="field">
            <label>Status</label>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Assigned to</label>
            <div className="assignee-grid">
              {members.map((m) => (
                <label key={m.name}>
                  <input type="checkbox" checked={form.assignees.includes(m.name)} onChange={() => toggleAssignee(m.name)} />
                  {' ' + m.name}
                  {!m.officer && <span style={{ color: '#8a97a4' }}> ({m.role})</span>}
                </label>
              ))}
            </div>
            {form.assignees.filter((a) => !members.some((m) => m.name === a)).length > 0 && (
              <div style={{ marginTop: 8 }}>
                {form.assignees.filter((a) => !members.some((m) => m.name === a)).map((name) => (
                  <span className="chip" key={name}>
                    {name}{' '}
                    <button type="button" onClick={() => removeAssignee(name)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'inherit', font: 'inherit', padding: 0 }}>&times;</button>
                  </span>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input
                type="text"
                placeholder="Add someone else (e.g. Eugene Watts)"
                value={customAssigneeInput}
                onChange={(e) => setCustomAssigneeInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomAssignee(); } }}
                style={{ flex: 1 }}
              />
              <button type="button" className="btn-secondary" onClick={addCustomAssignee}>Add</button>
            </div>
          </div>
          <div className="field">
            <label>Notes</label>
            <textarea placeholder="Optional" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="modal-actions">
            {form.id ? <button className="btn-danger" onClick={handleDelete}>Delete task</button> : <span />}
            <div className="modal-right">
              <button className="btn-secondary" onClick={closeModal}>Cancel</button>
              <button className="btn-primary" onClick={handleSave}>Save</button>
            </div>
          </div>
        </div>
      </div>

      {toast ? <div id="toast">{toast}</div> : null}
    </>
  );
}
