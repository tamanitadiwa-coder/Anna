// Reminder manager + date engine in the real UI (works without the AI): confirm before saving, verified save,
// iPhone Reminders hand-off URL, .ics fallback, labels for where each reminder lives, clock/holiday answers.
import { mkdtempSync, rmSync, readFileSync } from 'node:fs'; import { tmpdir } from 'node:os'; import { join } from 'node:path';
import { pw, reporter, ready } from './lib.mjs'; import { serve } from './serve.mjs';
const R = reporter('reminders'), dir = mkdtempSync(join(tmpdir(), 'anna-rem-')); const { srv, url } = await serve(new URL('../../_site', import.meta.url).pathname, 0);
const { defaultBrowserType, ...dev } = pw.devices['iPhone 15'];
const ctx = await pw.chromium.launchPersistentContext(dir, { ...dev, deviceScaleFactor: 1, acceptDownloads: true, timezoneId: 'Africa/Johannesburg' }); const page = ctx.pages()[0] || await ctx.newPage();
const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('dialog', (d) => d.accept());
const S = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__anna.S)));
const kvRems = () => page.evaluate(() => new Promise((res) => { const r = indexedDB.open('anna-web', 1); r.onsuccess = () => { const q = r.result.transaction('kv').objectStore('kv').get('state'); q.onsuccess = () => res(q.result?.reminders || []); }; }));
const say = async (t) => { await page.fill('.chatin textarea', t); await page.click('#send'); await page.waitForTimeout(250); return page.evaluate(() => window.__anna.S.chat.at(-1).content); };
try {
  await page.goto(url); await ready(page); await page.click('.ask');
  let a = await say('Remind me to call Mom tomorrow at 3pm'); const tom = await page.evaluate(() => { const d = new Date(Date.now() + 864e5); return d.toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }); });
  R.ok(a === `Shall I remind you to “Call Mom” on ${tom} at 15:00?`, 'parses "Remind me…" into an exact date/time and asks to confirm', a);
  R.ok((await S()).reminders.length === 0 && (await kvRems()).length === 0, 'nothing saved before confirming');
  await page.click('[data-act="rq-save"]'); await page.waitForTimeout(300); a = await page.evaluate(() => window.__anna.S.chat.at(-1).content);
  let kv = await kvRems(); R.ok(kv.length === 1 && kv[0].title === 'Call Mom' && new Date(kv[0].at).toLocaleTimeString('en-ZA', { timeZone: 'Africa/Johannesburg', hour12: false }).startsWith('15:00') && /^Saved in ANNA: “Call Mom”/.test(a), '"Saved in ANNA" only after the save is verified in storage', a);
  R.ok(/Saved in ANNA/.test(await page.locator('.bub.assistant').last().innerText()), 'reply shows where it lives');
  await page.click('.bub.assistant >> nth=-1 >> [data-act="rem-ios"]').catch(() => page.locator('[data-act="rem-ios"]').last().click()); await page.waitForTimeout(200);
  const u = await page.evaluate(() => window.__anna.lastURL); const p = JSON.parse(decodeURIComponent(u.split('&text=')[1] || '{}'));
  R.ok(u.startsWith('shortcuts://run-shortcut?name=ANNA%20Reminder&input=text&text=') && p.title === 'Call Mom' && p.time === '15:00' && p.due === `${p.date} 15:00`, 'iPhone Reminders opens the ANNA Reminder shortcut with title, date and time', u.slice(0, 160));
  R.ok((await kvRems())[0].dest?.iphone > 0, 'marked as sent to iPhone Reminders');
  const d = page.waitForEvent('download'); await page.locator('[data-act="rem-ics"]').last().click(); const ics = readFileSync(await (await d).path(), 'utf8');
  R.ok(/SUMMARY:Call Mom/.test(ics) && /BEGIN:VALARM/.test(ics), 'Add to Calendar makes a valid .ics with an alarm'); await page.waitForTimeout(200);
  R.ok((await kvRems())[0].dest?.ics > 0, 'marked as Calendar file made');
  // missing time → asks, then fills
  a = await say('remind me to buy bread'); R.ok(/^When should I remind you to “Buy bread”\?/.test(a) && (await kvRems()).length === 1, 'no time given → asks when (saves nothing)', a);
  a = await say('next friday at 8am'); R.ok(/^Shall I remind you to “Buy bread” on Fri, .* at 08:00\?$/.test(a), 'follow-up time completes the reminder', a);
  await page.click('[data-act="rq-cancel"]'); await page.waitForTimeout(200); R.ok((await kvRems()).length === 1 && /won’t set it/.test(await page.evaluate(() => window.__anna.S.chat.at(-1).content)), 'Cancel saves nothing');
  // recurring + Change… opens the form prefilled
  a = await say('Set a reminder to water the plants every day at 7am'); R.ok(/every day/.test(a) && /07:00/.test(a), 'recurring reminder understood', a);
  await page.click('[data-act="rq-edit"]'); R.ok((await page.inputValue('#sheet [name="title"]')) === 'Water the plants' && (await page.inputValue('#sheet [name="time"]')) === '07:00' && (await page.inputValue('#sheet [name="repeat"]')) === 'daily', '"Change…" opens the reminder form prefilled');
  await page.click('#sheet form button:not([type=button])'); await page.waitForTimeout(300); R.ok((await kvRems()).length === 2 && (await kvRems()).some((r) => r.repeat === 'daily' && r.dest?.anna), 'saved from the form');
  // tools without the AI
  await page.click('.ask'); a = await say('What time is it in London?'); R.ok(/^It’s \d\d:\d\d in London \(.*\), 2 hours behind you\.$/.test(a), 'world clock from the time-zone engine (no AI)', a);
  a = await say('When is the next public holiday?'); R.ok(/^Next South African public holidays: Day of Reconciliation/.test(a), 'SA public holidays from code', a);
  a = await say('What day is next Friday?'); R.ok(/^Next Friday is Friday, \d+ \w+ \d{4}\.$/.test(a), 'date questions from code', a);
  a = await say('Tell me a story'); R.ok(/AI brain isn’t awake/.test(a), 'other questions explain the AI is asleep (no fake answer)', a);
  await page.click('[data-act="close"]');
  // list shows where each lives; done / edit / delete still work
  await page.click('#tabs [data-tab="tasks"]'); await page.click('[data-act="view"][data-id="reminders"]'); const lt = await page.locator('#screen').innerText();
  R.ok(/Saved in ANNA · sent to iPhone Reminders · Calendar file made/.test(lt) && /Saved in ANNA\n/.test(lt + '\n'), 'reminder list labels: ANNA / iPhone Reminders / Calendar', lt.split('\n').filter((l) => /Saved in ANNA/.test(l)).join(' | '));
  await page.click('.tcard:has-text("Call Mom") [data-act="rem-done"]'); R.ok((await S()).reminders.find((r) => r.title === 'Call Mom').done === 1, 'mark done');
  await page.click('.tcard:has-text("Water") [data-act="del"]'); R.ok(!(await S()).reminders.some((r) => /Water/.test(r.title)), 'delete');
  R.ok(!errors.length, 'no JavaScript errors', errors.join(' | '));
} catch (e) { R.ok(false, 'unexpected error', e.stack); }
await ctx.close(); srv.close(); rmSync(dir, { recursive: true, force: true }); process.exit(R.finish() ? 0 : 1);
