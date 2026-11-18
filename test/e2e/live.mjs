// Verifies the REAL deployed site (not a local build): every file reachable with the right type, engine files match the
// committed checksums, version matches, the app runs, caches itself and reopens offline. Usage:
//   ANNA_LIVE=https://tamanitadiwa-coder.github.io/Anna/ node test/e2e/live.mjs
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pw, reporter } from './lib.mjs';
const BASE = (process.env.ANNA_LIVE || 'https://tamanitadiwa-coder.github.io/Anna/').replace(/\/?$/, '/');
const R = reporter('live-site'), want = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url))).version;
const man = JSON.parse(readFileSync(new URL('../../vendor/manifest.json', import.meta.url)));
const get = async (p) => { try { const r = await fetch(BASE + p, { cache: 'no-store' }); return { ok: r.ok, status: r.status, type: r.headers.get('content-type') || '', buf: Buffer.from(await r.arrayBuffer()) }; } catch (e) { return { ok: false, status: String(e.cause?.code || e.message) }; } };
for (const [p, t] of [['', 'text/html'], ['index.html', 'text/html'], ['app.js', 'javascript'], ['ai.js', 'javascript'], ['logic.js', 'javascript'], ['sha256.js', 'javascript'], ['styles.css', 'text/css'], ['sw.js', 'javascript'], ['manifest.webmanifest', ''], ['icons/apple-touch-icon.png', 'image/png'], ['vendor/manifest.json', 'json']]) {
  const r = await get(p); R.ok(r.ok && r.type.includes(t), `GET /${p} → ${r.status} ${r.type || ''}`.trim());
}
const app = await get('app.js'); const live = (app.buf?.toString().match(/VERSION = '([^']+)'/) || [])[1]; R.ok(live === want, `live app version is ${want}`, 'live: ' + live);
for (const f of man.engine.files) { const r = await get(f); R.ok(r.ok && createHash('sha256').update(r.buf).digest('hex') === man.engine.sha256[f], `engine file ${f} matches committed checksum`, `${r.status} ${r.buf?.length ?? 0} bytes`); }
R.ok((await get('does-not-exist')).status === 404 && /Opening Anna/.test((await get('404.html')).buf?.toString() || ''), 'unknown paths get the 404 page that returns to the app');
if (live === want) {
  const b = await pw.chromium.launch(), ctx = await b.newContext({ ...(({ defaultBrowserType, ...d }) => d)(pw.devices['iPhone 15']), ...(process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY }, ignoreHTTPSErrors: true } : {}) });
  const page = await ctx.newPage(), errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(BASE); const ok = await page.waitForFunction(() => window.__anna, null, { timeout: 30000 }).then(() => true, () => false); R.ok(ok, 'live app starts in iPhone 15 emulation');
  if (ok) {
    for (const t of ['tasks', 'money', 'biz', 'brain', 'home']) await page.click(`#tabs [data-tab="${t}"]`);
    R.ok(true, 'all tabs open on the live site');
    await page.evaluate(() => navigator.serviceWorker.ready); await page.waitForFunction(async () => { const k = (await caches.keys()).find((x) => x.startsWith('anna-engine-')); return k && (await (await caches.open(k)).keys()).length === 4; }, null, { timeout: 120000, polling: 1000 }).then(() => R.ok(true, 'service worker cached the 4 AI engine files'), () => R.ok(false, 'service worker cached the 4 AI engine files'));
    await page.reload(); await page.waitForFunction(() => window.__anna); await ctx.setOffline(true); await page.reload().catch(() => {});
    R.ok(await page.waitForFunction(() => window.__anna, null, { timeout: 20000 }).then(() => true, () => false), 'live app reloads with the internet off');
    const d = await page.evaluate(() => window.__anna.runDiagnostics()); R.ok(/AI engine cache wllama/.test(d), 'diagnostics on the live site', d.split('\n').find((l) => l.startsWith('Offline app files')));
  }
  R.ok(!errs.length, 'no JavaScript errors on the live site', errs.join(' | ')); await b.close();
}
process.exit(R.finish({ base: BASE }) ? 0 : 1);
