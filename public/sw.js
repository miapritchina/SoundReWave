// Minimal service worker for SoundReWave — makes the app an installable,
// offline-capable PWA without pulling in a build-time plugin.
//
// Strategy:
//  - Navigations: network-first, fall back to the cached app shell offline.
//  - Same-origin GET assets: stale-while-revalidate (fast, self-healing).
// Cross-origin (Google Fonts, etc.) is left to the browser.
const CACHE = 'srw-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  // Warm the shell so a first offline load still boots.
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll([self.registration.scope]).catch(() => {}))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // don't touch cross-origin

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() =>
          caches.match(req).then((hit) => hit || caches.match(self.registration.scope))
        )
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((hit) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => hit);
      return hit || network;
    })
  );
});
