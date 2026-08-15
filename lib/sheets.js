import { google } from 'googleapis';
import { randomUUID } from 'crypto';

const SHEET_NAME = 'Tasks';
const SHEET_ID = process.env.GOOGLE_SHEET_ID;

export const STATUSES = ['Not Started', 'In Progress', 'Blocked', 'Done'];

export const MEMBERS = [
  { name: 'Stephan Pezdek', role: 'Chair', officer: true },
  { name: 'Luigi Ghilardi', role: 'Vice-Chair', officer: true },
  { name: 'Bryan Finkel', role: 'Secretary', officer: true },
  { name: 'Veronica Chiavaroli', role: 'BOE Representative', officer: false },
  { name: 'Ben Chynsky', role: 'Member', officer: false },
  { name: 'Louis Contadino', role: 'Member', officer: false },
  { name: 'Andy Duus', role: 'Member', officer: false },
  { name: 'Doug Fenton', role: 'BET Member', officer: false },
  { name: 'Christina Lyndon', role: 'Member', officer: false },
  { name: 'Julian De La Rosa', role: 'BOE Facilities', officer: false },
  { name: 'Christina Downey', role: 'RTM Representative', officer: false },
  { name: 'Nicholas Macri', role: 'P&Z Representative', officer: false },
  { name: 'Mary Dolan Collette', role: 'School Principal', officer: false },
  { name: 'Lauren Rabin', role: 'BOS Representative', officer: false },
  { name: 'Sheel Spina', role: 'DPW Representative', officer: false },
  { name: 'QA+M', role: 'Architect (external)', officer: false }
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
