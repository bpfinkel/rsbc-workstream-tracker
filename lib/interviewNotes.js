import { getSupabaseAdmin } from './supabase/admin';

// Interviewer Sheet notes, one row per (member, firm) in the Supabase
// `interview_notes` table. RLS is on with no policies, so only this
// service-role client can touch the table; pages/api/interview-notes.js decides
// who may see what (a member their own rows, admins everyone's).

function fromRow(r) {
  return {
    scorerEmail: r.scorer_email,
    firm: r.firm,
    interviewer: r.interviewer || '',
    date: r.interview_date || '',
    notes: Array.isArray(r.notes) ? r.notes : [],
    scores: Array.isArray(r.scores) ? r.scores : [],
    updatedAt: r.updated_at
  };
}

export async function listInterviewNotes(scorerEmail) {
  const supabase = getSupabaseAdmin();
  let q = supabase.from('interview_notes').select('*').order('firm', { ascending: true });
  if (scorerEmail) q = q.eq('scorer_email', scorerEmail.toLowerCase());
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data || []).map(fromRow);
}

export async function saveInterviewNote({ scorerEmail, firm, interviewer, date, notes, scores }) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('interview_notes')
    .upsert({
      scorer_email: scorerEmail.toLowerCase(),
      firm,
      interviewer,
      interview_date: date || null,
      notes,
      scores,
      updated_at: new Date().toISOString()
    }, { onConflict: 'scorer_email,firm' })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return fromRow(data);
}

export async function deleteInterviewNote(scorerEmail, firm) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('interview_notes')
    .delete()
    .eq('scorer_email', scorerEmail.toLowerCase())
    .eq('firm', firm);
  if (error) throw new Error(error.message);
}
