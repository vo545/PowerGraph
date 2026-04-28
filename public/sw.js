// BUILD_ID is replaced with a timestamp by the Vite build plugin on every build.
// Changing this string causes the browser to detect a new SW and trigger an update.
const BUILD_ID = '__BUILD_ID__';
const CACHE = 'powergraph-' + BUILD_ID;

// ── Install: pre-cache the app shell ─────────────────────────────────────────
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(['/PowerGraph/', '/PowerGraph/index.html']))
      .catch(() => {}) // ignore if offline at install time
      .then(() => self.skipWaiting()) // activate immediately, don't wait for old tabs to close
  );
});

// ── Activate: clean up old caches, claim clients, notify if this is an update ─
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    const isUpdate = keys.some(k => k.startsWith('powergraph-') && k !== CACHE);
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
    if (isUpdate) {
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach(c => c.postMessage({ type: 'SW_UPDATED' }));
    }
  })());
});

// ── Fetch: cache strategy ─────────────────────────────────────────────────────
self.addEventListener('fetch', (e) => {
  // Only handle same-origin GET requests
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  // Hashed Vite assets (/assets/foo.HASH.js) → cache-first (they never change)
  if (/\/assets\//.test(url.pathname)) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
          return res;
        });
      })
    );
    return;
  }

  // HTML / root → network-first so we always get the latest index.html
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
