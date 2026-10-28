import { drive as driveApi, auth as googleAuth } from '@googleapis/drive';

// External Presentations: whatever sits in the Drive folder RSBC/Presentations/
// External, read live. Filing a final deck there is the only upkeep. The
// service account (GOOGLE_SERVICE_ACCOUNT_EMAIL) needs Viewer access to the
// folder, and the Google Drive API must be enabled on its Cloud project.
export const PRESENTATIONS_FOLDER_ID = '1dpb-gWQwBT_SPrOqY92fk5PvPIbYpbvB';
export const PRESENTATIONS_FOLDER_URL = `https://drive.google.com/drive/folders/${PRESENTATIONS_FOLDER_ID}`;

// The body a deck was given to, recognized from its file name. Checked in
// order; the first match wins.
const AUDIENCES = [
  { key: 'BOE', pattern: /\bBOE\b|Board of Education/i },
  { key: 'BET', pattern: /\bBET\b|Board of Estimate/i },
  { key: 'RTM', pattern: /\bRTM\b|Representative Town Meeting/i },
  { key: 'P&Z', pattern: /P\s*&\s*Z|Planning (and|&) Zoning/i },
  { key: 'Selectmen', pattern: /\bBOS\b|Selectmen/i },
  { key: 'Community', pattern: /Community|Public Forum|Parent|PTA/i }
];

const SLIDES_MIME = [
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint',
  'application/vnd.google-apps.presentation'
];

let client;

function getDrive() {
  if (!client) {
    const auth = new googleAuth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n')
      },
      scopes: ['https://www.googleapis.com/auth/drive.readonly']
    });
    client = driveApi({ version: 'v3', auth });
  }
  return client;
}

// "2026-11-05 RSBC - BOE Presentation.pdf" → date, source and title, following
// the Drive filing convention ("YYYY-MM-DD Source - Description.ext").
export function parseDeckName(name) {
  const base = String(name).replace(/\.(pdf|pptx?|key)$/i, '');
  const m = base.match(/^(\d{4}-\d{2}-\d{2})\s+(.+?)\s+-\s+(.+)$/);
  const date = m ? m[1] : '';
  const source = m ? m[2] : '';
  const title = m ? m[3] : base;
  const audience = (AUDIENCES.find((a) => a.pattern.test(title)) || { key: 'Other' }).key;
  return { base, date, source, title, audience };
}

async function listFolder() {
  const drive = getDrive();
  const files = [];
  let pageToken;
  do {
    const res = await drive.files.list({
      q: `'${PRESENTATIONS_FOLDER_ID}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType, modifiedTime, webViewLink)',
      pageSize: 200,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    });
    files.push(...(res.data.files || []));
    pageToken = res.data.nextPageToken;
  } while (pageToken);
  return files;
}

// One entry per deck: the PDF (or the slides file, if there's no PDF) to
// view, plus the editable slides file, when saved alongside, to download.
export async function listPresentations() {
  const files = (await listFolder()).filter((f) => f.mimeType !== 'application/vnd.google-apps.folder');
  const decks = new Map();
  for (const f of files) {
    const meta = parseDeckName(f.name);
    const deck = decks.get(meta.base) || { ...meta, id: f.id, view: null, slides: null, modifiedTime: f.modifiedTime };
    const entry = { id: f.id, name: f.name, link: f.webViewLink, mimeType: f.mimeType };
    if (f.mimeType === 'application/pdf') deck.view = entry;
    else if (SLIDES_MIME.includes(f.mimeType)) deck.slides = entry;
    else if (!deck.view) deck.view = entry;
    if (f.modifiedTime > deck.modifiedTime) deck.modifiedTime = f.modifiedTime;
    decks.set(meta.base, deck);
  }
  return Array.from(decks.values())
    .map((d) => ({ ...d, id: (d.view || d.slides).id, view: d.view || d.slides }))
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || a.title.localeCompare(b.title));
}
