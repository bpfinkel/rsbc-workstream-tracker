const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-5';

export async function extractTasksFromMeeting({ meetingDate, minutesText, fathomSummary, fathomActionItems, rosterNames }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured');

  const rosterList = rosterNames.join(', ');
  const actionItemsText = (fathomActionItems || [])
    .map((a) => `- ${a.description}${a.assignee ? ` (assignee mentioned: ${a.assignee})` : ''}`)
    .join('\n');

  const prompt = `You are extracting actionable follow-up tasks for the Riverside School Building Committee (RSBC) from materials for their ${meetingDate} meeting.

Committee roster (only use these names as assignees; if no committee member is clearly responsible, leave assignees empty):
${rosterList}

=== MEETING MINUTES ===
${minutesText || '(not available)'}

=== FATHOM AI SUMMARY ===
${fathomSummary || '(not available)'}

=== FATHOM ACTION ITEMS ===
${actionItemsText || '(not available)'}

Extract distinct, concrete action items that a committee member needs to follow up on before the next meeting. Skip anything that's just a discussion topic or FYI with no follow-up. For each, respond with a JSON array (and nothing else) of objects with these exact keys:
- "title": short imperative phrase (e.g. "Follow up with QA+M on elevator specs")
- "description": one or two sentences of context, or "" if the title is self-explanatory
- "workstream": a short category label (e.g. "Architect Selection", "Budget", "Compliance") inferred from context, or "Unsorted"
- "assignees": array of committee member names from the roster above who are responsible, or [] if unclear
- "deadline": a YYYY-MM-DD date if one was stated or clearly implied (e.g. "before next meeting" -> the date one week after ${meetingDate}), or "" if none
- "notes": anything else worth carrying over, or ""

Respond with ONLY the JSON array, no other text.`;

  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }]
    })
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error('Anthropic API returned ' + res.status + ': ' + errText.slice(0, 300));
  }
  const data = await res.json();
  const text = (data.content || []).map((c) => c.text || '').join('');
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('Could not find a JSON array in the model response');
  const parsed = JSON.parse(jsonMatch[0]);

  return parsed
    .map((item) => ({
      title: String(item.title || '').trim(),
      description: String(item.description || '').trim(),
      workstream: String(item.workstream || 'Unsorted').trim(),
      assignees: Array.isArray(item.assignees) ? item.assignees.filter(Boolean) : [],
      deadline: String(item.deadline || '').trim(),
      notes: String(item.notes || '').trim()
    }))
    .filter((t) => t.title);
}
