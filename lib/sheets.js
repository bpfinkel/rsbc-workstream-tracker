import { google } from 'googleapis';
import { randomUUID } from 'crypto';

const SHEET_NAME = 'Tasks';
const SHEET_ID = process.env.GOOGLE_SHEET_ID;

const ROSTER_SHEET_ID = '1MvkPd_ah7J33H5cKmOhETIYHHgYEUeD7zpUGm7XEq4s';
const ROSTER_SHEET_NAME = 'Sheet1';

const DRAFT_SHEET_NAME = 'DraftTasks';
const DRAFT_HEADERS = ['ID', 'Title', 'Description', 'Workstream', 'Assignees', 'Deadline', 'Notes', 'SourceMeetingDate', 'Status', 'CreatedAt'];

export const STATUSES = ['Not Started', 'In Progress', 'Blocked', 'Completed'];

const EXTRA_MEMBERS = [
  { name: 'QA+M', role: 'Architect (external)', status: 'External', officer: false, email: '', phone: '' }
];

function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n')
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
}

async function getSheets() {
  const auth = getAuth();
  return google.sheets({ version: 'v4', auth });
}

function rowToTask(row) {
  return {
    id: row[0] || '',
    title: row[1] || '',
    description: row[2] || '',
    workstream: row[3] || '',
    assignees: row[4] ? String(row[4]).split(',').map((s) => s.trim()).filter(Boolean) : [],
    status: row[5] || STATUSES[0],
    deadline: row[6] || '',
    createdAt: row[7] || '',
    updatedAt: row[8] || '',
    notes: row[9] || ''
  };
}

export async function listTasks() {
  const sheets = await getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!A2:J`
  });
  const rows = res.data.values || [];
  return rows.filter((r) => r[0]).map(rowToTask);
}

// Reads the committee roster from the separate "RSBC Roster" sheet (My Drive/RSBC/Admin),
// which is the source of truth kept up to date independent of this app.
// Rows are Member, Position, Status, Email, Phone; a "FORMER MEMBERS -- EXCLUDE" marker
// row ends the active list. Email/phone are included for the Roster page's contact card —
// this app has no login yet, so that data is visible to anyone with the link (a deliberate,
// revisited call: acceptable while Bryan is the only real user).
export async function listMembers() {
  const sheets = await getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: ROSTER_SHEET_ID,
    range: `${ROSTER_SHEET_NAME}!B3:F`
  });
  const rows = res.data.values || [];
  const members = [];
  for (const row of rows) {
    const name = row[0] || '';
    if (!name || name.toUpperCase().includes('FORMER MEMBERS')) break;
    const role = row[1] || '';
    const status = row[2] || '';
    const email = row[3] || '';
    const phone = row[4] || '';
    members.push({ name, role, status, officer: status === 'Officer', email, phone });
  }
  return [...members, ...EXTRA_MEMBERS];
}

async function findRow(sheets, id) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!A:A`
  });
  const rows = res.data.values || [];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === id) return i + 1;
  }
  return -1;
}

export async function addTask(task) {
  const sheets = await getSheets();
  const id = randomUUID();
  const now = new Date().toISOString();
  const row = [
    id,
    task.title || '',
    task.description || '',
    task.workstream || 'Unsorted',
    (task.assignees || []).join(', '),
    task.status || STATUSES[0],
    task.deadline || '',
    now,
    now,
    task.notes || ''
  ];
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!A:J`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] }
  });
  return rowToTask(row);
}

export async function updateTask(task) {
  const sheets = await getSheets();
  const rowNum = await findRow(sheets, task.id);
  if (rowNum === -1) throw new Error('Task not found');
  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!H${rowNum}`
  });
  const createdAt = existing.data.values && existing.data.values[0] ? existing.data.values[0][0] : new Date().toISOString();
  const now = new Date().toISOString();
  const row = [
    task.title || '',
    task.description || '',
    task.workstream || 'Unsorted',
    (task.assignees || []).join(', '),
    task.status || STATUSES[0],
    task.deadline || '',
    createdAt,
    now,
    task.notes || ''
  ];
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!B${rowNum}:J${rowNum}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] }
  });
  return rowToTask([task.id, ...row.slice(0, 6), createdAt, now, row[8]]);
}

export async function deleteTask(id) {
  const sheets = await getSheets();
  const rowNum = await findRow(sheets, id);
  if (rowNum === -1) throw new Error('Task not found');
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const tab = meta.data.sheets.find((s) => s.properties.title === SHEET_NAME);
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: tab.properties.sheetId,
              dimension: 'ROWS',
              startIndex: rowNum - 1,
              endIndex: rowNum
            }
          }
        }
      ]
    }
  });
}

// --- Draft Tasks (Fathom/minutes extraction review queue) ---
// A separate tab in the same spreadsheet, same shape as Tasks plus SourceMeetingDate/Status.
// Nothing here ever writes to the live Tasks tab except approveDraft, which reuses addTask —
// keeping "what actually shows up on the board" governed by the same single code path
// regardless of whether a task was typed by hand or approved from a draft.

function rowToDraft(row) {
  return {
    id: row[0] || '',
    title: row[1] || '',
    description: row[2] || '',
    workstream: row[3] || '',
    assignees: row[4] ? String(row[4]).split(',').map((s) => s.trim()).filter(Boolean) : [],
    deadline: row[5] || '',
    notes: row[6] || '',
    sourceMeetingDate: row[7] || '',
    status: row[8] || 'Pending',
    createdAt: row[9] || ''
  };
}

async function ensureDraftSheet(sheets) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const exists = meta.data.sheets.some((s) => s.properties.title === DRAFT_SHEET_NAME);
  if (exists) return;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: { requests: [{ addSheet: { properties: { title: DRAFT_SHEET_NAME } } }] }
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${DRAFT_SHEET_NAME}!A1:J1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [DRAFT_HEADERS] }
  });
}

export async function listDrafts() {
  const sheets = await getSheets();
  await ensureDraftSheet(sheets);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${DRAFT_SHEET_NAME}!A2:J`
  });
  const rows = res.data.values || [];
  return rows.filter((r) => r[0]).map(rowToDraft);
}

export async function addDrafts(drafts, sourceMeetingDate) {
  const sheets = await getSheets();
  await ensureDraftSheet(sheets);
  const now = new Date().toISOString();
  const rows = drafts.map((d) => [
    randomUUID(),
    d.title || '',
    d.description || '',
    d.workstream || 'Unsorted',
    (d.assignees || []).join(', '),
    d.deadline || '',
    d.notes || '',
    sourceMeetingDate || '',
    'Pending',
    now
  ]);
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${DRAFT_SHEET_NAME}!A:J`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: rows }
  });
  return rows.map(rowToDraft);
}

async function findDraftRow(sheets, id) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${DRAFT_SHEET_NAME}!A:A`
  });
  const rows = res.data.values || [];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === id) return i + 1;
  }
  return -1;
}

async function setDraftStatus(sheets, rowNum, status) {
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${DRAFT_SHEET_NAME}!I${rowNum}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[status]] }
  });
}

export async function approveDraft(id) {
  const sheets = await getSheets();
  await ensureDraftSheet(sheets);
  const rowNum = await findDraftRow(sheets, id);
  if (rowNum === -1) throw new Error('Draft not found');
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${DRAFT_SHEET_NAME}!A${rowNum}:J${rowNum}`
  });
  const draft = rowToDraft(res.data.values[0]);
  const task = await addTask({
    title: draft.title,
    description: draft.description,
    workstream: draft.workstream,
    assignees: draft.assignees,
    deadline: draft.deadline,
    notes: draft.notes
  });
  await setDraftStatus(sheets, rowNum, 'Approved');
  return task;
}

export async function rejectDraft(id) {
  const sheets = await getSheets();
  await ensureDraftSheet(sheets);
  const rowNum = await findDraftRow(sheets, id);
  if (rowNum === -1) throw new Error('Draft not found');
  await setDraftStatus(sheets, rowNum, 'Rejected');
}
