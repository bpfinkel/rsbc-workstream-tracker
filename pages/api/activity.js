import { listMembers } from '../../lib/sheets';
import { getSupabaseAdmin } from '../../lib/supabase/admin';
import { getUserFromRequest } from '../../lib/supabase/server';
import { isAdmin } from '../../lib/admin';

const WINDOW_DAYS = 30;

function dateKeyET(iso) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
}

// Backs the Admin page's "Member Activity" section. Rows are written by
// middleware.js (throttled to one per member per 5 minutes of use), so they
// reflect real page loads rather than Supabase's rarely-updated last sign-in.
export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', ['GET']);
      return res.status(405).json({ error: 'Method not allowed' });
    }
    const user = await getUserFromRequest(req, res);
    if (!isAdmin(user?.email)) return res.status(403).json({ error: 'Forbidden' });

    const supabase = getSupabaseAdmin();
    const since = new Date(Date.now() - WINDOW_DAYS * 86400000).toISOString();

    const [membersList, recentRes, usersRes] = await Promise.all([
      listMembers(),
      supabase.from('activity_log').select('email, path, created_at').gte('created_at', since).order('created_at', { ascending: false }).limit(20000),
      supabase.auth.admin.listUsers({ perPage: 1000 })
    ]);
    if (recentRes.error) throw new Error(recentRes.error.message);

    const byEmail = {};
    for (const row of recentRes.data || []) {
      const key = row.email.toLowerCase();
      if (!byEmail[key]) byEmail[key] = { lastActive: row.created_at, lastPath: row.path, days: new Set() };
      byEmail[key].days.add(dateKeyET(row.created_at));
    }

    const signIns = {};
    for (const u of usersRes.data?.users || []) {
      if (u.email) signIns[u.email.toLowerCase()] = u.last_sign_in_at || null;
    }

    const members = await Promise.all(
      membersList.filter((m) => m.id).map(async (m) => {
        const key = (m.email || '').toLowerCase();
        let recent = key ? byEmail[key] : null;
        let lastActive = recent?.lastActive || null;
        let lastPath = recent?.lastPath || null;
        // Nothing in the window: look further back for their latest row.
        if (key && !recent) {
          const { data } = await supabase.from('activity_log').select('path, created_at').ilike('email', key).order('created_at', { ascending: false }).limit(1);
          if (data?.[0]) {
            lastActive = data[0].created_at;
            lastPath = data[0].path;
          }
        }
        return {
          id: m.id,
          name: m.name,
          role: m.role,
          email: m.email || '',
          lastActive,
          lastPath,
          activeDays: recent ? recent.days.size : 0,
          lastSignIn: key ? signIns[key] || null : null
        };
      })
    );

    members.sort((a, b) => (b.lastActive || '').localeCompare(a.lastActive || ''));
    return res.status(200).json({ members, windowDays: WINDOW_DAYS });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
