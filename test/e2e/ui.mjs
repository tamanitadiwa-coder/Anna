// Full UI test of every screen and control, through the real interface, in a persistent browser profile.
// Usage: node test/e2e/ui.mjs [--device "iPhone 15"|desktop]   (Chromium; device emulation is layout only, not a real iPhone)
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os'; import { join } from 'node:path';
import { pw, reporter } from './lib.mjs';
import { serve } from './serve.mjs';
const devName = process.argv.includes('desktop') ? 'desktop' : 'iPhone 15';
const R = reporter('ui-' + devName.replace(/\s/g, '-').toLowerCase());
const SITE = new URL('../../_site', import.meta.url).pathname, dir = mkdtempSync(join(tmpdir(), 'anna-ui-'));
let { srv, url } = await serve(SITE, 0);
const DEV = devName === 'desktop' ? { viewport: { width: 1280, height: 860 } } : (({ defaultBrowserType, ...d }) => d)(pw.devices['iPhone 15']);
const errors = [];
let dialogs = [];
async function open() {
  const ctx = await pw.chromium.launchPersistentContext(dir, { ...DEV, deviceScaleFactor: 1, acceptDownloads: true });
  const page = ctx.pages()[0] || await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => m.type() === 'error' && !/favicon|ERR_INTERNET_DISCONNECTED|Failed to load resource/.test(m.text()) && errors.push(m.text()));
  page.on('dialog', (d) => { dialogs.push(d.message()); d.accept(); });
  return { ctx, page };
}
let { ctx, page } = await open();
const S = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__anna.S)));
const tabTo = async (t) => { await page.click(`#tabs [data-tab="${t}"]`); await page.waitForTimeout(150); };
const fill = async (pairs) => { for (const [n, v] of Object.entries(pairs)) { const el = page.locator(`#sheet form [name="${n}"]`); const tag = await el.evaluate((e) => e.tagName + (e.type || '')); if (tag.startsWith('SELECT')) await el.selectOption(v); else if (tag === 'INPUTcheckbox') await el.setChecked(!!v); else await el.fill(String(v)); } };
const submit = () => page.click('#sheet form button:not([type=button])');
const toastText = () => page.locator('#toast').innerText();
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const tomorrow = () => { const d = new Date(Date.now() + 864e5); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
async function layoutOk(name) {
  const r = await page.evaluate(() => {
    const W = innerWidth, over = document.documentElement.scrollWidth > W + 1, small = [], overlap = [];
    for (const b of document.querySelectorAll('#screen button, #tabs button, #sheet button')) { const r = b.getBoundingClientRect(); if (!r.width || getComputedStyle(b).visibility === 'hidden' || b.closest('details:not([open])')) continue; if ((r.height < 40 || r.width < 40) && !b.classList.contains('link') && !b.closest('.chips')) small.push((b.getAttribute('aria-label') || b.textContent).trim().slice(0, 30) + ` ${Math.round(r.width)}x${Math.round(r.height)}`); }
    for (const s of document.querySelectorAll('.swrow')) { const sw = s.querySelector('.sw').getBoundingClientRect(), t = s.querySelector('.grow').getBoundingClientRect(); if (sw.width && t.right > sw.left + 1) overlap.push(s.textContent.trim().slice(0, 30)); }
    return { over, sw: document.documentElement.scrollWidth, W, small, overlap };
  });
  R.ok(!r.over, `${name}: no horizontal overflow`, `${r.sw} vs ${r.W}`);
  R.ok(!r.small.length, `${name}: all buttons are at least 40×40 px touch targets`, r.small.join('; '));
  if (r.overlap.length) R.ok(false, `${name}: switch labels do not overlap switches`, r.overlap.join('; '));
}
try {
  await page.goto(url); await page.waitForFunction(() => window.__anna, null, { timeout: 20000 });
  // ---------- first run ----------
  R.ok(await page.locator('#tabs button').count() === 5, 'five main tabs render');
  R.ok((await page.locator('.hero .big').innerText()).replace(/\s/g, ' ') === 'R 0,00', 'ZAR is the default currency (R 0,00)');
  R.ok(/rgb\((1[0-9]|[0-9]), (1[0-9]|[0-9]), (1[0-9]|[0-9])\)/.test(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)), 'black theme background');
  for (const t of ['home', 'tasks', 'money', 'biz', 'brain']) { await tabTo(t); R.ok(await page.locator('#screen h1').count() === 1, `tab "${t}" renders`); await layoutOk(`tab ${t}`); }
  await page.click('.top [data-tab="data"]'); R.ok(/Data & settings/.test(await page.locator('h1').innerText()), 'Settings opens from the gear button'); await layoutOk('settings');
  // ---------- tasks ----------
  await tabTo('tasks'); await page.click('[data-act="open"][data-id="task"]'); await layoutOk('new-task sheet');
  await submit(); R.ok(/Please fill in/.test(await toastText()), 'empty task is rejected with a clear message');
  await fill({ title: 'Submit VAT return', due: today(), priority: 'high', notes: 'eFiling' }); await submit();
  let s = await S(); R.ok(s.tasks.length === 1 && s.tasks[0].title === 'Submit VAT return' && s.tasks[0].notes === 'eFiling', 'create task');
  R.ok(await page.locator('.tcard', { hasText: 'Submit VAT return' }).count() === 1, 'task shows in Today');
  await page.click('.tcard .grow >> text=Submit VAT return'); R.ok(await page.inputValue('#sheet [name="title"]') === 'Submit VAT return', 'edit sheet is pre-filled');
  await fill({ title: 'Submit VAT201 return' }); await submit(); s = await S(); R.ok(s.tasks[0].title === 'Submit VAT201 return' && s.tasks.length === 1, 'edit task (no duplicate)');
  await page.click('.tcard [data-act="toggle"]'); s = await S(); R.ok(s.tasks[0].completed === 1, 'complete task');
  await page.click('[data-act="view"][data-id="done"]'); R.ok(await page.locator('.tcard .done').count() === 1, 'completed task listed under Done');
  await page.click('.tcard [data-act="toggle"]'); s = await S(); R.ok(s.tasks[0].completed === 0, 'un-complete task');
  await page.click('[data-act="view"][data-id="today"]'); await page.click('.tcard [data-act="del"]'); s = await S(); R.ok(s.tasks.length === 0, 'delete task');
  await page.click('#toastbtn'); s = await S(); R.ok(s.tasks.length === 1, 'Undo restores the deleted task');
  await page.click('[data-act="open"][data-id="task"]'); await fill({ title: 'Book car service', due: tomorrow() }); await submit();
  await page.click('[data-act="view"][data-id="upcoming"]'); R.ok(await page.locator('.tcard', { hasText: 'Book car service' }).count() === 1, 'future task shows under Later');
  // ---------- reminders ----------
  await page.click('[data-act="view"][data-id="reminders"]'); await page.click('[data-act="open"][data-id="reminder"]'); await layoutOk('reminder sheet');
  await fill({ title: 'Pay domestic worker', day: tomorrow(), time: '09:30', repeat: 'weekly' }); await submit();
  s = await S(); const rem = s.reminders[0]; R.ok(rem && new Date(rem.at).getHours() === 9 && new Date(rem.at).getMinutes() === 30 && rem.repeat === 'weekly', 'create reminder with date, time and repeat');
  R.ok(/Reminder set/.test(await toastText()), 'reminder confirmation shown');
  await page.click('.tcard .grow >> text=Pay domestic worker'); await fill({ title: 'Pay domestic worker (Thandi)', time: '10:00' }); await submit();
  s = await S(); R.ok(s.reminders[0].title.includes('Thandi') && new Date(s.reminders[0].at).getHours() === 10, 'edit reminder');
  await page.click('[data-act="open"][data-id="reminder"]'); await fill({ title: 'Past', day: '2020-01-01', time: '08:00' }); await submit();
  R.ok(/already passed/.test(await toastText()), 'reminder in the past is refused'); await page.click('#sheet [data-act="close"] >> nth=-1');
  const dl = page.waitForEvent('download', { timeout: 5000 }).catch(() => null); await page.click('[data-act="rem-ics"]'); const ics = await dl;
  const icsText = ics ? readFileSync(await ics.path(), 'utf8') : ''; R.ok(/BEGIN:VEVENT[\s\S]*RRULE:FREQ=WEEKLY[\s\S]*BEGIN:VALARM/.test(icsText), 'Add-to-Calendar exports a valid .ics with alarm and repeat', ics?.suggestedFilename());
  // alert while open: make it due now and run the checker
  await page.evaluate(() => { const r = window.__anna.S.reminders[0]; r.at = Date.now() - 1000; r.notified = 0; }); await page.evaluate(() => window.__anna.checkReminders()); await page.waitForTimeout(200);
  R.ok(/⏰ Pay domestic worker/.test(await toastText()), 'due reminder raises an in-app alert while Anna is open');
  s = await S(); R.ok(s.reminders[0].notified === 1, 'reminder is alerted only once');
  await page.click('#toastbtn'); s = await S(); R.ok(!s.reminders[0].done && s.reminders[0].at > Date.now(), '"Done" on a weekly reminder schedules the next one');
  await page.click('[data-act="open"][data-id="reminder"]'); await fill({ title: 'Call Mom', day: tomorrow(), time: '18:00' }); await submit();
  await page.click('.tcard:has-text("Call Mom") [data-act="rem-done"]'); s = await S(); R.ok(s.reminders.find((r) => r.title === 'Call Mom').done === 1, 'mark one-off reminder complete');
  R.ok(await page.locator('h2', { hasText: 'Completed reminders' }).count() === 1, 'completed reminders listed');
  await page.click('.tcard:has-text("Call Mom") [data-act="del"]'); s = await S(); R.ok(!s.reminders.some((r) => r.title === 'Call Mom'), 'delete reminder');
  await tabTo('home'); R.ok(await page.locator('.tcard', { hasText: 'Thandi' }).count() === 1, 'Home shows upcoming reminders');
  // ---------- money ----------
  await tabTo('money');
  await page.click('[data-act="open"][data-id="tx"]'); await fill({ kind: 'expense', amount: 'abc', category: 'Groceries' }); await submit(); R.ok(/Enter an amount/.test(await toastText()), 'invalid amount rejected');
  await fill({ amount: '1 250,50', note: 'Checkers' }); await submit();
  await page.click('[data-act="open"][data-id="tx"]'); await fill({ kind: 'income', amount: '18000', category: 'Salary' }); await submit();
  s = await S(); R.ok(s.tx.length === 2 && s.tx[0].amount_cents === 125050, 'record expense (comma decimal) and income');
  R.ok((await page.locator('.hero .big').innerText()).replace(/\s/g, ' ') === 'R 16 749,50', 'net this month correct (R 16 749,50)', await page.locator('.hero .big').innerText());
  R.ok(await page.locator('.donutw', { hasText: 'Groceries' }).count() === 1, 'spending breakdown shows the category');
  await page.click('.item .grow >> text=Groceries'); R.ok(await page.inputValue('#sheet [name="amount"]') === '1250.50', 'edit entry pre-fills amount'); await fill({ amount: '1300' }); await submit();
  s = await S(); R.ok(s.tx.find((t) => t.category === 'Groceries').amount_cents === 130000, 'edit entry');
  await page.click('[data-act="open"][data-id="tx"]'); await fill({ kind: 'expense', amount: '99', category: 'Snacks' }); await submit();
  await page.click('.item:has-text("Snacks") [data-act="del"]'); s = await S(); R.ok(!s.tx.some((t) => t.category === 'Snacks'), 'delete entry');
  await page.click('[data-act="open"][data-id="budget"]'); await fill({ category: 'Groceries', limit: '1000' }); await submit();
  R.ok(await page.locator('.card:has-text("Groceries") .over').count() >= 1, 'budget shows over-limit');
  await page.click('.card:has(.bar) [data-act="edit"]'); await fill({ limit: '2000' }); await submit(); s = await S(); R.ok(s.budgets.length === 1 && s.budgets[0].limit_cents === 200000, 'edit budget');
  R.ok(/R\s700,00 left/.test(await page.locator('.card:has(.bar)').innerText()), 'budget shows amount left', await page.locator('.card:has(.bar)').innerText());
  await page.click('[data-act="open"][data-id="bill"]'); await fill({ name: 'Rent', amount: '7500', due: tomorrow(), monthly: true }); await submit();
  await page.click('[data-act="open"][data-id="bill"]'); await fill({ name: 'Gym', amount: '450', due: tomorrow() }); await submit();
  s = await S(); R.ok(s.bills.length === 2, 'add bills'); dialogs = [];
  await page.click('.item:has-text("Gym") [data-act="pay"]'); s = await S(); R.ok(s.bills.find((b) => b.name === 'Gym').paid === 1 && s.tx.some((t) => t.note === 'Gym'), 'mark bill paid and record expense', dialogs[0]);
  R.ok(await page.locator('h2', { hasText: 'Recently paid' }).count() === 1, 'paid bills listed with payment date');
  await page.click('.item:has-text("Gym") [data-act="unpay"]'); s = await S(); R.ok(s.bills.find((b) => b.name === 'Gym').paid === 0, 'undo bill payment');
  const due0 = s.bills.find((b) => b.name === 'Rent').due_at; await page.click('.item:has-text("Rent") [data-act="pay"]'); s = await S(); R.ok(s.bills.find((b) => b.name === 'Rent').due_at > due0 && !s.bills.find((b) => b.name === 'Rent').paid, 'monthly bill rolls to next month');
  await page.click('.item .grow >> text=Gym'); await fill({ amount: '500' }); await submit(); s = await S(); R.ok(s.bills.find((b) => b.name === 'Gym').amount_cents === 50000, 'edit bill');
  await page.click('.item:has-text("Gym") [data-act="del"]'); s = await S(); R.ok(!s.bills.some((b) => b.name === 'Gym'), 'delete bill');
  await page.click('.card:has(.bar) [data-act="del"]'); s = await S(); R.ok(s.budgets.length === 0, 'delete budget'); await page.click('#toastbtn'); s = await S(); R.ok(s.budgets.length === 1, 'undo budget delete');
  // ---------- business ----------
  await tabTo('biz');
  for (const [kind, amount, description, party] of [['sale', '3500', 'Logo design', 'Thandi Bakery'], ['expense', '450', 'Printer ink', ''], ['invoice', '12000', 'Website build', 'Mokoena Attorneys']]) { await page.click('[data-act="open"][data-id="biz"]'); await fill({ kind, amount, description, party }); await submit(); }
  s = await S(); R.ok(s.biz.length === 3, 'create sale, expense and invoice');
  R.ok((await page.locator('.hero .big').innerText()).replace(/\s/g, ' ') === 'R 3 050,00', 'profit is cash basis (unpaid invoice excluded)', await page.locator('.hero .big').innerText());
  await page.click('.item:has-text("Website build") [data-act="inv-paid"]'); R.ok((await page.locator('.hero .big').innerText()).replace(/\s/g, ' ') === 'R 15 050,00', 'paid invoice counts towards profit');
  await page.fill('#bq', 'bakery'); R.ok(await page.locator('#bizlist .item').count() === 1, 'search business records by customer');
  await page.fill('#bq', '450'); R.ok(await page.locator('#bizlist .item').count() === 1 && /Printer ink/.test(await page.locator('#bizlist').innerText()), 'search by amount');
  await page.fill('#bq', 'zzz'); R.ok(/No records match/.test(await page.locator('#bizlist').innerText()), 'search with no match shows a message'); await page.fill('#bq', '');
  await page.click('#bizlist .grow >> text=Logo design'); await fill({ description: 'Logo design & brand guide' }); await submit(); s = await S(); R.ok(s.biz.some((r) => r.description === 'Logo design & brand guide'), 'edit business record');
  await page.click('#bizlist .item:has-text("Printer ink") [data-act="del"]'); s = await S(); R.ok(s.biz.length === 2, 'delete business record');
  // ---------- brain / memory ----------
  await tabTo('brain');
  await page.click('[data-act="open"][data-id="mem"]'); await fill({ content: 'My VAT number is in the blue folder', category: 'Work' }); await submit();
  await page.click('[data-act="open"][data-id="mem"]'); await fill({ content: 'Allergic to penicillin', category: 'Health' }); await submit();
  s = await S(); R.ok(s.mem.length === 2, 'save memories');
  await page.fill('#q', 'VAT'); R.ok(await page.locator('#memlist .card').count() === 1, 'search memories'); await page.fill('#q', '');
  await page.click('.chips button:has-text("Health")'); R.ok(await page.locator('#memlist .card').count() === 1, 'filter memories by category'); await page.click('.chips button:has-text("All")');
  await page.click('#memlist .card:has-text("penicillin") [data-act="edit"]'); await fill({ content: 'Allergic to penicillin and amoxicillin' }); await submit(); s = await S(); R.ok(s.mem.some((m) => /amoxicillin/.test(m.content)), 'edit memory');
  await page.click('#memlist .card:has-text("VAT") [data-act="fb-up"]'); s = await S(); R.ok(s.mem.find((m) => /VAT/.test(m.content)).helpful_count === 1 && s.fb.length === 1, 'memory feedback recorded');
  await page.click('#memlist .card:has-text("amoxicillin") [data-act="del"]'); s = await S(); R.ok(s.mem.length === 1, 'delete memory');
  const sw = page.locator('.swrow:has-text("Money") .sw'); const before = await sw.getAttribute('aria-checked'); await sw.click(); R.ok((await sw.getAttribute('aria-checked')) !== before, 'privacy switch toggles'); await page.locator('.swrow:has-text("Money") .sw').click();
  await page.click('details summary'); await layoutOk('brain with Advanced open'); const gpu = page.locator('.swrow:has-text("GPU") .sw'); await gpu.click(); R.ok(await gpu.getAttribute('aria-checked') === 'true', 'GPU switch toggles and is not covered by its label');
  await page.click('[data-act="ctx-open"]'); const ctxText = await page.locator('#sheet pre').innerText(); R.ok(/Groceries/.test(ctxText) && /VAT number/.test(ctxText) && !/Mokoena/.test(ctxText) && !/Checkers/.test(ctxText), '"What Anna sees" shows data but never notes or customer names'); await page.click('#sheet [data-act="close"] >> nth=-1');
  // chat without a model
  await tabTo('home'); await page.click('.ask'); R.ok(/can’t answer yet/.test(await page.locator('#chatmain').innerText()), 'chat explains the AI is not installed'); R.ok(await page.locator('#send').isDisabled(), 'Send is disabled until the AI is ready');
  await page.evaluate(() => { window.__anna.S.chat.push({ role: 'user', content: 'Earlier question', at: Date.now() }, { role: 'assistant', content: 'Earlier answer', at: Date.now() }); }); await page.click('[data-act="close"]'); await page.click('.ask');
  R.ok(await page.locator('.bub', { hasText: 'Earlier answer' }).count() === 1, 'chat history is readable without the model'); await layoutOk('chat');
  await page.click('[data-act="chat-clear"]'); s = await S(); R.ok(s.chat.length === 0, 'clear conversation (after confirmation)'); await page.click('[data-act="close"]');
  await page.evaluate(() => { window.__anna.S.chat.push({ role: 'user', content: 'Kept question', at: Date.now() }, { role: 'assistant', content: 'Kept answer', at: Date.now() }); });
  // ---------- settings ----------
  await page.click('.top [data-tab="data"]'); await page.fill('#nm', 'Tamani'); await page.click('[data-act="prefs"]'); await tabTo('home'); R.ok(/Tamani/.test(await page.locator('h1').innerText()), 'name preference shows in greeting');
  await page.click('.top [data-tab="data"]'); await page.selectOption('#cursel', '$'); await page.click('[data-act="prefs"]'); await tabTo('money'); R.ok(/^\$/.test(await page.locator('.hero .big').innerText()), 'currency can be changed'); await page.click('.top [data-tab="data"]'); await page.selectOption('#cursel', 'R'); await page.click('[data-act="prefs"]');
  await tabTo('home'); await page.click('.top [data-tab="data"]'); await page.click('[data-act="diag"]'); await page.waitForFunction(() => /VERDICT/.test(document.querySelector('#diagout')?.textContent || ''), null, { timeout: 30000 });
  const dg = await page.locator('#diagout').innerText(); R.ok(/Database: indexeddb \(best\), read\/write OK/.test(dg) && /Internet: connected/.test(dg) && /AI engine cache wllama 3\.5\.1 \(4\/4 files\)/.test(dg), 'diagnostics: database, internet and cached AI engine', dg.split('\n').slice(3, 7).join(' | '));
  R.ok(/Not fully ready.*Install the AI model/.test(dg), 'diagnostics verdict explains what is missing (no model yet)');
  // backup → erase → restore
  const before2 = await S(); const d2 = page.waitForEvent('download'); await page.click('[data-act="export"]'); const bk = await d2; const bkPath = await bk.path(), bkText = readFileSync(bkPath, 'utf8'), bkJson = JSON.parse(bkText);
  R.ok(bkJson.app === 'anna-web' && bkJson.tasks.length === before2.tasks.length && bkJson.reminders.length === before2.reminders.length && bkJson.chat.length === 2 && bkJson.mem.length === 1 && bkJson.biz.length === 2, 'export backup contains every record type incl. reminders and chat', bk.suggestedFilename());
  dialogs = []; await page.click('[data-act="erase"]'); await page.waitForFunction(() => window.__anna.S.tasks.length === 0, null, { timeout: 5000 }).catch(() => {}); s = await S(); R.ok(dialogs.length === 2 && s.tasks.length === 0 && s.tx.length === 0 && s.chat.length === 0, 'erase all data (two confirmations)', JSON.stringify({ d: dialogs, t: s.tasks.length, x: s.tx.length, c: s.chat.length, tab: await page.locator('h1').innerText() }));
  await page.click('.top [data-tab="data"]'); await page.setInputFiles('#file', { name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"app":"other"}') }); await page.waitForTimeout(300); R.ok(/not an Anna Web backup/.test(await toastText()), 'invalid backup file is refused', await toastText());
  await page.setInputFiles('#file', bkPath); R.ok(/Restore this backup/.test(await page.locator('#sheet').innerText()) && /Backup/.test(await page.locator('#sheet .status').innerText()), 'restore shows a preview before overwriting');
  await page.click('[data-act="restore-confirm"]'); await page.waitForTimeout(300); R.ok(/Restored and verified/.test(await toastText()), 'restore completes and verifies what was saved', await toastText());
  s = await S(); R.ok(JSON.stringify([s.tasks, s.tx, s.bills, s.budgets, s.biz, s.mem, s.reminders, s.chat]) === JSON.stringify([before2.tasks, before2.tx, before2.bills, before2.budgets, before2.biz, before2.mem, before2.reminders, before2.chat]), 'restored records are identical to the originals');
  R.ok(await page.locator('[data-act="undo-restore"]').count() === 1, 'undo-restore is offered');
  // ---------- persistence across a full browser restart ----------
  const snap = JSON.stringify(await S()); await ctx.close(); ({ ctx, page } = await open()); await page.goto(url); await page.waitForFunction(() => window.__anna, null, { timeout: 20000 });
  const after = await S(); R.ok(JSON.stringify(after) === snap, 'all data identical after closing and reopening the browser (IndexedDB)');
  R.ok(after.settings.name === 'Tamani' && after.settings.currency === 'R', 'settings persist');
  // ---------- offline app shell ----------
  await page.evaluate(() => navigator.serviceWorker.ready); await ctx.close(); srv.closeAllConnections?.(); await new Promise((r) => srv.close(r));
  ({ ctx, page } = await open()); await ctx.setOffline(true); await page.goto(url).catch(() => {}); const off = await page.waitForFunction(() => window.__anna, null, { timeout: 20000 }).then(() => true, () => false);
  R.ok(off, 'app opens with no internet and no server (service worker cache)');
  if (off) { R.ok((await S()).tasks.length === after.tasks.length, 'data available offline'); await page.click('.top [data-tab="data"]'); await page.click('[data-act="diag"]'); await page.waitForFunction(() => /VERDICT/.test(document.querySelector('#diagout')?.textContent || ''), null, { timeout: 30000 }); R.ok(/Internet: offline/.test(await page.locator('#diagout').innerText()), 'diagnostics detect offline'); for (const t of ['home', 'tasks', 'money', 'biz', 'brain']) { await tabTo(t); } R.ok(true, 'all tabs work offline'); }
  R.ok(errors.length === 0, 'no JavaScript errors during the whole run', errors.join(' | '));
  await ctx.close();
} catch (e) { R.ok(false, 'unexpected error', e.stack); }
try { srv.close(); } catch {}
rmSync(dir, { recursive: true, force: true });
process.exit(R.finish({ device: devName, note: devName === 'desktop' ? 'Desktop Chromium' : 'Chromium with iPhone 15 viewport/touch/UA emulation (layout only, not real Safari or hardware)' }) ? 0 : 1);
