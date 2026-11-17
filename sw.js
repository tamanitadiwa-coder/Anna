// ANNA WEB service worker. Bump VERSION with every release so phones pick up updates.
const VERSION = '0.1.0', CACHE = 'anna-web-' + VERSION;
const FILES = ['./', 'index.html', 'app.js', 'logic.js', 'styles.css', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('anna-web-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
// Network first (fresh when online), cache fallback (works offline). Never touches user data: that lives in IndexedDB.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
