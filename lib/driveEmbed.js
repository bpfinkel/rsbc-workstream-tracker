// Drive files embed directly via /preview — accepts either the /file/d/<id>/view
// share-link shape or the older ?id=<id> download-link shape, so it works
// regardless of which format a given DriveLink was saved with. Shared by
// pages/admin.js and pages/key-documents.js (previously duplicated in both).
export function driveEmbedUrl(url) {
  const match = String(url || '').match(/\/d\/([^/]+)/) || String(url || '').match(/[?&]id=([^&]+)/);
  const id = match ? match[1] : null;
  return id ? `https://drive.google.com/file/d/${id}/preview` : url;
}
