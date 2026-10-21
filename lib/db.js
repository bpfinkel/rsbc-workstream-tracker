import { getSupabaseAdmin } from './supabase/admin';

// Supabase-backed data (Tasks & Roster). Kept apart from lib/sheets.js so the
// routes that only need Supabase never load the googleapis package, which
// was adding seconds to their cold starts.

export const STATUSES = ['Not Started', 'In Progress', 'Completed'];

const EXTRA_MEMBERS = [
  { name: 'QA+M', role: 'Architect (external)', status: 'External', officer: false, email: '', phone: '' }
];

// --- Tasks & Roster ---
// Migrated from Google Sheets to Supabase on 2026-09-23 (project RSBC-APP,
// same Supabase project already used for Auth). Draft Tasks / Draft
// Documents / Key Documents / RFP Scoring remain Sheets-backed in lib/sheets.js.
// Function names/signatures/return shapes are unchanged from the Sheets
// version, so nothing outside this file needed to change except the new
// admin-only roster CRUD routes/UI.

function taskFromRow(row) {
  return {
    id: row.id,
    title: row.title || '',
    description: row.description || '',
    workstream: row.workstream || '',
    assignees: row.assignees || [],
    status: row.status || STATUSES[0],
    deadline: row.deadline || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    notes: row.notes || ''
  };
}

export async function listTasks() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('tasks').select('*').order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []).map(taskFromRow);
}

export async function addTask(task) {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      title: task.title || '',
      description: task.description || '',
      workstream: task.workstream || 'Unsorted',
      assignees: task.assignees || [],
      status: task.status || STATUSES[0],
      deadline: task.deadline || '',
      notes: task.notes || '',
      created_at: now,
      updated_at: now
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return taskFromRow(data);
}

export async function updateTask(task) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('tasks')
    .update({
      title: task.title || '',
      description: task.description || '',
      workstream: task.workstream || 'Unsorted',
      assignees: task.assignees || [],
      status: task.status || STATUSES[0],
      deadline: task.deadline || '',
      notes: task.notes || '',
      updated_at: new Date().toISOString()
    })
    .eq('id', task.id)
    .select()
    .single();
  if (error) throw new Error(error.message.includes('no rows') ? 'Task not found' : error.message);
  return taskFromRow(data);
}

export async function deleteTask(id) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('tasks').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

function memberFromRow(row) {
  return {
    id: row.id,
    name: row.name || '',
    role: row.role || '',
    status: row.status || '',
    officer: row.status === 'Officer',
    email: row.email || '',
    phone: row.phone || ''
  };
}

// Reads the committee roster from Supabase (formerly the separate "RSBC
// Roster" Google Sheet). Email/phone are included for the Roster page's
// contact card, gated behind login (unlike the old Sheets version, which
// predated the app having auth at all).
export async function listMembers() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('members').select('*').order('sort_order', { ascending: true });
  if (error) throw new Error(error.message);
  return [...(data || []).map(memberFromRow), ...EXTRA_MEMBERS];
}

// Self-service contact-card edit (phone always; email admin-only — enforced
// by the caller in pages/api/members.js), keyed by name for backward
// compatibility with the existing Roster page UI. Name/role/status stay
// admin-controlled — see updateMemberById below for the full-edit path.
export async function updateMember(name, fields) {
  const supabase = getSupabaseAdmin();
  const patch = { updated_at: new Date().toISOString() };
  if (fields.email !== undefined) patch.email = fields.email;
  if (fields.phone !== undefined) patch.phone = fields.phone;
  const { data, error } = await supabase.from('members').update(patch).eq('name', name).select().single();
  if (error) throw new Error(error.message.includes('no rows') ? 'Member not found' : error.message);
  return memberFromRow(data);
}

// --- Roster admin (add / full edit / remove) ---
// Backs the Admin page's Roster section, which replaces the old
// "edit a spreadsheet row" workflow now that Roster is a database table.
// Distinct from updateMember above (self-service, name-keyed, phone/email
// only) — these are id-keyed and admin-only, gated in the API routes.

export async function addMember(fields) {
  const supabase = getSupabaseAdmin();
  const { data: maxRow } = await supabase
    .from('members')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSortOrder = (maxRow?.sort_order || 0) + 1;
  const { data, error } = await supabase
    .from('members')
    .insert({
      name: fields.name || '',
      role: fields.role || '',
      status: fields.status || '',
      email: fields.email || '',
      phone: fields.phone || '',
      sort_order: nextSortOrder
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return memberFromRow(data);
}

export async function updateMemberById(id, fields) {
  const supabase = getSupabaseAdmin();
  const patch = { updated_at: new Date().toISOString() };
  ['name', 'role', 'status', 'email', 'phone'].forEach((key) => {
    if (fields[key] !== undefined) patch[key] = fields[key];
  });
  const { data, error } = await supabase.from('members').update(patch).eq('id', id).select().single();
  if (error) throw new Error(error.message.includes('no rows') ? 'Member not found' : error.message);
  return memberFromRow(data);
}

export async function deleteMember(id) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('members').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
