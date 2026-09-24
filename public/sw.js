/* Spot service worker: caches the app shell so the home-screen app opens fast and
   installs on Android. Live data (train APIs, map tiles) is never cached — always network. */
const CACHE = 'spot-v2';   /* v2: page moved to index.html (served at ./) */
const SHELL = [
  './', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png',
  'https://cdn.jsdelivr.net/npm/maplibre-gl@5.24.0/dist/maplibre-gl.js',
  'https://cdn.jsdelivr.net/npm/maplibre-gl@5.24.0/dist/maplibre-gl.css',
];

self.addEventListener('install', e => {
  /* one file at a time, and a file that fails (flaky mobile network, CDN hiccup) doesn't abort
     the install — in testing, addAll() of the whole list failed with a network error while
     caching the same files one by one worked */
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    for (const u of SHELL) { try { await c.add(u); } catch (err) { console.warn('sw: not cached', u, err); } }
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.origin === location.origin) {
    /* the page itself: network first (so updates show up), cached copy when offline */
    e.respondWith(fetch(e.request).then(r => {
      if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true })));
  } else if (url.hostname === 'cdn.jsdelivr.net') {
    /* versioned library files never change */
    e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request)));
  }
  /* everything else (transport.rest, Transitous, OpenFreeMap tiles) goes straight to the network */
});
