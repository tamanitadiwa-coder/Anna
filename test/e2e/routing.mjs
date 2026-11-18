// Chat routing in the real UI (spec §6), with a stand-in engine (no GPU here): each route answers from its tool,
// Qwen only re-phrases (numbers kept), research is honest offline, and the AI engine never loads twice.
import { mkdtempSync, rmSync } from 'node:fs'; import { tmpdir } from 'node:os'; import { join } from 'node:path';
import { pw, reporter, ready } from './lib.mjs'; import { serve } from './serve.mjs';
import { PHRASES } from './phrases.mjs';
const R = reporter('routing'), dir = mkdtempSync(join(tmpdir(), 'anna-route-')); const { srv, url } = await serve(new URL('../../_site', import.meta.url).pathname, 0);
const { defaultBrowserType, ...dev } = pw.devices['iPhone 15'];
const FAKE = `const F = (window.__fake = { created: 0, reloads: 0, unloads: 0, loaded: 0, maxLoaded: 0, prompts: [] });
export const hasModelInCache = async () => true; export const deleteModelAllInfoInCache = async () => {};
export class MLCEngine { constructor() { F.created++; this.on = false; this.chat = { completions: { create: (o) => this.create(o) } }; }
  async reload() { if (this.on) { this.on = false; F.loaded--; } F.reloads++; await new Promise((r) => setTimeout(r, 300)); this.on = true; F.loaded++; F.maxLoaded = Math.max(F.maxLoaded, F.loaded); }
  async unload() { if (this.on) { this.on = false; F.loaded--; } F.unloads++; } interruptGenerate() {}
  async create(o) { const u = o.messages.at(-1).content; F.prompts.push(u); const k = "Exact answer from ANNA's tools: ";
    const out = /greeting/.test(u) ? 'Hello!' : u.includes(k) ? 'Of course, Jamal. ' + u.split(k)[1].split('\\nSay this')[0] : /introduce it/.test(u) ? 'Here you go, Jamal.' : 'I hear you, Jamal.';
    if (!o.stream) return { choices: [{ message: { content: out } }] };
    return (async function* () { for (const w of out.split(/(?= )/)) yield { choices: [{ delta: { content: w } }] }; })(); } }`;
let ctx, page; const errors = [];
const nb = (s) => s.replace(/[\u00a0\u202f]/g, ' ');
const say = async (t) => { await page.fill('.chatin textarea', t); await page.click('#send'); await page.waitForFunction(() => !window.__anna.AI.ai.busy); await page.waitForTimeout(250); return page.evaluate(() => { const m = window.__anna.S.chat.at(-1); return { tool: m.tool || 'qwen', content: m.content, facts: m.facts || '' }; }); };
const submit = () => page.click('#sheet form button:not([type=button])');
try {
  ctx = await pw.chromium.launchPersistentContext(dir, { ...dev, deviceScaleFactor: 1, timezoneId: 'Africa/Johannesburg', serviceWorkers: 'block' });
  await ctx.addInitScript(() => { Object.defineProperty(navigator, 'gpu', { configurable: true, value: { requestAdapter: async () => ({ features: new Set(['shader-f16']) }) } }); });
  await ctx.route('**/vendor/manifest.json', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ engine: { ok: true, name: 'WebLLM', version: 'test', entry: 'vendor/fake-engine.js', files: [] } }) }));
  await ctx.route('**/vendor/fake-engine.js', (r) => r.fulfill({ contentType: 'text/javascript', body: FAKE }));
  page = ctx.pages()[0] || await ctx.newPage(); page.on('pageerror', (e) => errors.push(e.message)); page.on('dialog', (d) => d.accept()); await page.goto(url); await ready(page);
  // data for memory + journal routes (entered through the UI)
  await page.click('#tabs [data-tab="brain"]'); await page.click('[data-act="bview"][data-id="journal"]');
  await page.click('[data-act="open"][data-id="journal"]'); await page.click('.moodopt:has-text("Good")'); await page.fill('[name="text"]', 'PRIVATE-TEXT good day'); await submit(); await page.waitForTimeout(200);
  await page.click('[data-act="bview"][data-id="mem"]').catch(() => {}); await page.click('[data-act="open"][data-id="mem"]'); await page.fill('[name="content"]', 'My sister is called Naledi'); await submit(); await page.waitForTimeout(200);
  // the AI never loads twice
  await page.evaluate(async () => { const A = window.__anna.AI; await A.refresh(); await Promise.all([A.load(), A.load(), A.load()]); });
  let F = await page.evaluate(() => ({ ...window.__fake, prompts: 0 }));
  R.ok(F.created === 1 && F.reloads === 1 && F.maxLoaded === 1 && await page.evaluate(() => window.__anna.AI.ai.state) === 'ready', 'three load taps at once → one engine, one load', JSON.stringify(F));
  await page.evaluate(async () => { const A = window.__anna.AI; for (let i = 0; i < 3; i++) { await A.unload(); await A.load(); } await A.load(); });
  F = await page.evaluate(() => ({ ...window.__fake, prompts: 0 }));
  R.ok(F.created === 1 && F.reloads === 4 && F.maxLoaded === 1 && F.loaded === 1, 'unload → reload ×3: same engine reused, never two models in memory, load while ready does nothing', JSON.stringify(F));
  // routes: 3 phrases each, in the chat
  await page.click('#tabs [data-tab="home"]'); await page.click('.ask');
  for (const [want, ps] of Object.entries(PHRASES)) {
    const got = [];
    for (const p of ps) { const r = await say(p); got.push(r.tool); if (want === 'reminders') await page.click('[data-act="rq-cancel"]').catch(() => {}); if (r.tool !== want) R.note(`${p} → ${r.tool}: ${r.content.slice(0, 120)}`); }
    R.ok(got.every((x) => x === want), `route ${want}: ${ps.length} phrases answered by ${want}`, got.join(', '));
  }
  // tool first, then Qwen phrases
  let r = await say('What time is it in London?'); R.ok(/^Of course, Jamal\. It’s \d\d:\d\d in London/.test(r.content) && r.facts && r.tool === 'clock', 'Qwen phrases the clock answer, exact time kept', r.content);
  r = await say('(1200 + 350) / 3'); R.ok(/516.666667/.test(nb(r.content)), 'calculator result survives phrasing', r.content);
  r = await say('What did I tell you about my sister?'); R.ok(/Naledi/.test(r.content) && r.tool === 'memory', 'memory answer comes from saved memories', r.content);
  r = await say('How did I feel this week?'); R.ok(/good/i.test(r.content) && /1 with a mood|Average mood: 4/.test(r.content) && r.tool === 'journal', 'journal answer from moods', r.content);
  R.ok(!(await page.evaluate(() => window.__fake.prompts.some((p) => /PRIVATE-TEXT/.test(p)))), 'journal text is never put in a prompt by routing');
  r = await say('What is the weather in Cape Town tomorrow?'); R.ok(/isn’t switched on yet/.test(r.content) && r.tool === 'research' && !r.facts, 'online without an approved service: says so, no fake search', r.content);
  await ctx.setOffline(true); r = await say('What is the latest news?'); R.ok(/needs internet/.test(r.content) && /offline/.test(r.content), 'offline: research needs internet, never faked', r.content);
  R.ok(!(await page.evaluate(() => window.__fake.prompts.some((p) => /weather|latest news/i.test(p)))), 'current-events questions never go to Qwen to guess');
  r = await say('Tell me a story'); R.ok(r.tool === 'qwen' && /I hear you/.test(r.content), 'everything else → Qwen (works offline)', r.content);
  await ctx.setOffline(false);
  R.ok(!errors.length, 'no JavaScript errors', errors.join(' | '));
} catch (e) { R.ok(false, 'unexpected error', e.stack); }
try { await ctx.close(); } catch {} srv.close(); rmSync(dir, { recursive: true, force: true }); process.exit(R.finish() ? 0 : 1);
