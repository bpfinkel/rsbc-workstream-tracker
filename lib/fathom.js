const FATHOM_BASE = 'https://api.fathom.ai/external/v1';

// Fathom meetings are matched by date, not ID, since the app only knows the
// RSBC meeting's calendar date (from the committee website), not its Fathom
// recording ID. Field names (default_summary.markdown_formatted, action_items[],
// transcript[]) are best-effort from Fathom's docs — coded defensively so an
// unexpected shape yields empty strings instead of a crash.
export async function getFathomMeetingForDate(dateStr) {
  const apiKey = process.env.FATHOM_API_KEY;
  if (!apiKey) return null;

  const day = new Date(dateStr + 'T00:00:00Z');
  const after = new Date(day.getTime() - 24 * 3600 * 1000).toISOString();
  const before = new Date(day.getTime() + 2 * 24 * 3600 * 1000).toISOString();

  const params = new URLSearchParams({
    created_after: after,
    created_before: before,
    include_transcript: 'true',
    include_summary: 'true',
    include_action_items: 'true'
  });

  const res = await fetch(`${FATHOM_BASE}/meetings?${params.toString()}`, {
    headers: { 'X-Api-Key': apiKey }
  });
  if (!res.ok) throw new Error('Fathom API returned ' + res.status);
  const data = await res.json();
  const items = data.items || [];
  const match = items.find((m) => (m.title || '').toLowerCase().includes('rsbc'));
  if (!match) return null;

  return {
    title: match.title || '',
    summary: match.default_summary?.markdown_formatted || '',
    actionItems: (match.action_items || []).map((a) => ({
      description: a.description || a.text || '',
      completed: Boolean(a.completed),
      assignee: (a.assignee && (a.assignee.name || a.assignee)) || ''
    })),
    transcriptText: (match.transcript || [])
      .map((t) => `${t.speaker || ''}: ${t.text || ''}`)
      .join('\n')
  };
}
