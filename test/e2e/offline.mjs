// Offline + data safety (v1.0 final check): data in every store survives closing the app and an app update; then with the
// network off the app opens and every non-research feature works; research says it needs internet; backup round trip.
import { mkdtempSync, rmSync, cpSync, readFileSync, writeFileSync } from 'node:fs'; import { tmpdir } from 'node:os'; import { join } from 'node:path';
import { pw, reporter, ready, TEST_PW } from './lib.mjs'; import { serve } from './serve.mjs';
const R = reporter('offline'), dir = mkdtempSync(join(tmpdir(), 'anna-off-')), site = mkdtempSync(join(tmpdir(), 'anna-site-'));
cpSync(new URL('../../_site', import.meta.url).pathname, site, { recursive: true });
const { srv, url } = await serve(site, 0);
const { defaultBrowserType, ...dev } = pw.devices['iPhone 15'];
let ctx, page; const errors = [];
const open = async (offline) => { ctx = await pw.chromium.launchPersistentContext(dir, { ...dev, deviceScaleFactor: 1, timezoneId: 'Africa/Johannesburg', acceptDownloads: true }); if (offline) await ctx.setOffline(true); page = ctx.pages()[0] || await ctx.newPage(); page.on('pageerror', (e) => errors.push(e.message)); page.on('dialog', (d) => d.accept()); await page.goto(url).catch(() => {}); return ready(page, 20000).then(() => true, () => false); };
const STORES = ['profile', 'preferences', 'goals', 'journal', 'memories', 'progress', 'finance', 'staff'];
const counts = () => page.evaluate((st) => new Promise((res) => { const r = indexedDB.open('anna-life'); r.onsuccess = () => { const t = r.result.transaction(st), out = {}; let n = st.length; for (const s of st) { const q = t.objectStore(s).count(); q.onsuccess = () => { out[s] = q.result; if (!--n) res(out); }; } }; }), STORES);
const kv = () => page.evaluate(() => ({ tx: window.__anna.S.tx.length, reminders: window.__anna.S.reminders.length, bills: window.__anna.S.bills.length }));
const last = () => page.evaluate(() => window.__anna.S.chat.at(-1).content);
const say = async (t) => { await page.fill('.chatin textarea', t); await page.click('#send'); await page.waitForTimeout(300); return last(); };
const submit = () => page.click('#sheet form button:not([type=button])');
const close = async () => { await page.evaluate(() => document.querySelector('[data-act="close"]')?.click()); await page.waitForTimeout(250); };
try {
  R.ok(await open(false), 'first visit online');
  // data in every store, entered the normal way where there is a screen for it
  await page.click('.ask');
  await say('Remind me to call Mom tomorrow at 3pm'); await page.click('[data-act="rq-save"]'); await page.waitForTimeout(300);
  await say('spent R200 on food'); await page.click('[data-act="ent-save"]'); await page.waitForTimeout(400);
  await say('Rent R5000'); await page.click('[data-act="ent-save"]'); await page.waitForTimeout(400); await close();
  await page.click('#tabs [data-tab="brain"]'); await page.click('[data-act="bview"][data-id="journal"]'); await page.click('[data-act="open"][data-id="journal"]'); await page.click('.moodopt:has-text("Good")'); await page.fill('[name="text"]', 'A good day'); await submit(); await page.waitForTimeout(200);
  await page.click('[data-act="bview"][data-id="mem"]').catch(() => {}); await page.click('[data-act="open"][data-id="mem"]'); await page.fill('[name="content"]', 'My sister is called Naledi'); await submit(); await page.waitForTimeout(200);
  await page.click('#tabs [data-tab="biz"]'); await page.click('[data-act="bizview"][data-id="staff"]'); await page.click('[data-act="open"][data-id="person"]'); await page.fill('[name="name"]', 'Thandi'); await page.fill('[name="rate"]', '40'); await submit(); await page.waitForTimeout(200);
  await page.evaluate(() => new Promise((res) => { const r = indexedDB.open('anna-life'); r.onsuccess = () => { const t = r.result.transaction(['profile', 'goals', 'progress', 'preferences'], 'readwrite'); t.objectStore('profile').put({ id: 'me', name: 'Jamal' }); t.objectStore('goals').put({ id: 'g1', title: 'Walk 30 minutes', horizon: 'daily', created_at: Date.now() }); t.objectStore('progress').put({ id: 'p1', goal: 'g1', amount: 1, at: Date.now() }); t.objectStore('preferences').put({ id: 'style', value: 'listen', at: Date.now() }); t.oncomplete = res; }; }));
  const c0 = await counts(), k0 = await kv();
  R.ok(STORES.every((s) => c0[s] > 0) && k0.tx === 1 && k0.reminders === 1 && k0.bills === 1, 'data in all 8 stores plus reminders, money and bills', JSON.stringify({ ...c0, ...k0 }));
  await page.evaluate(() => navigator.serviceWorker.ready); await ctx.close();
  // close + reopen
  await open(false); R.ok(JSON.stringify(await counts()) === JSON.stringify(c0) && JSON.stringify(await kv()) === JSON.stringify(k0), 'everything survives closing the app');
  await page.evaluate(() => navigator.serviceWorker.ready); await ctx.close();
  // an app update (new version on the server)
  for (const f of ['app.js', 'sw.js']) writeFileSync(join(site, f), readFileSync(join(site, f), 'utf8').replace(/VERSION = '[\d.]+'/, "VERSION = '9.9.9'"));
  await open(false); await page.evaluate(() => navigator.serviceWorker.ready); await page.waitForTimeout(1500); await page.reload(); await ready(page);
  R.ok(await page.evaluate(() => window.__anna.VERSION) === '9.9.9', 'update installed (new version running)');
  R.ok(JSON.stringify(await counts()) === JSON.stringify(c0) && JSON.stringify(await kv()) === JSON.stringify(k0), 'everything survives the update');
  await page.evaluate(() => navigator.serviceWorker.ready); await page.waitForTimeout(1500); await ctx.close();
  // network off
  R.ok(await open(true), 'app opens with the network off (service worker cache)');
  R.ok(await page.evaluate(() => window.__anna.VERSION) === '9.9.9' && !(await page.evaluate(() => navigator.onLine)), 'offline, updated version');
  for (const t of ['home', 'money', 'biz', 'brain', 'data']) { await page.click(`#tabs [data-tab="${t}"], .top [data-tab="${t}"]`); await page.waitForTimeout(150); }
  R.ok(!errors.length, 'every section opens offline', errors.join(' | '));
  await page.click('#tabs [data-tab="home"]'); await page.click('.ask');
  let r = await say('What time is it?'); R.ok(/^It’s \d\d:\d\d/.test(r), 'clock offline', r);
  r = await say('12 x 4'); R.ok(/^48/.test(r), 'calculator offline', r);
  r = await say('Remind me to buy bread tomorrow at 9am'); await page.click('[data-act="rq-save"]'); await page.waitForTimeout(300); R.ok((await kv()).reminders === 2, 'reminders offline');
  r = await say('got R500 extra'); await page.click('[data-act="ent-save"]'); await page.waitForTimeout(400); R.ok((await kv()).tx === 2 && /^Saved/.test(await last()), 'money entries offline');
  r = await say('Can I afford R100?'); R.ok(/^(BUY|WAIT|REDUCE|AVOID)/.test(r), 'affordability offline', r.split('\n')[0]);
  r = await say('What must I pay first?'); R.ok(/Rent/.test(r), 'bill priorities offline');
  r = await say('What did I tell you about my sister?'); R.ok(/Naledi/.test(r), 'memory offline');
  r = await say('How did I feel this week?'); R.ok(/mood/i.test(r), 'journal mood summary offline');
  r = await say('How many hours did staff work this week?'); R.ok(/Thandi/.test(r), 'timesheets offline');
  r = await say('books day'); await page.waitForTimeout(200); R.ok(/income/i.test(await last()), 'Books Day offline'); await say('stop');
  r = await say('What is the latest news?'); R.ok(/needs internet/.test(r), 'research: says it needs internet, nothing faked', r);
  await close(); await page.click('#tabs [data-tab="money"]'); await page.click('[data-act="mmore"]'); await page.click('[data-act="open"][data-id="mbudget"]'); R.ok(/Remaining/.test(await page.locator('#bres').innerText()), 'monthly calculator offline'); await close();
  await page.click('#tabs [data-tab="brain"]'); await page.click('[data-act="bview"][data-id="journal"]'); await page.click('[data-act="open"][data-id="journal"]'); await page.fill('[name="text"]', 'Offline entry'); await submit(); await page.waitForTimeout(200);
  R.ok((await counts()).journal === 2, 'journal offline');
  // backup round trip (offline too)
  const c1 = await counts(), k1 = await kv();
  await page.click('.top [data-tab="data"]'); const d = page.waitForEvent('download'); await page.click('[data-act="export"]'); const f = await (await d).path();
  R.ok(JSON.parse(readFileSync(f, 'utf8')).encrypted === 1, 'backup exported (encrypted)');
  await page.click('[data-act="erase"]'); await page.waitForTimeout(800); if (await page.evaluate(() => window.__anna.locked)) await ready(page);
  const c2 = await counts(); R.ok(STORES.filter((s) => s !== 'profile').every((s) => c2[s] === 0 || s === 'preferences'), 'erase empties the stores', JSON.stringify(c2));
  await page.click('.top [data-tab="data"]'); await page.setInputFiles('#file', f); await page.fill('form[data-form="restorepw"] [name="pw"]', TEST_PW); await page.click('form[data-form="restorepw"] button'); await page.waitForSelector('[data-act="restore-confirm"]'); await page.click('[data-act="restore-confirm"]'); await page.waitForTimeout(800);
  R.ok(JSON.stringify(await counts()) === JSON.stringify(c1) && JSON.stringify(await kv()) === JSON.stringify(k1), 'import restores every store, reminders, money and bills', JSON.stringify([await counts(), c1, await kv(), k1]));
  R.ok(!errors.length, 'no JavaScript errors', errors.join(' | '));
} catch (e) { R.ok(false, 'unexpected error', e.stack); }
try { await ctx.close(); } catch {} srv.close(); rmSync(dir, { recursive: true, force: true }); rmSync(site, { recursive: true, force: true }); process.exit(R.finish() ? 0 : 1);
