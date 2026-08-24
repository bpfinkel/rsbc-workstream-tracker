// Old URL, kept as a redirect since this repo has no file-delete tool access
// (see the "No file-delete capability" gotcha in project memory) — the page
// itself moved to pages/admin.js and now covers Tasks + Key Documents review.
export async function getServerSideProps() {
  return { redirect: { destination: '/admin', permanent: true } };
}

export default function DraftsRedirect() {
  return null;
}
