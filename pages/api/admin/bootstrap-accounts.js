import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { members } = req.body || {};
  if (!Array.isArray(members) || members.length === 0) {
    return res.status(400).json({ error: 'Expected { members: [{ email, password }, ...] }' });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const results = [];
  for (const member of members) {
    const { error } = await supabaseAdmin.auth.admin.createUser({
      email: member.email,
      password: member.password,
      email_confirm: true
    });
    results.push({ email: member.email, ok: !error, error: error ? error.message : null });
  }

  return res.status(200).json({ results });
}
