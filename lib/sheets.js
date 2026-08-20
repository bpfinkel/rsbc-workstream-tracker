import { google } from 'googleapis';
import { randomUUID } from 'crypto';

const SHEET_NAME = 'Tasks';
const SHEET_ID = process.env.GOOGLE_SHEET_ID;

const ROSTER_SHEET_ID = '1MvkPd_ah7J33H5cKmOhETIYHHgYEUeD7zpUGm7XEq4s';
const ROSTER_SHEET_NAME = 'Sheet1';

const DRAFT_SHEET_NAME = 'DraftTasks';
const DRAFT_HEADERS = [
  'ID', 'Title', 'Description', 'Workstream', 'Assignees', 'Deadline', 'Notes',
  'SourceMeetingDate', 'Status', 'CreatedAt',
  'DecidedBy', 'DecidedAt', 'OverrideAction', 'OverrideBy', 'OverrideAt'
];

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
// Nothing here ever writes to the live Tasks tab except approveDraft/overrideApproveDraft,
// which reuse addTask — keeping "what actually shows up on the board" governed by the same
// single code path regardless of whether a task was typed by hand or approved from a draft.

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
    createdAt: row[9] || '',
    decidedBy: row[10] || '',
    decidedAt: row[11] || '',
    overrideAction: row[12] || '',
    overrideBy: row[13] || '',
    overrideAt: row[14] || ''
  };
}

async function ensureDraftSheet(sheets) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const exists = meta.data.sheets.some((s) => s.properties.title === DRAFT_SHEET_NAME);
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: DRAFT_SHEET_NAME } } }] }
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${DRAFT_SHEET_NAME}!A1:O1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [DRAFT_HEADERS] }
    });
    return;
  }
  // Migration for sheets created before the DecidedBy/DecidedAt/Override* columns
  // existed — extend the header row only, never touch existing data rows.
  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${DRAFT_SHEET_NAME}!A1:O1`
  });
  const currentHeaders = (headerRes.data.values && headerRes.data.values[0]) || [];
  if (currentHeaders.length < DRAFT_HEADERS.length) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${DRAFT_SHEET_NAME}!A1:O1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [DRAFT_HEADERS] }
    });
  }
}

export async function listDrafts() {
  const sheets = await getSheets();
  await ensureDraftSheet(sheets);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${DRAFT_SHEET_NAME}!A2:O`
  });
  const rows = res.data.values || [];
  return rows.filter((r) => r[0]).map(rowToDraft);
}

// Dedups on (title, sourceMeetingDate) against every existing row regardless of
// status — guards against a retry after a dropped response re-posting the same
// batch, which nearly happened during testing. Skips silently rather than
// erroring, since "already there" isn't a failure from the caller's side.
export async function addDrafts(drafts, sourceMeetingDate) {
  const sheets = await getSheets();
  await ensureDraftSheet(sheets);

  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${DRAFT_SHEET_NAME}!A2:O`
  });
  const existingKeys = new Set(
    (existing.data.values || [])
      .filter((r) => r[0])
      .map((r) => `${(r[1] || '').trim().toLowerCase()}|${r[7] || ''}`)
  );

  const newDrafts = drafts.filter((d) => {
    const key = `${(d.title || '').trim().toLowerCase()}|${sourceMeetingDate || ''}`;
    return !existingKeys.has(key);
  });
  if (newDrafts.length === 0) return [];

  const now = new Date().toISOString();
  const rows = newDrafts.map((d) => [
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

async function getDraftByRow(sheets, rowNum) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${DRAFT_SHEET_NAME}!A${rowNum}:O${rowNum}`
  });
  return rowToDraft(res.data.values[0]);
}

async function setDraftStatus(sheets, rowNum, status) {
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${DRAFT_SHEET_NAME}!I${rowNum}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[status]] }
  });
}

// Records who made the original Approve/Reject call and when. Kept separate from
// the Override columns below so a later override doesn't erase the original decision.
async function setDraftDecided(sheets, rowNum, decidedBy) {
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${DRAFT_SHEET_NAME}!K${rowNum}:L${rowNum}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[decidedBy || 'unknown', new Date().toISOString()]] }
  });
}

async function setDraftOverride(sheets, rowNum, action, overrideBy) {
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${DRAFT_SHEET_NAME}!M${rowNum}:O${rowNum}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[action, overrideBy || 'unknown', new Date().toISOString()]] }
  });
}

export async function approveDraft(id, decidedBy) {
  const sheets = await getSheets();
  await ensureDraftSheet(sheets);
  const rowNum = await findDraftRow(sheets, id);
  if (rowNum === -1) throw new Error('Draft not found');
  const draft = await getDraftByRow(sheets, rowNum);
  const task = await addTask({
    title: draft.title,
    description: draft.description,
    workstream: draft.workstream,
    assignees: draft.assignees,
    deadline: draft.deadline,
    notes: draft.notes
  });
  await setDraftStatus(sheets, rowNum, 'Approved');
  await setDraftDecided(sheets, rowNum, decidedBy);
  return task;
}

export async function rejectDraft(id, decidedBy) {
  const sheets = await getSheets();
  await ensureDraftSheet(sheets);
  const rowNum = await findDraftRow(sheets, id);
  if (rowNum === -1) throw new Error('Draft not found');
  await setDraftStatus(sheets, rowNum, 'Rejected');
  await setDraftDecided(sheets, rowNum, decidedBy);
}

// Resets a Rejected draft back to Pending for reconsideration. The original
// rejection's DecidedBy/DecidedAt is left untouched; who reversed it and when
// goes in OverrideAction/OverrideBy/OverrideAt instead.
export async function moveDraftToPending(id, overrideBy) {
  const sheets = await getSheets();
  await ensureDraftSheet(sheets);
  const rowNum = await findDraftRow(sheets, id);
  if (rowNum === -1) throw new Error('Draft not found');
  const draft = await getDraftByRow(sheets, rowNum);
  if (draft.status !== 'Rejected') throw new Error('Only a rejected draft can be moved back to Pending');
  await setDraftStatus(sheets, rowNum, 'Pending');
  await setDraftOverride(sheets, rowNum, 'Moved to Pending', overrideBy);
}

// Approves a Rejected draft despite the rejection. Adds the task the same way a
// normal approval does, but the action is recorded under OverrideAction/By/At
// rather than DecidedBy/At, so the original rejection stays visible too.
export async function overrideApproveDraft(id, overrideBy) {
  const sheets = await getSheets();
  await ensureDraftSheet(sheets);
  const rowNum = await findDraftRow(sheets, id);
  if (rowNum === -1) throw new Error('Draft not found');
  const draft = await getDraftByRow(sheets, rowNum);
  if (draft.status !== 'Rejected') throw new Error('Only a rejected draft can be override-approved');
  const task = await addTask({
    title: draft.title,
    description: draft.description,
    workstream: draft.workstream,
    assignees: draft.assignees,
    deadline: draft.deadline,
    notes: draft.notes
  });
  await setDraftStatus(sheets, rowNum, 'Approved');
  await setDraftOverride(sheets, rowNum, 'Approved (Override)', overrideBy);
  return task;
}

// --- RFP Scoring (Owner's Rep RFP review) ---
// Two small tabs in the same spreadsheet: RFPFirms (the roster of firms being
// scored, plus whether Interview scoring is unlocked for each) and RFPScoring
// (one row per phase+firm+scorer submission — a scorer can freely resubmit,
// which upserts in place rather than creating a duplicate row). Criteria labels
// and point weights live in lib/rfpCriteria.js, not here.

const RFP_FIRMS_SHEET = 'RFPFirms';
const RFP_FIRMS_HEADERS = ['Firm', 'InterviewUnlocked'];
const RFP_FIRMS_SEED = [
  'Arcadis U.S.',
  'Jones Lang LaSalle, Inc.',
  'Colliers Project Leaders',
  'CHA Harbor',
  'Morganti',
  'MGMT',
  'Cumming Group'
];

const RFP_SCORING_SHEET = 'RFPScoring';
const RFP_SCORING_HEADERS = ['ID', 'Phase', 'Firm', 'ScorerEmail', 'Score1', 'Score2', 'Score3', 'Score4', 'Score5', 'Score6', 'Notes', 'CreatedAt', 'UpdatedAt'];

async function ensureRfpFirmsSheet(sheets) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const exists = meta.data.sheets.some((s) => s.properties.title === RFP_FIRMS_SHEET);
  if (exists) return;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: { requests: [{ addSheet: { properties: { title: RFP_FIRMS_SHEET } } }] }
  });
  const rows = [RFP_FIRMS_HEADERS, ...RFP_FIRMS_SEED.map((firm) => [firm, 'FALSE'])];
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${RFP_FIRMS_SHEET}!A1:B${rows.length}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: rows }
  });
}

export async function listFirms() {
  const sheets = await getSheets();
  await ensureRfpFirmsSheet(sheets);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${RFP_FIRMS_SHEET}!A2:B`
  });
  const rows = res.data.values || [];
  return rows.filter((r) => r[0]).map((r) => ({ firm: r[0], interviewUnlocked: r[1] === 'TRUE' }));
}

export async function setFirmInterviewUnlocked(firm, unlocked) {
  const sheets = await getSheets();
  await ensureRfpFirmsSheet(sheets);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${RFP_FIRMS_SHEET}!A:A`
  });
  const rows = res.data.values || [];
  const rowNum = rows.findIndex((r) => r[0] === firm) + 1;
  if (rowNum < 2) throw new Error('Firm not found');
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${RFP_FIRMS_SHEET}!B${rowNum}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[unlocked ? 'TRUE' : 'FALSE']] }
  });
}

async function ensureRfpScoringSheet(sheets) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const exists = meta.data.sheets.some((s) => s.properties.title === RFP_SCORING_SHEET);
  if (exists) return;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: { requests: [{ addSheet: { properties: { title: RFP_SCORING_SHEET } } }] }
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${RFP_SCORING_SHEET}!A1:M1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [RFP_SCORING_HEADERS] }
  });
}

function rowToScore(row) {
  return {
    id: row[0] || '',
    phase: row[1] || '',
    firm: row[2] || '',
    scorerEmail: row[3] || '',
    scores: [row[4], row[5], row[6], row[7], row[8], row[9]].map((v) => (v === undefined || v === '' ? null : Number(v))),
    notes: row[10] || '',
    createdAt: row[11] || '',
    updatedAt: row[12] || ''
  };
}

export async function listScores(scorerEmail) {
  const sheets = await getSheets();
  await ensureRfpScoringSheet(sheets);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${RFP_SCORING_SHEET}!A2:M`
  });
  const rows = res.data.values || [];
  const all = rows.filter((r) => r[0]).map(rowToScore);
  return scorerEmail ? all.filter((s) => s.scorerEmail === scorerEmail) : all;
}

export async function submitScore({ phase, firm, scorerEmail, scores, notes }) {
  const sheets = await getSheets();
  await ensureRfpScoringSheet(sheets);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${RFP_SCORING_SHEET}!A:M`
  });
  const rows = res.data.values || [];
  const now = new Date().toISOString();
  const scoreValues = [0, 1, 2, 3, 4, 5].map((i) => (scores[i] === null || scores[i] === undefined ? '' : scores[i]));
  const existingIndex = rows.findIndex((r, i) => i > 0 && r[1] === phase && r[2] === firm && r[3] === scorerEmail);

  if (existingIndex === -1) {
    const row = [randomUUID(), phase, firm, scorerEmail, ...scoreValues, notes || '', now, now];
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${RFP_SCORING_SHEET}!A:M`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [row] }
    });
    return rowToScore(row);
  }

  const rowNum = existingIndex + 1;
  const createdAt = rows[existingIndex][11] || now;
  const row = [rows[existingIndex][0], phase, firm, scorerEmail, ...scoreValues, notes || '', createdAt, now];
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${RFP_SCORING_SHEET}!A${rowNum}:M${rowNum}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] }
  });
  return rowToScore(row);
}
