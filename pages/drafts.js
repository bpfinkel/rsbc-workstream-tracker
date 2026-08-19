import { useEffect, useState } from 'react';
import Head from 'next/head';
import Header from '../components/Header';

function formatShortDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${m}/${d}/${y}`;
}

export default function Drafts() {
  const [meetings, setMeetings] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [generatingDate, setGeneratingDate] = useState('');
  const [error, setError] = useState('');

  async function loadAll() {
    const [meetingsRes, draftsRes] = await Promise.all([
      fetch('/api/meetings').then((r) => r.json()),
      fetch('/api/drafts').then((r) => r.json())
    ]);
    setMeetings(meetingsRes.meetings || []);
    setDrafts(draftsRes.drafts || []);
    setLoaded(true);
  }

  useEffect(() => {
    loadAll().catch((e) => setError(e.message));
  }, []);

  async function handleGenerate(meeting) {
    setError('');
    setGeneratingDate(meeting.date);
    try {
      const res = await fetch('/api/drafts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: meeting.date, minutesUrl: meeting.minutesUrl })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      if (data.warning) setError(data.warning);
      await loadAll();
    } catch (e) {
      setError(e.message);
    } finally {
      setGeneratingDate('');
    }
  }

  async function handleAction(id, action) {
    setError('');
    try {
      const res = await fetch('/api/drafts/' + id, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Action failed');
      await loadAll();
    } catch (e) {
      setError(e.message);
    }
  }

  const pending = drafts.filter((d) => d.status === 'Pending');
  const history = drafts.filter((d) => d.status !== 'Pending');
  const draftedDates = new Set(drafts.map((d) => d.sourceMeetingDate));

  return (
    <>
      <Head>
        <title>Riverside School Building Committee — Drafts</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Header active="drafts" />

      <main>
        {error ? <div className="empty">{error}</div> : null}

        <div className="workstream-group">
          <h2>Generate from a Meeting</h2>
          {!loaded ? null : meetings.length === 0 ? (
            <div className="empty">No meetings found.</div>
          ) : (
            <div className="roster-list">
              {meetings.slice().reverse().map((m) => (
                <div className="roster-row" key={m.date} style={{ cursor: 'default' }}>
                  <span className="roster-name">{formatShortDate(m.date)}</span>
                  <span className="roster-role">
                    {draftedDates.has(m.date) ? <span className="chip">Already generated</span> : null}
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={!m.minutesUrl || generatingDate === m.date}
                      onClick={() => handleGenerate(m)}
                      style={{ marginLeft: 8 }}
                    >
                      {generatingDate === m.date ? 'Generating…' : m.minutesUrl ? 'Generate Draft Tasks' : 'Minutes not posted yet'}
                    </button>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="workstream-group">
          <h2>Pending Review ({pending.length})</h2>
          {pending.length === 0 ? (
            <div className="empty">No drafts awaiting review.</div>
          ) : (
            <div className="cards">
              {pending.map((d) => (
                <div className="card" key={d.id}>
                  <p className="title">{d.title}</p>
                  {d.description ? <p className="desc">{d.description}</p> : null}
                  <span className="chip">{d.workstream}</span>
                  {d.assignees.map((a) => <span className="chip" key={a}>{a}</span>)}
                  {d.deadline ? <div className="deadline">Due {formatShortDate(d.deadline)}</div> : null}
                  <div className="deadline">From meeting {formatShortDate(d.sourceMeetingDate)}</div>
                  <div className="modal-actions" style={{ marginTop: 12 }}>
                    <button type="button" className="btn-danger" onClick={() => handleAction(d.id, 'reject')}>Veto</button>
                    <button type="button" className="btn-primary" onClick={() => handleAction(d.id, 'approve')}>OK — Add to Tasks</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="workstream-group">
          <h2>History ({history.length})</h2>
          {history.length === 0 ? (
            <div className="empty">Nothing reviewed yet.</div>
          ) : (
            <div className="compact-list">
              {history.map((d) => (
                <div className="row-compact" key={d.id}>
                  <span className="row-title">{d.title}</span>
                  <span className="row-date">{d.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
