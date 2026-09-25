import { RSBC_SOURCE_URL } from '../lib/rsbcSchedule';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <span>Riverside School Building Committee</span>
        <span className="site-footer-div" aria-hidden="true">·</span>
        <a href={RSBC_SOURCE_URL} target="_blank" rel="noreferrer">Official committee page</a>
        <span className="site-footer-div" aria-hidden="true">·</span>
        <span>&copy; {new Date().getFullYear()} Riverside School Building Committee</span>
      </div>
    </footer>
  );
}
