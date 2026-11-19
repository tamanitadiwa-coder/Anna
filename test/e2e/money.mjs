// Money & business phase in the real UI (no AI needed): monthly calculator, calculator, affordability, staff, chat answers.
import { mkdtempSync, rmSync } from 'node:fs'; import { tmpdir } from 'node:os'; import { join } from 'node:path';
import { pw, reporter, ready } from './lib.mjs'; import { serve } from './serve.mjs';
const R = reporter('money'), dir = mkdtempSync(join(tmpdir(), 'anna-money-')); const { srv, url } = await serve(new URL('../../_site', import.meta.url).pathname, 0);
const { defaultBrowserType, ...dev } = pw.devices['iPhone 15'];
let ctx, page; const errors = [];
const open = async () => { ctx = await pw.chromium.launchPersistentContext(dir, { ...dev, deviceScaleFactor: 1, timezoneId: 'Africa/Johannesburg' }); page = ctx.pages()[0] || await ctx.newPage(); page.on('pageerror', (e) => errors.push(e.message)); page.on('dialog', (d) => d.accept()); await page.goto(url); await ready(page); };
const store = (n) => page.evaluate((n) => new Promise((res) => { const r = indexedDB.open('anna-life'); r.onsuccess = () => { const q = r.result.transaction(n).objectStore(n).getAll(); q.onsuccess = () => res(q.result); }; }), n);
const amt = async (name, v) => { const i = page.locator(`.bline:has(input[data-bl="name"][value="${name}"]) input[data-bl="amt"]`); await i.fill(String(v)); };
const nb = (s) => s.replace(/[  ]/g, ' ');
const say = async (t) => { await page.fill('.chatin textarea', t); await page.click('#send'); await page.waitForTimeout(250); return nb(await page.evaluate(() => window.__anna.S.chat.at(-1).content)); };
try {
  await open(); await page.click('#tabs [data-tab="money"]'); await page.click('[data-act="mmore"]'); await page.click('[data-act="open"][data-id="mbudget"]');
  for (const [n, v] of [['Monthly income', '15 000'], ['Rent / bond', '5000'], ['Food & groceries', '2 000'], ['Transport', '1000'], ['Electricity', '800']]) await amt(n, v);
  await page.click('[data-act="b-add"]'); const nameIn = page.locator('input[data-bl="name"]').filter({ hasText: '' }).last(); await page.locator('.bline input[data-bl="name"][value="New bill"]').fill('Other');
  await page.locator('.bline').filter({ has: page.locator('[data-act="b-del"]') }).locator('input[data-bl="amt"]').fill('700');
  let res = nb(await page.locator('#bres').innerText());
  R.ok(/Remaining\s+R 5 500,00/.test(res), 'spec case: R15,000 − 5,000 − 2,000 − 1,000 − 800 − 700 = R 5 500,00', res.split('\n').slice(0, 14).join(' | '));
  R.ok(/Total income\s+R 15 000,00/.test(res) && /Total bills\s+R 6 500,00/.test(res) && /Total expenses\s+R 9 500,00/.test(res) && /Weekly allowance\s+R 1 283,33/.test(res) && /Daily allowance\s+R 183,33/.test(res) && /% of income spent\s+63.3%/.test(res) && /Surplus\s+R 5 500,00/.test(res), 'all outputs shown');
  R.ok(/A month is counted as 30 days/.test(res), 'assumption (30-day month) is stated');
  await page.locator('.bline:has([data-act="b-del"]) input[data-bl="name"]').fill('Other bills'); R.ok(/Remaining\s+R 5 500,00/.test(nb(await page.locator('#bres').innerText())), 'rename a custom bill keeps the total');
  await page.click('[data-act="b-save"]'); await page.waitForTimeout(400); const fin = await store('finance');
  R.ok(fin.some((x) => x.type === 'budget' && x.totals.remaining === 550000), 'month saved to the finance store');
  await page.click('[data-act="open"][data-id="mbudget"]').catch(() => {}); await page.selectOption('[data-b="currency"]', 'USD'); res = nb(await page.locator('#bres').innerText());
  R.ok(/Remaining\s+\$5,500.00/.test(res), 'currency switch relabels without converting', res.match(/Remaining[^\n]*/)?.[0]); await page.selectOption('[data-b="currency"]', 'ZAR');
  await page.selectOption('[data-b="days"]', { index: 1 }); res = nb(await page.locator('#bres').innerText()); R.ok(/counted as 3\d days/.test(res), 'actual days in month can be chosen and is stated', res.match(/A month is counted as \d+ days/)?.[0]); await page.selectOption('[data-b="days"]', '30');
  await page.click('[data-act="b-del"]'); R.ok(/Remaining\s+R 6 200,00/.test(nb(await page.locator('#bres').innerText())), 'remove a custom bill updates totals');
  await page.click('[data-act="close"]');
  // calculator
  await page.click('[data-act="open"][data-id="calc"]'); await page.fill('[data-c="expr"]', '(2 + 3) × 4 + 15%'); R.ok(/^23/.test(nb(await page.locator('#cres').innerText())), 'calculator: exact maths with brackets and %');
  await page.click('[data-act="ctab"][data-id="vat"]'); await page.fill('[data-c="amount"]', '1000'); let c = nb(await page.locator('#cres').innerText()); R.ok(/R 1 000,00 excl\. · R 150,00 VAT · R 1 150,00 incl\./.test(c) && /VAT = 15% × R 1 000,00 = R 150,00/.test(c), 'VAT 15% with working', c);
  await page.selectOption('[data-c="mode"]', 'remove'); await page.fill('[data-c="amount"]', '1150'); R.ok(/R 1 000,00 excl\./.test(nb(await page.locator('#cres').innerText())), 'remove VAT');
  await page.click('[data-act="ctab"][data-id="wages"]'); await page.fill('[data-c="hours"]', '50'); await page.fill('[data-c="rate"]', '30'); c = nb(await page.locator('#cres').innerText()); R.ok(/^R 1 575,00/.test(c) && /Overtime: 5 h × R 30,00 × 1.5 = R 225,00/.test(c), 'wages with overtime and working', c);
  await page.click('[data-act="ctab"][data-id="margin"]'); await page.fill('[data-c="cost"]', '60'); await page.fill('[data-c="price"]', '100'); R.ok(/R 40,00 profit · 40% margin/.test(nb(await page.locator('#cres').innerText())), 'margin');
  await page.click('[data-act="ctab"][data-id="pl"]'); await page.fill('[data-c="revenue"]', '50000'); await page.fill('[data-c="cogs"]', '20000'); await page.fill('[data-c="expenses"]', '35000'); R.ok(/R 5 000,00 loss/.test(nb(await page.locator('#cres').innerText())), 'profit and loss');
  await page.click('[data-act="ctab"][data-id="proj"]'); await page.fill('[data-c="start"]', '1000'); await page.fill('[data-c="monthly"]', '500'); await page.fill('[data-c="growth"]', '1'); R.ok(/R 7 468,08/.test(nb(await page.locator('#cres').innerText())), 'projection');
  await page.click('[data-act="close"]');
  // affordability (uses the saved month: R5,500 left)
  await page.click('[data-act="open"][data-id="afford"]'); await page.fill('[data-a="amount"]', '2000'); let a = nb(await page.locator('#ares').innerText());
  R.ok(/^BUY \(R 2 000,00\)/.test(a) && /saved monthly budget leaves R 5 500,00/.test(a), 'affordability: BUY with reasons from saved figures', a);
  await page.fill('[data-a="amount"]', '9000'); a = nb(await page.locator('#ares').innerText()); R.ok(/^WAIT|^AVOID/.test(a) && /Missing: .*savings/.test(a), 'larger amount → WAIT/AVOID, and missing info listed', a.split('\n')[0]);
  await page.click('[data-act="close"]');
  // staff
  await page.click('#tabs [data-tab="biz"]'); await page.click('[data-act="bizview"][data-id="staff"]'); await page.click('[data-act="open"][data-id="person"]'); await page.fill('[name="name"]', 'Thandi'); await page.fill('[name="rate"]', '40'); await page.click('#sheet form button:not([type=button])'); await page.waitForTimeout(200);
  await page.click('[data-act="open"][data-id="person"]'); await page.fill('[name="name"]', 'Sipho'); await page.click('#sheet form button:not([type=button])'); await page.waitForTimeout(200);
  const days = await page.evaluate(() => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return Array.from({ length: 6 }, (_, i) => { const x = new Date(d); x.setDate(d.getDate() + i); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; }); });
  for (const [i, d] of days.entries()) { await page.click('[data-act="open"][data-id="shift"]'); await page.selectOption('[name="staff"]', { label: 'Thandi' }); await page.fill('[name="date"]', d); await page.fill('[name="start"]', i === 5 ? '08:00' : '07:00'); await page.fill('[name="end"]', i === 5 ? '12:00' : '17:00'); await page.fill('[name="break_min"]', i === 5 ? '0' : '30'); await page.click('#sheet form button:not([type=button])'); await page.waitForTimeout(150); }
  await page.click('[data-act="open"][data-id="shift"]'); await page.selectOption('[name="staff"]', { label: 'Sipho' }); await page.fill('[name="date"]', days[0]); await page.fill('[name="start"]', '09:00'); await page.fill('[name="end"]', '13:00'); await page.fill('[name="break_min"]', '0'); await page.click('#sheet form button:not([type=button])'); await page.waitForTimeout(200);
  const st = nb(await page.locator('#screen').innerText()); R.ok(/Thandi\s+6 shifts · 51.5 h · 6.5 h overtime/.test(st) && /R 2 190,00/.test(st), 'timesheet: hours, overtime and wages from entered shifts', st.match(/Thandi[^\n]*\n[^\n]*/)?.[0]);
  R.ok(/Sipho\s+1 shift · 4 h/.test(st) && /add rate/.test(st), 'no hourly rate → no invented wage');
  // chat answers come from the calculator
  await page.click('#tabs [data-tab="home"]'); await page.click('.ask');
  let r = await say('Can I afford R2,000 for a new phone?'); R.ok(/^BUY — new phone \(R 2 000,00\)/.test(r), 'chat: "Can I afford…" answered by the calculator', r.split('\n')[0]);
  r = await say('What is 15% of R2000?'); R.ok(/^300\n15% of 2,?000/.test(r) || /^300\n/.test(r), 'chat: percentages', r);
  r = await say('add VAT to R1000'); R.ok(/R 1 150,00 incl\. VAT/.test(r), 'chat: VAT', r.split('\n')[0]);
  r = await say('How much is left this month?'); R.ok(/R 5 500,00 left/.test(r) && /30-day month/.test(r), 'chat: monthly budget summary', r.split('\n')[0]);
  r = await say('How many hours did staff work this week?'); R.ok(/Thandi: 51.5 h \(6.5 h overtime\), wages R 2 190,00/.test(r) && /Sipho: 4 h, no hourly rate entered/.test(r), 'chat: staff hours and wages', r);
  r = await say('(1200 + 350) / 3'); R.ok(/^516.666667/.test(r), 'chat: plain sums', r.split('\n')[0]);
  await page.click('[data-act="close"]');
  // persistence
  await ctx.close(); await open(); R.ok((await store('staff')).length === 9 && (await store('finance')).some((x) => x.type === 'budget'), 'staff, shifts and saved months survive a restart');
  R.ok(!errors.length, 'no JavaScript errors', errors.join(' | '));
} catch (e) { R.ok(false, 'unexpected error', e.stack); }
try { await ctx.close(); } catch {} srv.close(); rmSync(dir, { recursive: true, force: true }); process.exit(R.finish() ? 0 : 1);
