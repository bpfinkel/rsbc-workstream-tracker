import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Header from '../components/Header';
import { BOARDS, BOARD_ORDER } from '../lib/publicBoards';
import { useModalViewportLock } from '../lib/useViewportLock';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function isoFrom(year, month, day) {
  return new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
}

function formatFullDate(iso) {
  if (!iso) return '';
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  });
}

function formatShortDate(iso) {
  if (!iso) return '';
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric'
  });
}

// Calendar cells have room for a few characters at most: "10:30 AM" -> "10:30a".
function shortTime(time) {
  if (!time) return null;
  return time.replace(':00', '').replace(' AM', 'a').replace(' PM', 'p');
}

function CalendarIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3.5" y="5" width="17" height="16" rx="2" /><path d="M8 3v4M16 3v4M3.5 10h17" /></svg>
  );
}

function ClockIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3.2 2" /></svg>
  );
}

function LinkIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3A5 5 0 0 0 13.5 3.5l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3A5 5 0 0 0 10.5 20.5l1.7-1.7" /></svg>
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

function EventDetail({ event }) {
  const board = BOARDS[event.board];
  return (
    <div className={'pbc-detail pbc-board-' + event.board}>
      <div className="pbc-detail-top">
        <span className="pbc-pill">{board.short}</span>
        <span className="pbc-detail-time">{event.time || 'Time not published'}</span>
      </div>
      <div className="pbc-detail-title">{event.title}</div>
      {event.note ? <div className="pbc-detail-meta pbc-detail-note">{event.note}</div> : null}
      {event.format ? <div className="pbc-detail-meta">{event.format}</div> : null}
      {event.location ? (
        <div className="pbc-detail-meta">{event.location}</div>
      ) : (
        <div className="pbc-detail-meta pbc-detail-muted">
          Location not published in the source calendar — check the listing below.
        </div>
      )}
      <a
        className="pbc-detail-link"
        href={event.url || board.sourceUrl}
        target="_blank"
        rel="noreferrer"
      >
        <LinkIcon />
        {event.url ? 'Town calendar listing' : board.name + ' calendar'}
      </a>
    </div>
  );
}

export default function PublicMeetings() {
  const [data, setData] = useState({ events: [], sources: [], todayET: null, fetchedAt: null });
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [cursor, setCursor] = useState(null);
  const [view, setView] = useState('month');
  const [hiddenBoards, setHiddenBoards] = useState(() => new Set());
  const [showCommittees, setShowCommittees] = useState(false);
  const [dayModal, setDayModal] = useState(null);
  const [nextOpen, setNextOpen] = useState(true);
  const [sourcesOpen, setSourcesOpen] = useState(false);

  useEffect(() => {
    fetch('/api/public-meetings')
      .then((res) => res.json())
      .then((d) => {
        setData(d);
        if (d.error) setError(d.error);
        const today = d.todayET || new Date().toISOString().slice(0, 10);
        // Boards break for weeks at a time, so the current month is often empty
        // — opening on an empty grid reads like a broken page. Anchor on the
        // current month when it has something in it, otherwise on the month of
        // the next scheduled meeting.
        const all = d.events || [];
        const thisMonth = today.slice(0, 7);
        const hasThisMonth = all.some((e) => e.primary && e.date.slice(0, 7) === thisMonth);
        const nextUp = all.find((e) => e.primary && e.date >= today);
        const anchor = hasThisMonth || !nextUp ? today : nextUp.date;
        const [y, m] = anchor.split('-').map(Number);
        setCursor({ year: y, month: m - 1 });
        setLoaded(true);
      })
      .catch((e) => { setError(e.message); setLoaded(true); });
  }, []);

  useModalViewportLock(!!dayModal);

  const { events, sources, todayET } = data;

  const visible = useMemo(
    () => events.filter((e) => !hiddenBoards.has(e.board) && (showCommittees || e.primary)),
    [events, hiddenBoards, showCommittees]
  );

  const byDate = useMemo(() => {
    const map = new Map();
    for (const e of visible) {
      if (!map.has(e.date)) map.set(e.date, []);
      map.get(e.date).push(e);
    }
    return map;
  }, [visible]);

  // Navigation bounds come from the full event set, not the filtered one, so
  // toggling a board off doesn't strand the reader in a month they can't leave.
  const bounds = useMemo(() => {
    if (!events.length) return null;
    return { first: events[0].date.slice(0, 7), last: events[events.length - 1].date.slice(0, 7) };
  }, [events]);

  const monthKey = cursor
    ? `${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}`
    : null;
  const atFirst = !!(bounds && monthKey && monthKey <= bounds.first);
  const atLast = !!(bounds && monthKey && monthKey >= bounds.last);

  const grid = useMemo(() => {
    if (!cursor) return [];
    const { year, month } = cursor;
    const firstDow = new Date(Date.UTC(year, month, 1)).getUTCDay();
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const cells = [];
    for (let i = 0; i < firstDow; i += 1) {
      cells.push({ iso: isoFrom(year, month, 1 - firstDow + i), outside: true });
    }
    for (let d = 1; d <= daysInMonth; d += 1) {
      cells.push({ iso: isoFrom(year, month, d), outside: false });
    }
    while (cells.length % 7 !== 0) {
      const trailing = cells.length - firstDow - daysInMonth;
      cells.push({ iso: isoFrom(year, month, daysInMonth + 1 + trailing), outside: true });
    }
    return cells;
  }, [cursor]);

  const monthDays = useMemo(() => {
    if (!monthKey) return [];
    return Array.from(byDate.keys())
      .filter((iso) => iso.startsWith(monthKey))
      .sort()
      .map((iso) => ({ iso, items: byDate.get(iso) }));
  }, [byDate, monthKey]);

  const upcoming = useMemo(
    () => (todayET ? visible.filter((e) => e.date >= todayET).slice(0, 3) : []),
    [visible, todayET]
  );

  function step(delta) {
    setCursor((c) => {
      const dt = new Date(Date.UTC(c.year, c.month + delta, 1));
      return { year: dt.getUTCFullYear(), month: dt.getUTCMonth() };
    });
  }

  function goToday() {
    if (!todayET) return;
    const [y, m] = todayET.split('-').map(Number);
    setCursor({ year: y, month: m - 1 });
  }

  function toggleBoard(key) {
    setHiddenBoards((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  const dayModalEvents = dayModal ? byDate.get(dayModal) || [] : [];

  return (
    <>
      <Head>
        <title>Riverside School Building Committee — Public Board Meeting Calendar</title>
      </Head>
      <Header active="public-meetings" />

      <main>
        {!loaded ? (
          <div className="empty">Loading the town meeting calendar…</div>
        ) : (
          <>
            {error ? <div className="empty">{error}</div> : null}

            <div className="workstream-group">
              <button type="button" className="ws-header ws-header-btn" onClick={() => setNextOpen((o) => !o)}>
                <ClockIcon />
                <h2>Next Up</h2>
                <ChevronIcon open={nextOpen} className="ws-header-chevron" />
              </button>
              {nextOpen ? (
                upcoming.length ? (
                  <div className="pbc-next-grid">
                    {upcoming.map((e) => (
                      <div className={'card static-card pbc-next-card pbc-board-' + e.board} key={e.id}>
                        <div className="pbc-next-date">{formatShortDate(e.date)}</div>
                        <EventDetail event={e} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty">No upcoming meetings match the current filters.</div>
                )
              ) : null}
            </div>

            <div className="pbc-toolbar">
              <div className="pbc-monthnav">
                <button type="button" className="pbc-nav-btn" onClick={() => step(-1)} disabled={atFirst} aria-label="Previous month">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
                </button>
                <span className="pbc-monthlabel">
                  {cursor ? `${MONTH_NAMES[cursor.month]} ${cursor.year}` : ''}
                </span>
                <button type="button" className="pbc-nav-btn" onClick={() => step(1)} disabled={atLast} aria-label="Next month">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
                </button>
              </div>
              <div className="pbc-toolbar-right">
                <button type="button" className="btn-secondary pbc-today-btn" onClick={goToday}>Today</button>
                <div className="pbc-viewtoggle">
                  <button type="button" className={'view-btn' + (view === 'month' ? ' active' : '')} onClick={() => setView('month')}>Month</button>
                  <button type="button" className={'view-btn' + (view === 'list' ? ' active' : '')} onClick={() => setView('list')}>List</button>
                </div>
              </div>
            </div>

            <div className="pbc-filters">
              <div className="pbc-legend">
                {BOARD_ORDER.map((key) => {
                  const on = !hiddenBoards.has(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      className={'pbc-legend-btn pbc-board-' + key + (on ? ' on' : '')}
                      onClick={() => toggleBoard(key)}
                      aria-pressed={on}
                    >
                      <span className="pbc-legend-swatch" />
                      <span className="pbc-legend-full">{BOARDS[key].name}</span>
                      <span className="pbc-legend-abbr">{BOARDS[key].short}</span>
                    </button>
                  );
                })}
              </div>
              <label className="pbc-switch">
                <input
                  type="checkbox"
                  checked={showCommittees}
                  onChange={(e) => setShowCommittees(e.target.checked)}
                />
                <span>Include committee &amp; subcommittee meetings</span>
              </label>
            </div>

            {view === 'month' ? (
              <div className="pbc-grid-wrap">
                <div className="pbc-grid">
                  {WEEKDAYS.map((d) => (
                    <div className="pbc-dow" key={d}>
                      <span className="pbc-dow-full">{d}</span>
                      <span className="pbc-dow-abbr">{d.charAt(0)}</span>
                    </div>
                  ))}
                  {grid.map((cell) => {
                    const items = byDate.get(cell.iso) || [];
                    return (
                      <button
                        type="button"
                        key={cell.iso}
                        className={
                          'pbc-cell' +
                          (cell.outside ? ' pbc-outside' : '') +
                          (cell.iso === todayET ? ' pbc-today' : '') +
                          (items.length ? ' pbc-has' : '')
                        }
                        disabled={!items.length}
                        onClick={() => setDayModal(cell.iso)}
                        aria-label={
                          items.length
                            ? `${formatFullDate(cell.iso)} — ${items.length} meeting${items.length > 1 ? 's' : ''}`
                            : formatFullDate(cell.iso)
                        }
                      >
                        <span className="pbc-daynum">{Number(cell.iso.slice(8, 10))}</span>
                        <span className="pbc-chips">
                          {items.slice(0, 3).map((e) => (
                            <span className={'pbc-chip pbc-board-' + e.board} key={e.id}>
                              <span className="pbc-chip-label">{e.chipLabel}</span>
                              {e.time ? <span className="pbc-chip-time">{shortTime(e.time)}</span> : null}
                            </span>
                          ))}
                          {items.length > 3 ? (
                            <span className="pbc-chip-more">+{items.length - 3} more</span>
                          ) : null}
                        </span>
                        <span className="pbc-dots">
                          {items.slice(0, 4).map((e) => (
                            <span className={'pbc-dot pbc-board-' + e.board} key={e.id} />
                          ))}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="pbc-list">
                {monthDays.length === 0 ? (
                  <div className="empty">
                    No meetings listed for {cursor ? `${MONTH_NAMES[cursor.month]} ${cursor.year}` : 'this month'}.
                  </div>
                ) : (
                  monthDays.map(({ iso, items }) => (
                    <div className={'pbc-list-day' + (iso === todayET ? ' pbc-today' : '')} key={iso}>
                      <div className="pbc-list-date">
                        <span className="pbc-list-dow">
                          {new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' })}
                        </span>
                        <span className="pbc-list-dnum">{Number(iso.slice(8, 10))}</span>
                      </div>
                      <div className="pbc-list-items">
                        {items.map((e) => <EventDetail event={e} key={e.id} />)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            <div className="workstream-group pbc-sources-group">
              <button type="button" className="ws-header ws-header-btn" onClick={() => setSourcesOpen((o) => !o)}>
                <CalendarIcon />
                <h2>Sources &amp; Notes</h2>
                <ChevronIcon open={sourcesOpen} className="ws-header-chevron" />
              </button>
              {sourcesOpen ? (
                <div className="pbc-sources">
                  <p className="pbc-sources-intro">
                    This calendar is rebuilt from each board&apos;s own published schedule every time
                    the page is loaded (cached for 30 minutes), so it follows added, moved and
                    cancelled meetings without anyone re-keying dates.
                  </p>
                  {sources.map((s) => (
                    <div className={'pbc-source-row pbc-board-' + s.board} key={s.board}>
                      <div className="pbc-source-head">
                        <span className="pbc-pill">{BOARDS[s.board].short}</span>
                        <span className="pbc-source-name">{s.name}</span>
                        <span className={'pbc-source-status' + (s.ok ? '' : ' bad')}>
                          {s.ok ? `${s.count} meeting${s.count === 1 ? '' : 's'}` : 'Unavailable'}
                        </span>
                      </div>
                      <div className="pbc-source-meta">
                        <a href={s.sourceUrl} target="_blank" rel="noreferrer">{s.sourceLabel}</a>
                        {s.documentUrl ? (
                          <>
                            {' · '}
                            <a href={s.documentUrl} target="_blank" rel="noreferrer">{s.documentLabel}</a>
                          </>
                        ) : null}
                      </div>
                      {s.ok && s.publishedThrough ? (
                        <div className="pbc-source-meta pbc-detail-muted">
                          Schedule published through {formatFullDate(s.publishedThrough)}
                        </div>
                      ) : null}
                      {!s.ok && s.error ? (
                        <div className="pbc-source-meta pbc-source-error">{s.error}</div>
                      ) : null}
                    </div>
                  ))}
                  {data.fetchedAt ? (
                    <p className="pbc-sources-note pbc-detail-muted">
                      Last refreshed {new Date(data.fetchedAt).toLocaleString('en-US', {
                        dateStyle: 'medium', timeStyle: 'short'
                      })}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </>
        )}
      </main>

      <div className={'overlay' + (dayModal ? ' open' : '')} onClick={(e) => { if (e.target === e.currentTarget) setDayModal(null); }}>
        {dayModal ? (
          <div className="modal pbc-day-modal">
            <h3>{formatFullDate(dayModal)}</h3>
            <div className="pbc-day-list">
              {dayModalEvents.map((e) => <EventDetail event={e} key={e.id} />)}
            </div>
            <div className="modal-actions">
              <span />
              <button type="button" className="btn-secondary" onClick={() => setDayModal(null)}>Close</button>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
