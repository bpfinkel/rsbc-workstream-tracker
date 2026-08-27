import { useEffect, useState } from 'react';
import Head from 'next/head';
import Header from '../components/Header';

const GROUP_ORDER = ['Officer', 'Voting Member', 'Ex-Officio Member', 'External'];
const GROUP_LABEL = {
  'Officer': 'Officers',
  'Voting Member': 'Voting Members',
  'Ex-Officio Member': 'Ex-Officio Members',
  'External': 'External'
};

function GroupIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="3.6" /><path d="M22.5 20v-2a4 4 0 0 0-3-3.87" /><path d="M16 4.13a4 4 0 0 1 0 7.75" /></svg>
  );
}

function initials(name) {
  return String(name || '')
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function Roster() {
  const [members, setMembers] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    fetch('/api/members')
      .then((res) => res.json())
      .then((data) => {
        setMembers(data.members || []);
        setLoaded(true);
      })
      .catch((e) => setError(e.message));
  }, []);

  const groups = GROUP_ORDER
    .map((status) => ({
      status,
      label: GROUP_LABEL[status],
      members: members.filter((m) => m.status === status)
    }))
    .filter((g) => g.members.length > 0);

  return (
    <>
      <Head>
        <title>Riverside School Building Committee — Roster</title>
      </Head>
      <Header active="roster" />

      <main>
        {error ? (
          <div className="empty">Error: {error}</div>
        ) : !loaded ? null : (
          groups.map((g) => (
            <div className="workstream-group" key={g.status}>
              <div className="ws-header">
                <GroupIcon />
                <h2>{g.label}</h2>
                <span className="ws-count">{g.members.length}</span>
              </div>
              <div className="roster-list">
                {g.members.map((m) => (
                  <div className="roster-row" key={m.name} onClick={() => setSelected(m)}>
                    <span className="roster-avatar">{initials(m.name)}</span>
                    <span className="roster-name">{m.name}</span>
                    <span className="roster-role">{m.role}</span>
                    <svg className="roster-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </main>

      <div className={'overlay' + (selected ? ' open' : '')} onClick={(e) => { if (e.target === e.currentTarget) setSelected(null); }}>
        {selected && (
          <div className="modal contact-card">
            <h3>{selected.name}</h3>
            <div className="contact-field">
              <span className="contact-label">Title</span>
              <span className="contact-value">{selected.role}</span>
            </div>
            <div className="contact-field">
              <span className="contact-label">Email</span>
              <span className="contact-value">
                {selected.email ? <a href={'mailto:' + selected.email}>{selected.email}</a> : '—'}
              </span>
            </div>
            <div className="contact-field">
              <span className="contact-label">Mobile</span>
              <span className="contact-value">
                {selected.phone ? <a href={'tel:' + selected.phone}>{selected.phone}</a> : '—'}
              </span>
            </div>
            <div className="modal-actions">
              <span />
              <div className="modal-right">
                <button className="btn-secondary" onClick={() => setSelected(null)}>Close</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
