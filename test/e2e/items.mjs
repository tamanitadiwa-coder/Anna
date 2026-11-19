// Many money items in one chat message: one summary card, birthday question, Save all → right stores, Money card, Undo, auto-save.
import { mkdtempSync, rmSync } from 'node:fs'; import { tmpdir } from 'node:os'; import { join } from 'node:path';
import { pw, reporter, ready } from './lib.mjs'; import { serve } from './serve.mjs';
const R = reporter('items'), dir = mkdtempSync(join(tmpdir(), 'anna-items-')); const { srv, url } = await serve(new URL('../../_site', import.meta.url).pathname, 0);
const { defaultBrowserType, ...dev } = pw.devices['iPhone 15'];
const MSG = "Right now there's 4100. I need to send my mom 1200 and pay 1500 house deposit. I get paid on the 25th 10500, I owe Ashraf 500, it's my birthday, plus 500 for moving";
let ctx, page; const errors = [];
const nb = (s) => s.replace(/[  ]/g, ' ');
const last = async () => nb(await page.evaluate(() => window.__anna.S.chat.at(-1).content));
const say = async (t) => { await page.fill('.chatin textarea', t); await page.click('#send'); await page.waitForTimeout(350); return last(); };
const S = (f) => page.evaluate(f);
try {
  ctx = await pw.chromium.launchPersistentContext(dir, { ...dev, deviceScaleFactor: 1, timezoneId: 'Africa/Johannesburg' }); await ctx.clock.install({ time: new Date('2026-11-19T10:00:00+02:00') });
  page = ctx.pages()[0] || await ctx.newPage(); page.on('pageerror', (e) => errors.push(e.message)); page.on('dialog', (d) => d.accept()); await page.goto(url); await ready(page);
  await page.click('.ask');
  let r = await say(MSG);
  R.ok(/^I found 6 money items/.test(r) && (await page.locator('[data-act="bat-del"]').count()) === 6 && (await page.locator('[data-act="bat-save"]').count()) === 1, 'one summary card with 6 items (Save all / Edit item / Remove item)', r);
  R.ok(/Balance · Current balance · R 4 100,00/.test(r) && /Planned payment · Mom · R 1 200,00/.test(r) && /Planned payment · House deposit · R 1 500,00/.test(r) && /Income · Pay · R 10 500,00 · 25 Nov/.test(r) && /Debt · Ashraf \(debt\) · R 500,00/.test(r) && /Planned payment · Moving · R 500,00/.test(r), 'each item: type, name, amount, date');
  R.ok(/Left until payday: R 400,00/.test(r) && /6 days until payday → R 66,66 a day/.test(r) && /Next income: R 10 500,00 on 25 November/.test(r), 'answer from money.js: R400 left, 6 days, R66,66 a day, next income');
  R.ok(/How much do you want to set aside for your birthday\?$/.test(r), 'asks about the birthday');
  R.ok((await S(() => window.__anna.S.bills.length + window.__anna.S.tx.length)) === 0, 'nothing saved before the tap');
  r = await say('R300'); R.ok(/I found 7 money items/.test(r) && /Birthday · R 300,00/.test(r) && /Left until payday: R 100,00/.test(r), 'birthday amount added, totals updated', r);
  await page.click('[data-act="bat-del"][data-id="5"]'); await page.waitForTimeout(300); r = await last(); R.ok(/I found 6 money items/.test(r) && !/Moving/.test(r), 'Remove item');
  await page.click('[data-act="bat-edit"][data-id="1"]'); R.ok((await page.inputValue('.chatin textarea')) === 'I need to send my mom 1200', 'Edit item puts it back in the box');
  r = await say('send my mom 1000'); R.ok(/Mom · R 1 000,00/.test(r) && /I found 6 money items/.test(r), 'edited item comes back changed', r);
  await page.click('[data-act="bat-save"]'); await page.waitForTimeout(600); r = await last();
  R.ok(/^Saved 6 items/.test(r) && /Left until payday: R 800,00/.test(r), 'Save all + plan', r);
  const st = await S(() => ({ bills: window.__anna.S.bills.map((b) => [b.name, b.amount_cents, b.kind]), fin: window.__anna.life.finance.map((x) => [x.id, x.balance || x.amount]) }));
  R.ok(JSON.stringify(st.bills.map((b) => b[0]).sort()) === JSON.stringify(['Ashraf (debt)', 'Birthday', 'House deposit', 'Mom']) && st.bills.some((b) => b[0] === 'Ashraf (debt)' && b[2] === 'debt') && st.fin.some((f) => f[0] === 'cash' && f[1] === 410000) && st.fin.some((f) => f[0] === 'payday' && f[1] === 1050000), 'saved to the right stores: bills, debt, balance, payday', JSON.stringify(st));
  await page.evaluate(() => document.querySelector('[data-act="close"]')?.click()); await page.waitForTimeout(300); await page.click('#tabs [data-tab="money"]');
  const card = nb(await page.locator('#payday').innerText()); R.ok(/Left until payday: R 800,00/.test(card) && /6 days until payday/.test(card), 'Money shows the stats with no manual entry', card);
  await page.click('#tabs [data-tab="home"]'); await page.click('.ask'); await page.click('[data-act="ent-undo"]'); await page.waitForTimeout(400);
  R.ok((await S(() => window.__anna.S.bills.length)) === 0 && !(await S(() => window.__anna.life.finance.some((x) => x.id === 'cash' || x.id === 'payday'))), 'Undo removes them all');
  // auto-save setting (off by default)
  await page.evaluate(() => document.querySelector('[data-act="close"]')?.click()); await page.waitForTimeout(200); await page.click('.top [data-tab="data"]');
  R.ok((await page.locator('[data-act="automoney"]:not(.on)').count()) === 1, 'Auto-save setting exists and is off by default'); await page.click('[data-act="automoney"]');
  await page.click('#tabs [data-tab="home"]'); await page.click('.ask'); r = await say("There's R2000 and I owe Sipho R300"); await page.waitForTimeout(500); r = await last();
  R.ok(/^Saved 2 items/.test(r) && /Left until payday: R 1 700,00/.test(r) && (await page.locator('[data-act="ent-undo"]').count()) >= 1, 'auto-save on: saved straight away, Undo available', r);
  R.ok(!errors.length, 'no JavaScript errors', errors.join(' | '));
} catch (e) { R.ok(false, 'unexpected error', e.stack); }
try { await ctx.close(); } catch {} srv.close(); rmSync(dir, { recursive: true, force: true }); process.exit(R.finish() ? 0 : 1);
