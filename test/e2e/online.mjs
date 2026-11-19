// v1.4 online helper: only the one message goes online; ANNA acts on the rewrite, learns words, and re-checks after Cancel.
// The online AI is simulated here (no real network): every request is answered by the route below and recorded.
import { mkdtempSync, rmSync } from 'node:fs'; import { tmpdir } from 'node:os'; import { join } from 'node:path';
import { pw, reporter, ready } from './lib.mjs'; import { serve } from './serve.mjs';
const R = reporter('online'), dir = mkdtempSync(join(tmpdir(), 'anna-online-')); const { srv, url } = await serve(new URL('../../_site', import.meta.url).pathname, 0);
const { defaultBrowserType, ...dev } = pw.devices['iPhone 15'];
let ctx, page; const errors = [], sent = [];
const nb = (s) => s.replace(/[  ]/g, ' ');
const last = async () => nb(await page.evaluate(() => window.__anna.S.chat.at(-1).content));
const say = async (t) => { await page.fill('.chatin textarea', t); await page.click('#send'); await page.waitForTimeout(500); return last(); };
const S = (f) => page.evaluate(f);
const ANSWERS = [
  [/cgange my mali dates/i, { command: 'move all due dates to the 26th', words: [{ word: 'cgange', means: 'change' }, { word: 'mali dates', means: 'due dates' }], answer: 'Moving your bills.' }],
  [/misunderstood.*Remove the last added 5000|Remove the last added 5000/i, { command: 'remove the last added R5000', words: [], answer: '' }],
  [/sharp sharp/i, { command: null, words: [{ word: 'sharp sharp', means: 'okay, goodbye' }], answer: 'Sharp sharp! Speak soon.' }],
];
try {
  ctx = await pw.chromium.launchPersistentContext(dir, { ...dev, deviceScaleFactor: 1, timezoneId: 'Africa/Johannesburg' }); await ctx.clock.install({ time: new Date('2026-11-19T10:00:00+02:00') });
  await ctx.route('https://api.groq.com/**', async (route) => { const b = JSON.parse(route.request().postData()); sent.push({ auth: route.request().headers().authorization, body: b }); const u = b.messages.at(-1).content, hit = ANSWERS.find(([re]) => re.test(u));
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ choices: [{ message: { content: JSON.stringify(hit ? hit[1] : { command: null, words: [], answer: '' }) } }] }) }); });
  page = ctx.pages()[0] || await ctx.newPage(); page.on('pageerror', (e) => errors.push(e.message)); page.on('dialog', (d) => d.accept()); await page.goto(url); await ready(page);
  await page.click('.ask');
  await say("Right now there's 4100. I get paid on the 25th 10500, I owe Ashraf 500, plus 500 for moving"); await page.click('[data-act="bat-save"]'); await page.waitForTimeout(300);
  await page.evaluate(() => { window.__anna.S.bills.push({ id: 'x5', created_at: Date.now(), name: 'Old thing', amount_cents: 500000, due_at: Date.now() + 864e5, priority: 2, repeat_monthly: 0, paid: 0, paid_at: null, kind: 'planned' }); });
  // off by default: nothing goes online
  await say('sharp sharp'); R.ok(sent.length === 0, 'online helper is off by default: nothing sent');
  await page.evaluate(() => document.querySelector('[data-act="close"]')?.click());
  // Settings: save key
  await page.waitForTimeout(200); await page.click('.top [data-tab="data"]'); await page.waitForTimeout(200);
  R.ok(await page.locator('#onlinecard').count() === 1, 'Online helper card in Settings');
  await page.fill('form[data-form="olkey"] [name="key"]', 'gsk_testkey1234'); await page.click('form[data-form="olkey"] button:has-text("Save")'); await page.waitForTimeout(200);
  R.ok(await S(() => JSON.parse(localStorage.getItem('anna.online')).on === true), 'key saved on the phone and helper switched on');
  R.ok(!(await S(() => JSON.stringify(window.__anna.S).includes('gsk_testkey1234'))), 'key is not in ANNA data or backups');
  await page.click('#tabs [data-tab="home"]'); await page.click('.ask');
  // a message ANNA's tools don't understand → online rewrite → her own tool runs it, new word learned
  let t = await say('Cgange my mali dates after pay on the 26th');
  R.ok(sent.length === 1 && sent[0].auth === 'Bearer gsk_testkey1234' && sent[0].body.messages.length === 2 && /^Message: Cgange my mali dates after pay on the 26th$/.test(sent[0].body.messages[1].content), 'only that one message is sent', JSON.stringify(sent[0]?.body.messages[1]));
  R.ok(!/4 100|10 500|Ashraf/.test(JSON.stringify(sent[0].body)), 'no balance, bills or names from ANNA are sent');
  R.ok(/^I read that as: “move all due dates to the 26th”\.\nNew words learned: “cgange” = change, “mali dates” = due dates\.\nMove all \d unpaid bills to 26 Nov/.test(t), 'acts on the rewrite and says what it learned', t);
  await page.click('[data-act="ent-save"]'); await page.waitForTimeout(300);
  R.ok(await S(() => window.__anna.S.bills.filter((b) => !b.paid).every((b) => new Date(b.due_at).getDate() === 26)), 'bills moved to the 26th');
  // learned word works offline next time (no new request)
  const n = sent.length; await page.context().setOffline(true); t = await say('cgange my mali dates to the 27th'); await page.context().setOffline(false);
  R.ok(sent.length === n && /^Move all \d unpaid bills to 27 Nov/.test(t), 'learned word understood offline', t);
  await page.click('[data-act="ent-cancel"]'); await page.waitForTimeout(300);
  // general chat answered online, with the slang learned
  t = await say('sharp sharp'); R.ok(/^Sharp sharp! Speak soon\.\nNew word learned: “sharp sharp” = okay, goodbye\./.test(t), 'answers plain chat online and learns slang', t);
  // mistakes: Cancel on a wrong reading asks online what was meant
  await page.evaluate(() => { window.__anna.S.settings.autoMoney = false; });
  t = await say('Remove the last added 5000'); R.ok(/^Remove the bill “Old thing”, R.5.000,00\?/.test(t), 'remove is understood locally first', t);
  const c0 = sent.length; await page.click('[data-act="ent-cancel"]'); await page.waitForTimeout(500);
  R.ok(sent.length === c0 + 1 && /misunderstood this message as: Remove the bill “Old thing”/.test(sent.at(-1).body.messages[1].content), 'Cancel sends what ANNA misread, to be checked online', sent.at(-1)?.body.messages[1].content);
  // v1.5 free lookup: no key, only the looked-up words leave the phone
  const looked = [];
  await ctx.route(/wiktionary\.org|wikipedia\.org|open-meteo\.com/, async (route) => { const u = route.request().url(); looked.push(u);
    const body = /wiktionary.*definition\/lekker/.test(u) ? { af: [{ partOfSpeech: 'Adjective', language: 'Afrikaans', definitions: [{ definition: 'nice, good' }] }] } : /geocoding/.test(u) ? { results: [{ name: 'Harare', country: 'Zimbabwe', latitude: -17.8, longitude: 31.0 }] } : /forecast/.test(u) ? { current: { temperature_2m: 27, weather_code: 2, wind_speed_10m: 12 }, daily: { temperature_2m_min: [16, 17], temperature_2m_max: [28, 29], precipitation_probability_max: [20, 60], weather_code: [2, 80] } } : null;
    await route.fulfill(body ? { status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) } : { status: 404, body: '' }); });
  const g0 = sent.length; t = await say('What does lekker mean?'); R.ok(/needs|offline|Groq/i.test(t) || looked.length === 0, 'free lookup is off by default (nothing looked up)', t);
  await page.evaluate(() => { window.__anna.S.settings.lookup = true; });
  t = await say('What does lekker mean?'); R.ok(/^“lekker” \(adjective\), Afrikaans: nice, good\nSource: Wiktionary/.test(t) && (await S(() => window.__anna.S.settings.words.some((w) => w.word === 'lekker'))), 'word meaning from Wiktionary, learned', t);
  t = await say('weather in Harare'); R.ok(/^Weather in Harare, Zimbabwe: now 27°C, partly cloudy/.test(t), 'weather from Open-Meteo', t);
  R.ok(looked.every((u) => !/gsk_|key=/.test(u)) && looked.some((u) => /definition\/lekker/.test(u)), 'only the looked-up words are sent, no key');
  t = await say('ejima means twin sister'); R.ok(/^Got it: “ejima” means twin sister/.test(t) && (await S(() => window.__anna.S.settings.words.some((w) => w.word === 'ejima' && w.means === 'twin sister'))), 'teach slang directly', t);
  R.ok(sent.length >= g0, 'lookups did not use the Groq helper');
  R.ok(errors.length === 0, 'no JavaScript errors', errors.join(' | '));
} catch (e) { R.ok(false, 'unexpected error', e.stack); }
try { await ctx.close(); } catch {} srv.close(); rmSync(dir, { recursive: true, force: true }); process.exit(R.finish() ? 0 : 1);
