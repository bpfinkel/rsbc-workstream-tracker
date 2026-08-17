import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data, error } = await supabaseAdmin.auth.admin.listUsers();
  if (error) {
    return res.status(500).json({ error: error.message });
  }

  const results = [];
  for (const user of data.users) {
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      user_metadata: { ...user.user_metadata, must_change_password: true }
    });
    results.push({ email: user.email, ok: !updateError, error: updateError ? updateError.message : null });
  }

  return res.status(200).json({ results });
}
