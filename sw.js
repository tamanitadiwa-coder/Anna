// ANNA WEB service worker. Bump VERSION with every release so phones pick up updates.
const VERSION = '0.3.0', CACHE = 'anna-web-' + VERSION;
const FILES = ['./', 'index.html', 'app.js', 'logic.js', 'ai.js', 'styles.css', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('anna-web-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
// App files: network first (fresh when online), cache fallback (offline). Engine files in /vendor/ are big and versioned: cache first.
// Model downloads go to huggingface.co (other origin): never touched here. User data lives in IndexedDB and OPFS, never in these caches.
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  const keep = (r) => { if (r.ok && r.status === 200) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {}); } return r; };
  const vendor = u.pathname.includes('/vendor/') && !u.pathname.endsWith('manifest.json');
  e.respondWith(vendor ? caches.match(e.request).then((h) => h || fetch(e.request).then(keep)) : fetch(e.request).then(keep).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
