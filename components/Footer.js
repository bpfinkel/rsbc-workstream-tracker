import { RSBC_SOURCE_URL } from '../lib/rsbcSchedule';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <span>Riverside School Building Committee</span>
        <span className="site-footer-div" aria-hidden="true">·</span>
        <a href={RSBC_SOURCE_URL} target="_blank" rel="noreferrer">Official committee page</a>
        <span className="site-footer-div" aria-hidden="true">·</span>
        {/* The year is baked into the static page at deploy time; after New
            Year it differs from the visitor's until the next deploy, which is
            harmless, so React is told not to report it. */}
        <span suppressHydrationWarning>&copy; {new Date().getFullYear()} Riverside School Building Committee</span>
      </div>
    </footer>
  );
}
