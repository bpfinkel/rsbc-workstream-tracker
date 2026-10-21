// Client-side cache for the portal's shared read-only API data (tasks, roster,
// meetings, key documents, public calendar). It lives in memory only, for the
// life of the tab: client-side navigation keeps it, a full reload or sign-out
// starts empty, and nothing is written to the browser's storage.
//
// Pages show whatever is cached at once and refresh it in the background, so
// moving between pages no longer starts from a blank "Loading…" each time,
// and a change made elsewhere still shows up a moment later. Home preloads the
// other pages' data (see pages/index.js), so the first visit to each is
// instant too.
//
// Only cache endpoints whose response is the same for every member. Per-user
// data (scores, interview notes) keeps fetching directly.

const store = new Map();
const inflight = new Map();

// A response this recent is served without a refetch, so a page opened right
// after Home preloaded its data doesn't immediately ask for it again.
const FRESH_MS = 10000;

function fetchJson(url) {
  if (inflight.has(url)) return inflight.get(url);
  const p = fetch(url)
    .then(async (res) => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      // A soft failure reported in the body (e.g. the committee website being
      // down) is cached like anything else: every page visit revalidates, so
      // it's replaced as soon as the source is back.
      store.set(url, { data, at: Date.now() });
      return data;
    })
    .finally(() => inflight.delete(url));
  inflight.set(url, p);
  return p;
}

export function getCached(url) {
  const hit = store.get(url);
  return hit ? hit.data : undefined;
}

// Fetches url, returning a recent cached copy when there is one. force skips
// the cache, for reloading right after the page itself changed the data.
export function loadJson(url, { force = false } = {}) {
  const hit = store.get(url);
  if (!force && hit && Date.now() - hit.at < FRESH_MS) return Promise.resolve(hit.data);
  return fetchJson(url);
}

// Stale-while-revalidate: calls onData with the cached copy straight away (if
// any), then again with fresh data once it arrives. A failed refresh is
// ignored when a cached copy was already shown, so the page keeps its data.
export function loadWithCache(url, onData) {
  const hit = store.get(url);
  if (hit) onData(hit.data);
  return loadJson(url).then(
    (data) => {
      if (!hit || data !== hit.data) onData(data);
      return data;
    },
    (err) => {
      if (hit) return hit.data;
      throw err;
    }
  );
}

// Warms the cache without anyone waiting on the result.
export function preload(urls) {
  urls.forEach((url) => loadJson(url).catch(() => {}));
}

export function clearCache() {
  store.clear();
}
