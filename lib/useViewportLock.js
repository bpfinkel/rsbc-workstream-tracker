import { useEffect } from 'react';

const VIEWPORT_LOCKED = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no';
const VIEWPORT_UNLOCKED = 'width=device-width, initial-scale=1';

// Locks the viewport meta tag to block pinch-zoom on the main app UI, unlocking
// it while a modal (e.g. a PDF viewer) is open so the embedded content can be
// zoomed/panned normally. Pass a constant `false` on a page with no unlock case
// (e.g. My Account) to just keep the viewport locked. Shared by every page that
// was previously duplicating this same effect.
export function useModalViewportLock(unlocked) {
  useEffect(() => {
    const meta = document.querySelector('meta[name="viewport"]');
    if (!meta) return;
    meta.setAttribute('content', unlocked ? VIEWPORT_UNLOCKED : VIEWPORT_LOCKED);
    return () => { meta.setAttribute('content', VIEWPORT_LOCKED); };
  }, [unlocked]);
}
