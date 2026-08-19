import { listMembers, addDrafts } from '../../../lib/sheets';
import { extractPdfText } from '../../../lib/pdf';
import { getFathomMeetingForDate } from '../../../lib/fathom';
import { extractTasksFromMeeting } from '../../../lib/taskExtraction';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { date, minutesUrl } = req.body || {};
  if (!date) return res.status(400).json({ error: 'date is required' });

  try {
    const [members, minutesText, fathom] = await Promise.all([
      listMembers(),
      minutesUrl ? extractPdfText(minutesUrl) : Promise.resolve(''),
      getFathomMeetingForDate(date).catch(() => null)
    ]);

    const rosterNames = members.map((m) => m.name);
    const drafts = await extractTasksFromMeeting({
      meetingDate: date,
      minutesText,
      fathomSummary: fathom?.summary || '',
      fathomActionItems: fathom?.actionItems || [],
      rosterNames
    });

    if (drafts.length === 0) {
      return res.status(200).json({ drafts: [], warning: 'No action items were extracted from this meeting.' });
    }

    const saved = await addDrafts(drafts, date);
    return res.status(200).json({ drafts: saved, fathomFound: Boolean(fathom) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
