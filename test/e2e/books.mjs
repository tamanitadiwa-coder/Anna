// v0.10 in the real UI: chat money entries (confirm → save → undo), warnings, bill priorities / pay-first, Books Day, 2× Sundays.
import { mkdtempSync, rmSync } from 'node:fs'; import { tmpdir } from 'node:os'; import { join } from 'node:path';
import { pw, reporter, ready } from './lib.mjs'; import { serve } from './serve.mjs';
const R = reporter('books'), dir = mkdtempSync(join(tmpdir(), 'anna-books-')); const { srv, url } = await serve(new URL('../../_site', import.meta.url).pathname, 0);
const { defaultBrowserType, ...dev } = pw.devices['iPhone 15'];
let ctx, page; const errors = [];
const open = async (time) => { ctx = await pw.chromium.launchPersistentContext(dir, { ...dev, deviceScaleFactor: 1, timezoneId: 'Africa/Johannesburg' }); await ctx.clock.install({ time: new Date(time) }); page = ctx.pages()[0] || await ctx.newPage(); page.on('pageerror', (e) => errors.push(e.message)); page.on('dialog', (d) => d.accept()); await page.goto(url); await ready(page); };
const nb = (s) => s.replace(/[\u00a0\u202f\u2009]/g, ' ');
const last = async () => nb(await page.evaluate(() => window.__anna.S.chat.at(-1).content));
const say = async (t) => { await page.fill('.chatin textarea', t); await page.click('#send'); await page.waitForTimeout(300); return last(); };
const tap = async (sel) => { await page.click(sel); await page.waitForTimeout(400); return last(); };
const S = (f) => page.evaluate(f);
const closeS = async () => { await page.evaluate(() => document.querySelector('[data-act="close"]')?.click()); await page.waitForTimeout(300); };
const fin = () => S(() => window.__anna.life.finance);
try {
  await open('2026-11-20T10:00:00+02:00');
  // a saved plan for this month: income 15 000, rent 5 000, food 2 000, savings 1 000
  await page.click('#tabs [data-tab="money"]'); await page.click('[data-act="mmore"]'); await page.click('[data-act="open"][data-id="mbudget"]');
  for (const [n, v] of [['Monthly income', '15000'], ['Rent / bond', '5000'], ['Food & groceries', '2000'], ['Transport', '1000'], ['Electricity', '800']]) await page.locator(`.bline:has(input[data-bl="name"][value="${n}"]) input[data-bl="amt"]`).fill(v);
  await page.click('[data-act="b-save"]'); await page.waitForTimeout(300); await closeS();
  await page.click('#tabs [data-tab="home"]'); await page.click('.ask');
  // 1. entries need a tap
  let r = await say('got R500 extra'); const cards = await page.locator('[data-act="ent-save"]').count(); R.ok(/^Add R 500,00 extra/.test(r) && cards === 1, 'chat entry → confirm card (Save / Edit / Cancel)', r);
  R.ok((await S(() => window.__anna.S.tx.length)) === 0, 'nothing saved before the tap');
  r = await tap('[data-act="ent-cancel"]'); R.ok(/nothing saved/.test(r) && (await S(() => window.__anna.S.tx.length)) === 0, 'Cancel saves nothing');
  await say('spent R200 on food'); await page.click('[data-act="ent-edit"]'); R.ok((await page.inputValue('.chatin textarea')) === 'spent R200 on food' && !(await page.locator('[data-act="ent-save"]').count()), 'Edit puts the text back in the box');
  await page.fill('.chatin textarea', ''); await say('got R500 extra'); r = await tap('[data-act="ent-save"]');
  R.ok(/^Saved: R 500,00/.test(r) && (await S(() => window.__anna.S.tx.length)) === 1, 'Save records it', r.split('\n')[0]);
  const m1 = (await fin()).find((x) => x.id === 'budget-2026-11'); R.ok(m1?.lines.some((l) => l.id === 'extra' && l.cents === 50000), 'extra income added to this month');
  r = await tap('[data-act="ent-undo"]'); R.ok(/Undone/.test(r) && (await S(() => window.__anna.S.tx.length)) === 0 && !(await fin()).find((x) => x.id === 'budget-2026-11').lines.some((l) => l.id === 'extra' && l.cents), 'Undo restores everything', JSON.stringify([r, await S(() => window.__anna.S.tx.length), (await fin()).find((x) => x.id === 'budget-2026-11')?.lines.map((l) => l.id)]));
  await say('Rent R5000'); await tap('[data-act="ent-save"]');
  for (const t of ['Apple Music R60 this month', 'rent is now R5,500', 'cancelled Netflix']) { r = await say(t); R.note(t + ' → ' + r); }
  R.ok(/couldn’t find a bill called “Netflix”/.test(r), 'cancelling an unknown bill is refused, not invented');
  await say('Netflix R199'); await tap('[data-act="ent-save"]'); r = await say('cancelled Netflix'); R.ok(/^Remove the bill “Netflix” \(R 199,00\)/.test(r), 'cancel asks first', r); await tap('[data-act="ent-save"]');
  R.ok(!(await S(() => window.__anna.S.bills.some((b) => b.name === 'Netflix'))), 'cancelled bill removed');
  await say('rent is now R5,500'); r = await tap('[data-act="ent-save"]'); R.ok(/Rent.*R 5 500,00/.test(r) && (await S(() => window.__anna.S.bills.find((b) => b.name === 'Rent').amount_cents)) === 550000, 'bill amount change saved', r.split('\n')[0]);
  // 2. warnings with real numbers
  r = await say('spent R9000 on food'); r = await tap('[data-act="ent-save"]');
  R.ok(/⚠/.test(r) && /minus|savings|over budget|per day/i.test(r) && /You decide/.test(r) && /R \d/.test(r.split('⚠')[1] || ''), 'warnings after saving, with options and amounts', r);
  R.note(r);
  // 3. priorities and pay-first
  await say('Apple Music R60'); await tap('[data-act="ent-save"]');
  await closeS(); await page.click('#tabs [data-tab="money"]');
  await page.locator('[data-act="edit"][data-k="bill"]').filter({ hasText: 'Apple Music' }).click(); await page.selectOption('#sheet [name="priority"]', '1'); await page.click('#sheet form button:not([type=button])'); await page.waitForTimeout(300);
  R.ok((await S(() => window.__anna.S.bills.find((b) => b.name === 'Apple Music').priority)) === 1 && /Apple Music\s*P1/.test(nb(await page.locator('#screen').innerText())), 'bill priority set in the form and shown');
  await page.click('#tabs [data-tab="home"]'); await page.click('.ask');
  r = await say('What must I pay first?'); R.ok(/^Pay in this order/.test(r) && /1\. Apple Music \(P1/.test(r) && /running/.test(r), 'pay-first: priority, then due date, running total', r);
  R.ok(/money runs out here|Enough for all|short/.test(r), 'pay-first shows where money runs out (or that it is enough)');
  r = await say('paid rent'); R.ok(/^Mark Rent/.test(r), '"paid rent" asks to mark paid', r); await tap('[data-act="ent-save"]');
  R.ok(await S(() => window.__anna.S.bills.find((b) => /rent/i.test(b.name)).paid === 1 || !!window.__anna.S.bills.find((b) => /rent/i.test(b.name)).last_paid_at), 'rent marked paid');
  await closeS();
  // 5. 2× Sundays & public holidays (16 Dec 2026 is a Wednesday holiday; 22 Nov is a Sunday)
  await page.click('#tabs [data-tab="biz"]'); await page.click('[data-act="bizview"][data-id="staff"]'); await page.click('[data-act="open"][data-id="person"]'); await page.fill('[name="name"]', 'Lindi'); await page.fill('[name="rate"]', '50'); await page.check('[name="double_special"]'); await page.click('#sheet form button:not([type=button])'); await page.waitForTimeout(200);
  await page.click('[data-act="open"][data-id="shift"]'); await page.selectOption('[name="staff"]', { label: 'Lindi' }); await page.fill('[name="date"]', '2026-11-22'); await page.fill('[name="start"]', '08:00'); await page.fill('[name="end"]', '12:00'); await page.fill('[name="break_min"]', '0'); await page.click('#sheet form button:not([type=button])'); await page.waitForTimeout(200);
  await page.click('#tabs [data-tab="home"]'); await page.click('.ask'); r = await say('How many hours did staff work this week?');
  R.ok(/Lindi: 4 h.*R 400,00/.test(r), '2× rate on a Sunday: 4 h × R50 × 2 = R400', r); await closeS();
  // 4. Books Day: nothing before the 25th
  await page.click('.ask'); R.ok(!(await S(() => window.__anna.S.chat.some((m) => m.books))), 'no Books Day nag before the 25th'); await closeS();
  await ctx.close(); await open('2026-11-25T19:00:00+02:00'); await page.click('.ask');
  R.ok(/Books Day for November 2026/.test(await last()), 'on the 25th ANNA asks about Books Day');
  r = await tap('[data-act="books-snooze"]'); await closeS(); await page.click('.ask'); R.ok(/ask again tomorrow/.test(await last()), 'snooze: no second nag the same day');
  await ctx.close(); await open('2026-11-26T19:00:00+02:00'); await page.click('.ask'); R.ok(/Books Day/.test(await last()), 'asks again the next day');
  const n = await S(() => window.__anna.S.chat.filter((m) => /Books Day for/.test(m.content)).length); await closeS(); await page.click('.ask');
  R.ok((await S(() => window.__anna.S.chat.filter((m) => /Books Day for/.test(m.content)).length)) === n, 'at most once a day');
  r = await tap('[data-act="books-start"]'); R.ok(/income .*haven’t recorded/.test(r), 'Q1: unrecorded income', r);
  r = await say('got R1000 extra'); R.ok(await page.locator('[data-act="ent-save"]').count() === 1, 'answer uses the same confirm card'); await tap('[data-act="ent-save"]');
  R.ok(/Anything else/.test(await last()), 'after saving, asks for more');
  await say('none'); await page.waitForTimeout(200); R.ok(/expenses/.test(await last()), 'Q2: unrecorded expenses');
  await say('none'); await page.waitForTimeout(200); r = await last(); R.ok(/Which bills are paid\?.*Unpaid now:/.test(r), 'Q3: paid bills, listing unpaid ones', r);
  await say('none'); await page.waitForTimeout(200); R.ok(/new or cancelled bills/.test(await last()), 'Q4: new or cancelled bills');
  await say('none'); await page.waitForTimeout(200); R.ok(/save anything/.test(await last()), 'Q5: savings made');
  await say('saved R1000'); await tap('[data-act="ent-save"]');
  await say('none'); await page.waitForTimeout(200); R.ok(/next month/.test(await last()), 'Q6: next month');
  await say('school fees R3000 next month'); await tap('[data-act="ent-save"]'); await say('none'); await page.waitForTimeout(300);
  r = await last(); R.ok(/^Summary for November 2026/.test(r) && /Income: R/.test(r) && /Saved: R 1 000,00/.test(r) && /No closed month before/.test(r), 'summary (no previous month to compare)', r);
  r = await tap('[data-act="books-close"]'); R.ok(/November 2026 is closed/.test(r), 'month closed', r);
  const f = await fin(), nx = f.find((x) => x.id === 'budget-2026-12');
  R.ok(f.some((x) => x.id === 'books-2026-11' && x.summary) && nx && nx.lines.some((l) => /school fees/i.test(l.name) && l.cents === 300000) && !nx.lines.some((l) => /Apple Music/.test(l.name) && l.oneMonth), 'December plan created: recurring carried forward, next-month item added');
  R.ok((await S(() => window.__anna.S.bills.find((b) => b.name === 'Apple Music')?.priority)) === 1, 'bill priorities carried forward');
  await page.click('[data-act="books-remind"]'); await page.waitForTimeout(300);
  const u = await S(() => window.__anna.lastURL), p = JSON.parse(decodeURIComponent(u.split('&text=')[1] || '{}'));
  R.ok(/^shortcuts:\/\/run-shortcut\?name=ANNA%20Reminder/.test(u) && p.title === 'ANNA Books Day' && p.date === '2026-12-25' && p.time === '18:00', 'Books Day reminder via the ANNA Reminder shortcut, 25th at 18:00', JSON.stringify(p));
  await closeS(); await page.click('.ask'); R.ok(!/Books Day for/.test(await last()), 'closed month: no more nagging');
  R.ok(!errors.length, 'no JavaScript errors', errors.join(' | '));
} catch (e) { R.ok(false, 'unexpected error', e.stack); }
try { await ctx.close(); } catch {} srv.close(); rmSync(dir, { recursive: true, force: true }); process.exit(R.finish() ? 0 : 1);
