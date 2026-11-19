// ANNA WEB service worker. Bump VERSION with every release (package.json, app.js and sw.js must match: the build checks).
// - App files: precached on install; network first when online (fresh), cache when offline.
// - AI engine (vendor/webllm, ~7 MB): precached into its own cache named by engine version, so app updates do not re-download it.
// - The model (~290 MB) and its compiled library are cached by WebLLM in Cache Storage (cross-origin URLs, never touched here); user data lives in IndexedDB.
const VERSION = '1.5.0', APP = 'anna-web-' + VERSION;
const FILES = ['./', 'index.html', 'app.js', 'logic.js', 'ai.js', 'auth.js', 'life.js', 'time.js', 'money.js', 'router.js', 'online.js', 'lookup.js', 'lib/big.mjs', 'styles.css', 'fonts/jost.woff2', 'manifest.webmanifest', 'vendor/manifest.json', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];
async function cacheEngine() {
  const m = await (await fetch('vendor/manifest.json', { cache: 'no-cache' })).json(), name = 'anna-engine-' + m.engine.version, c = await caches.open(name);
  for (const f of m.engine.files) if (!(await c.match(f))) { const r = await fetch(f, { cache: 'no-cache' }); if (!r.ok) throw new Error(f + ' ' + r.status); await c.put(f, r); }
  for (const k of await caches.keys()) if (k.startsWith('anna-engine-') && k !== name) await caches.delete(k);
  return name;
}
self.addEventListener('install', (e) => { e.waitUntil(caches.open(APP).then((c) => c.addAll(FILES)).then(() => cacheEngine().catch(() => {})).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('anna-web-') && k !== APP).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('message', (e) => { if (e.data === 'cache-engine') e.waitUntil(cacheEngine().then((n) => e.source?.postMessage({ engineCached: n }), (err) => e.source?.postMessage({ engineError: String(err) }))); });
const timeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  if (u.pathname.includes('/vendor/') && !u.pathname.endsWith('manifest.json')) {
    e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((h) => h || fetch(e.request)));
    return;
  }
  e.respondWith(timeout(fetch(e.request), 6000).then((r) => { if (r.ok && r.status === 200) { const copy = r.clone(); caches.open(APP).then((c) => c.put(e.request, copy)).catch(() => {}); } return r; })
    .catch(async () => (await caches.match(e.request, { ignoreSearch: true })) || (e.request.mode === 'navigate' ? caches.match('index.html') : Response.error())));
});
// Reminder notifications are shown by the page through registration.showNotification; tapping one opens Anna.
self.addEventListener('notificationclick', (e) => { e.notification.close(); e.waitUntil(self.clients.matchAll({ type: 'window' }).then((cs) => (cs[0] ? cs[0].focus() : self.clients.openWindow('./')))); });
