import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';

const GROUP_ORDER = ['Officer', 'Voting Member', 'Ex-Officio Member', 'External'];
const GROUP_LABEL = {
  'Officer': 'Officers',
  'Voting Member': 'Voting Members',
  'Ex-Officio Member': 'Ex-Officio Members',
  'External': 'External'
};

export default function Roster() {
  const [members, setMembers] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');

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
        <title>RSBC Roster</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <header>
        <div>
          <h1>RSBC Workstream Tracker</h1>
          <div className="sub">Leadership Task Board</div>
          <nav className="page-nav">
            <Link href="/" className="page-nav-link">Tasks</Link>
            <Link href="/roster" className="page-nav-link active">Roster</Link>
          </nav>
        </div>
      </header>

      <main>
        {error ? (
          <div className="empty">Error: {error}</div>
        ) : !loaded ? null : (
          groups.map((g) => (
            <div className="workstream-group" key={g.status}>
              <h2>{g.label} ({g.members.length})</h2>
              <div className="roster-list">
                {g.members.map((m) => (
                  <div className="roster-row" key={m.name}>
                    <span className="roster-name">{m.name}</span>
                    <span className="roster-role">{m.role}</span>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </main>
    </>
  );
}
