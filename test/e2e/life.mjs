// Memory & journal phase: separate stores, journal privacy, remember-first, delete-all, goals, backup round trip.
import { mkdtempSync, rmSync, readFileSync } from 'node:fs'; import { tmpdir } from 'node:os'; import { join } from 'node:path';
import { pw, reporter, ready, TEST_PW } from './lib.mjs'; import { serve } from './serve.mjs';
const R = reporter('life'), dir = mkdtempSync(join(tmpdir(), 'anna-life-')); const { srv, url } = await serve(new URL('../../_site', import.meta.url).pathname, 0);
const { defaultBrowserType, ...dev } = pw.devices['iPhone 15'];
let ctx, page; const errors = [];
const open = async () => { ctx = await pw.chromium.launchPersistentContext(dir, { ...dev, deviceScaleFactor: 1, acceptDownloads: true }); page = ctx.pages()[0] || await ctx.newPage(); page.on('pageerror', (e) => errors.push(e.message)); page.on('dialog', (d) => d.accept()); await page.goto(url); await ready(page); };
const life = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__anna.life)));
const store = (name) => page.evaluate((n) => new Promise((res) => { const r = indexedDB.open('anna-life'); r.onsuccess = () => { const q = r.result.transaction(n).objectStore(n).getAll(); q.onsuccess = () => res(q.result); }; }), name);
const mainMem = () => page.evaluate(() => new Promise((res) => { const r = indexedDB.open('anna-web', 1); r.onsuccess = () => { const q = r.result.transaction('kv').objectStore('kv').get('state'); q.onsuccess = () => res((q.result?.mem || []).length); }; }));
const toastT = () => page.locator('#toast').innerText();
const brain = async (v) => { await page.click('#tabs [data-tab="brain"]'); await page.click(`[data-act="bview"][data-id="${v}"]`); };
const submit = () => page.click('#sheet form button:not([type=button])');
try {
  await open();
  R.ok(JSON.stringify(await page.evaluate(() => new Promise((res) => { const r = indexedDB.open('anna-life'); r.onsuccess = () => res([...r.result.objectStoreNames].sort()); }))) === JSON.stringify(['goals', 'journal', 'memories', 'preferences', 'profile', 'progress']), 'separate IndexedDB stores: profile, preferences, goals, journal, memories, progress');
  // ---- journal ----
  await brain('journal');
  await page.click('[data-act="open"][data-id="journal"]'); R.ok(/Private/.test(await page.locator('#sheet').innerText()), 'journal form says entries are private');
  await page.click('.moodopt:has-text("Good")'); await page.click('.moodopt:has-text("Achievement")');
  await page.fill('[name="title"]', 'Big day'); await page.fill('[name="text"]', 'Signed the BLUEFOLDER-JOURNAL contract with Thandi today. Proud of myself.'); await submit();
  await page.click('[data-act="open"][data-id="journal"]'); await page.click('.moodopt:has-text("Low")'); await page.click('.moodopt:has-text("Challenge")'); await page.click('.moodopt:has-text("Relationship")');
  await page.fill('[name="text"]', 'Hard conversation with Sipho about money. I want clearer boundaries.'); await submit();
  let L = await life(); R.ok(L.journal.length === 2 && L.journal.some((e) => e.mood === 4 && e.tags.includes('achievement') && e.title === 'Big day'), 'create journal entries with mood and tags');
  R.ok((await store('journal')).length === 2, 'journal persisted in its own store');
  await page.fill('#jq', 'sipho'); R.ok(await page.locator('#jlist .card').count() === 1 && /boundaries/.test(await page.locator('#jlist').innerText()), 'search journal'); await page.fill('#jq', '');
  await page.click('[data-act="jtag"][data-id="achievement"]'); R.ok(await page.locator('#jlist .card').count() === 1 && /BLUEFOLDER/.test(await page.locator('#jlist').innerText()), 'filter journal by tag'); await page.click('[data-act="jtag"][data-id="achievement"]');
  await page.click('#jlist .card:has-text("Sipho") [data-act="edit"]'); await page.fill('[name="text"]', 'Hard conversation with Sipho about money. I want clearer boundaries. Edited.'); await submit();
  L = await life(); R.ok(L.journal.some((e) => /Edited\./.test(e.text)) && L.journal.length === 2, 'edit journal entry (no duplicate)');
  // never leaks
  R.ok(!JSON.stringify(L.memories).includes('BLUEFOLDER') && !JSON.stringify(await store('memories')).includes('BLUEFOLDER'), 'journal text never copied into memories');
  const ctxTxt = await page.evaluate(() => window.__anna.buildCtx('What did I sign with Thandi? BLUEFOLDER contract'));
  R.ok(!/BLUEFOLDER|Sipho/.test(ctxTxt), 'journal never reaches the AI prompt (even when the question matches it)');
  await page.click('#jlist .card:has-text("Sipho") [data-act="edit"]'); await page.click('[data-act="ldel"]'); R.ok((await life()).journal.length === 1 && (await store('journal')).length === 1, 'delete journal entry');
  await page.click('#toastbtn'); await page.waitForTimeout(300); R.ok((await store('journal')).length === 2, 'undo journal delete');
  // ---- memories: remember-first, save/retrieve ----
  await page.click('#tabs [data-tab="home"]'); await page.click('.ask'); await page.evaluate(() => window.__anna.offer('My sister Lindiwe is a nurse in Durban'));
  R.ok(/Want me to remember this\?/.test(await page.locator('#chatmain').innerText()) && (await life()).memories.length === 0, 'ANNA asks "Want me to remember this?" and saves nothing yet');
  await page.click('[data-act="rem-no"]'); R.ok((await life()).memories.length === 0, '"No" saves nothing');
  await page.evaluate(() => window.__anna.offer('Remember that my sister Lindiwe is a nurse in Durban')); await page.click('[data-act="rem-yes"]'); await page.waitForTimeout(300);
  R.ok((await store('memories')).some((m) => /Lindiwe is a nurse/.test(m.content)) && (await mainMem()) === 0, '"Yes" saves to the memories store (not the main record)');
  await page.evaluate(() => window.__anna.offer('Please just listen, I need to vent')); R.ok(/prefer: .*Just listen/.test(await page.locator('#chatmain').innerText()), 'support style detected and offered'); await page.click('[data-act="rem-yes"]'); await page.waitForTimeout(200);
  R.ok((await store('preferences')).some((p) => p.id === 'style' && p.value === 'listen'), 'support style saved to preferences');
  await page.evaluate(() => window.__anna.offer('What time is it?')); R.ok(!/Want me to remember/.test(await page.locator('#chatmain').innerText()), 'questions are never offered for memory');
  await page.click('[data-act="close"]');
  await brain('mem'); await page.click('[data-act="open"][data-id="mem"]'); await page.fill('[name="content"]', 'Prefers rooibos tea'); await submit();
  const ctx2 = await page.evaluate(() => window.__anna.buildCtx('Should I have tea or coffee?')); R.ok(/rooibos/.test(ctx2) && /SUPPORT STYLE .*Just listen/.test(ctx2) && (ctx2.match(/^- /gm) || []).length <= 5, 'prompt gets only the few relevant memories plus style');
  // ---- goals ----
  await brain('goals'); await page.click('[data-act="open"][data-id="goal"]'); await page.fill('[name="title"]', 'Run'); await page.selectOption('[name="horizon"]', 'weekly'); await page.fill('[name="target"]', '3'); await page.fill('[name="unit"]', 'runs'); await submit();
  await page.click('[data-act="open"][data-id="goal"]'); await page.fill('[name="title"]', 'Read 10 pages'); await page.selectOption('[name="horizon"]', 'habit'); await submit();
  for (let i = 0; i < 2; i++) { await page.click('.card:has-text("Run") [data-act="glog"]'); await submit(); }
  await page.click('.card:has-text("Read 10") [data-act="glog"]'); await submit(); await page.waitForTimeout(300);
  { const mem = (await life()).progress, st = await store('progress'); R.note('progress mem=' + JSON.stringify(mem.map((p) => [p.id.slice(0, 6), p.goal && p.goal.slice(0, 6), p.value]))); R.note('progress store=' + JSON.stringify(st.map((p) => [p.id.slice(0, 6), p.goal && p.goal.slice(0, 6), p.value]))); }
  const gt = await page.locator('#screen').innerText(); R.ok(/2 of 3 runs/.test(gt) && /1-day streak/.test(gt), 'goal progress and habit streak from logs', gt.replace(/\s+/g, ' ').slice(0, 600));
  R.ok(/Run: 2 logged this week/.test(gt) && /1 achievement/.test(gt), 'weekly review built from real records');
  const ctx3 = await page.evaluate(() => window.__anna.buildCtx('How is my running going?')); R.ok(/goal \(weekly\): Run — 2 of 3 runs/.test(ctx3), 'relevant goal progress reaches the prompt', ctx3.split('\n').filter((l) => /goal/.test(l)).join(' | '));
  // ---- persistence ----
  const before = await life(); await ctx.close(); await open(); const after = await life();
  R.ok(JSON.stringify(after.journal.map((e) => e.id).sort()) === JSON.stringify(before.journal.map((e) => e.id).sort()) && after.memories.length === before.memories.length && after.goals.length === 2 && after.progress.length === 3, 'everything retrieved after closing and reopening', JSON.stringify({ b: [before.journal.length, before.memories.length, before.goals.length, before.progress.length], a: [after.journal.length, after.memories.length, after.goals.length, after.progress.length] }));
  // ---- check-in (once a day, not after journaling) ----
  await page.click('#tabs [data-tab="home"]'); R.ok(await page.locator('#checkin').count() === 0, 'no check-in after journaling today');
  // ---- backup round trip ----
  await page.click('.top [data-tab="data"]'); R.ok(/Journal entries\s*2/.test(await page.locator('.card:has-text("What ANNA keeps")').innerText()), 'Settings shows what ANNA keeps, per store');
  const d = page.waitForEvent('download'); await page.click('[data-act="export"]'); const f = await (await d).path(); const env = JSON.parse(readFileSync(f, 'utf8'));
  R.ok(env.encrypted === 1 && !readFileSync(f, 'utf8').includes('BLUEFOLDER') && !readFileSync(f, 'utf8').includes('Lindiwe'), 'backup file is encrypted (no readable journal or memories)');
  await page.click('[data-act="erase"]'); await page.waitForFunction(() => window.__anna.life.journal.length === 0 && window.__anna.S.tasks.length === 0, null, { timeout: 8000 }).catch(() => {});
  R.ok((await store('journal')).length === 0 && (await store('memories')).length === 0 && (await store('goals')).length === 0, 'erase clears the personal stores too');
  await page.click('.top [data-tab="data"]'); await page.setInputFiles('#file', f); await page.fill('form[data-form="restorepw"] [name="pw"]', TEST_PW); await page.click('form[data-form="restorepw"] button'); await page.waitForSelector('[data-act="restore-confirm"]'); await page.click('[data-act="restore-confirm"]'); await page.waitForTimeout(600);
  R.ok(/Restored and verified/.test(await toastT()), 'restore verified', await toastT());
  const rest = await life(); const norm = (l) => JSON.stringify(['journal', 'memories', 'goals', 'progress'].map((k) => [...l[k]].sort((a, b) => a.id.localeCompare(b.id))));
  R.ok(norm(rest) === norm(before) && rest.preferences.some((p) => p.id === 'style'), 'export → import round trip restores journal, memories, goals, progress and preferences exactly');
  R.ok((await store('journal')).length === 2 && (await store('progress')).length === 3, 'restored data written back to the stores');
  // ---- delete-all ----
  await brain('mem'); await page.click('[data-act="mem-clear"]'); await page.waitForTimeout(300);
  R.ok((await life()).memories.length === 0 && (await store('memories')).length === 0, 'Delete all memories empties the store'); R.ok(/Nothing remembered yet/.test(await page.locator('#memlist').innerText()), 'memories screen shows it is empty');
  await page.click('.top [data-tab="data"]'); await page.click('[data-act="store-clear"][data-id="journal"]'); await page.waitForTimeout(300); R.ok((await store('journal')).length === 0, 'Delete all journal entries (Settings)');
  await page.click('[data-act="store-clear"][data-id="goals"]'); await page.waitForTimeout(300); R.ok((await store('goals')).length === 0 && (await store('progress')).length === 0, 'Delete all goals also removes their progress');
  R.ok(!errors.length, 'no JavaScript errors', errors.join(' | '));
} catch (e) { R.ok(false, 'unexpected error', e.stack); }
try { await ctx.close(); } catch {} srv.close(); rmSync(dir, { recursive: true, force: true });
process.exit(R.finish() ? 0 : 1);
