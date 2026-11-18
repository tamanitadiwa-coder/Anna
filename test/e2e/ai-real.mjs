// REAL offline-AI test: the genuine Qwen2.5-0.5B-Instruct GGUF, driven through Anna's own UI.
//  1 download (via the real Hugging Face URL; bytes served from a local copy unless ANNA_REAL_HF=1) → 2 SHA-256 verified
//  3 load + self-test → 4 answer a question → 5 cut the internet (app server stopped, Hugging Face blocked)
//  6 answer again → 7 restart the browser while offline → 8 model still installed → 9 load + answer offline again.
// Usage: node test/e2e/ai-real.mjs [--safari-engine]   env ANNA_MODEL_FILE=/path/to/model.gguf  ANNA_REAL_HF=1
import { existsSync, rmSync, mkdtempSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os'; import { join } from 'node:path';
import { pw, reporter, SAFARI_ENGINE } from './lib.mjs';
import { serve } from './serve.mjs';
import { MODEL } from '../../ai.js';
const safari = process.argv.includes('--safari-engine'), realHF = process.env.ANNA_REAL_HF === '1', FILE = process.env.ANNA_MODEL_FILE || '/home/user/models/qwen.gguf';
const R = reporter('ai-real' + (safari ? '-safari-engine' : '') + (realHF ? '-hf' : ''));
if (!realHF && !existsSync(FILE)) { console.error('Model file not found: ' + FILE + ' (set ANNA_MODEL_FILE or ANNA_REAL_HF=1)'); process.exit(2); }
const SITE = new URL('../../_site', import.meta.url).pathname, dir = mkdtempSync(join(tmpdir(), 'anna-ai-'));
let { srv, url } = await serve(SITE, 0);
// Stand-in for Hugging Face's CDN: huggingface.co answers with a 302 redirect to it, exactly like the real site does.
const cdn = realHF ? null : await serve(FILE.replace(/\/[^/]+$/, ''), 0, '/cdn/');
let internet = true;
async function open() {
  const ctx = await pw.chromium.launchPersistentContext(dir, { viewport: { width: 430, height: 932 }, deviceScaleFactor: 1, ignoreHTTPSErrors: realHF && !!process.env.HTTPS_PROXY, ...(realHF && process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY, bypass: '127.0.0.1,localhost' } } : {}), args: [] });
  if (safari) await ctx.addInitScript(SAFARI_ENGINE);
  await ctx.route('https://huggingface.co/**', async (route) => {
    if (!internet) return route.abort('internetdisconnected');
    if (realHF) return route.continue();
    if (route.request().url() !== MODEL.url) return route.abort();
    R.note(`model request: ${route.request().method()} ${route.request().url().slice(0, 90)}…`);
    return route.fulfill({ status: 302, headers: { location: cdn.url + FILE.split('/').pop(), 'access-control-allow-origin': '*', 'x-linked-size': String(statSync(FILE).size) } });
  });
  const page = ctx.pages()[0] || await ctx.newPage(); page.on('pageerror', (e) => R.note('pageerror: ' + e.message)); page.on('dialog', (d) => d.accept());
  return { ctx, page };
}
const st = (page) => page.evaluate(() => ({ state: window.__anna.AI.ai.state, error: window.__anna.AI.ai.error, info: window.__anna.AI.ai.info, busy: window.__anna.AI.ai.busy }));
const waitState = (page, want, ms) => page.waitForFunction((w) => w.includes(window.__anna?.AI.ai.state), want, { timeout: ms, polling: 500 });
async function ask(page, q) {
  const before = await page.evaluate(() => window.__anna.S.chat.length);
  await page.fill('.chatin textarea', q); await page.click('#send'); const t0 = Date.now();
  await page.waitForFunction((n) => { const c = window.__anna.S.chat; return c.length >= n + 2 && !window.__anna.AI.ai.busy && c.at(-1).at; }, before, { timeout: 300000, polling: 500 });
  const a = await page.evaluate(() => window.__anna.S.chat.at(-1)), shown = await page.locator('.bub.assistant').last().innerText();
  return { text: a.content, error: a.error, ms: Date.now() - t0, shown };
}
const evidence = { model: { ...MODEL }, engine: safari ? 'compat build (Safari path, JSPI hidden)' : 'default build', source: realHF ? 'live huggingface.co' : 'local copy served at the real Hugging Face URL', answers: [] };
try {
  let { ctx, page } = await open();
  await page.goto(url); await page.waitForFunction(() => window.__anna, null, { timeout: 30000 });
  await page.evaluate(async () => { const r = await navigator.serviceWorker.ready; return !!r.active; });
  await page.click('[data-tab="brain"]'); await waitState(page, ['absent'], 30000);
  R.ok(await page.locator('#pill').innerText() === 'Not installed', 'Brain shows "Not installed" before download');
  // 1-2: download + SHA-256
  let t = Date.now(); await page.click('[data-act="ai-download"]');
  await page.waitForFunction(() => ['downloading', 'verifying'].includes(window.__anna.AI.ai.state), null, { timeout: 30000 });
  const sawPct = await page.locator('#pill').innerText(); R.ok(/Downloading|Verifying/.test(sawPct), 'download progress shown', sawPct);
  await page.waitForFunction(() => window.__anna.AI.ai.state === 'verifying', null, { timeout: 900000, polling: 200 }).then(() => R.ok(true, 'SHA-256 verification phase shown'), () => R.ok(false, 'SHA-256 verification phase shown'));
  await waitState(page, ['cached', 'absent', 'partial'], 900000); let s = await st(page);
  R.ok(s.state === 'cached', 'model downloaded and stored in OPFS', s.error); R.ok(s.info.bytes === MODEL.bytes, 'stored size is exactly ' + MODEL.bytes + ' bytes', s.info.bytes);
  R.ok(s.info.verified && s.info.sha256 === MODEL.sha256, 'SHA-256 of stored file equals published checksum', s.info.sha256);
  evidence.downloadSeconds = Math.round((Date.now() - t) / 1000);
  R.ok((await page.locator('#pill').innerText()) === 'Installed · not loaded', 'pill says Installed · not loaded');
  // 3: load + self-test
  t = Date.now(); await page.click('[data-act="ai-load"]'); await waitState(page, ['ready', 'cached', 'absent'], 300000); s = await st(page);
  R.ok(s.state === 'ready', 'model loaded and marked ready', s.error); R.ok(s.info.arch === 'qwen2', 'loaded architecture is qwen2', s.info.arch);
  R.ok(!!s.info.selfTest?.reply, 'readiness self-test produced real text', s.info.selfTest?.reply); evidence.load = { seconds: Math.round((Date.now() - t) / 1000), selfTest: s.info.selfTest, modelName: s.info.modelName };
  await page.waitForFunction(() => window.__anna.AI.ai.info.warmMs, null, { timeout: 300000, polling: 500 }).catch(() => {}); s = await st(page); R.ok(s.info.warmTokens > 50, 'system prompt + data pre-read in the background after loading', `${s.info.warmTokens} tokens in ${s.info.warmMs} ms`); evidence.warm = { tokens: s.info.warmTokens, ms: s.info.warmMs };
  R.ok(await page.locator('.ok').count() === 1, 'UI shows "Self-test passed"');
  // 4: ask online (general question + a question about the user's own data)
  await page.evaluate(() => { const S = window.__anna.S; S.tx.push({ id: 'e1', kind: 'expense', amount_cents: 45000, category: 'Groceries', occurred_at: Date.now() }, { id: 'e2', kind: 'income', amount_cents: 1200000, category: 'Salary', occurred_at: Date.now() }); S.mem.push({ id: 'm1', content: 'My sister Lindiwe’s birthday is on 3 March', category: 'Family', status: 'confirmed', created_at: Date.now() }); });
  await page.click('[data-act="chat-open"] >> nth=0');
  for (const q of ['In one sentence, what is an emergency fund?', 'How much did I spend on groceries this month?']) {
    const a = await ask(page, q); evidence.answers.push({ phase: 'online', q, ...a });
    R.ok(a.text && !a.error && a.text.length > 5, `ONLINE answer to "${q}"`, `${(a.ms / 1000).toFixed(1)}s: ${a.text || a.error}`);
    R.ok(a.shown.includes(a.text.slice(0, 20)), 'answer is rendered in the chat bubble');
  }
  // 5-6: disconnect the internet entirely: stop the app server AND block Hugging Face
  internet = false; srv.closeAllConnections?.(); await new Promise((r) => srv.close(r)); if (cdn) { cdn.srv.closeAllConnections?.(); await new Promise((r) => cdn.srv.close(r)); } await ctx.setOffline(true);
  R.ok(await page.evaluate(() => !navigator.onLine), 'browser reports offline (app server stopped, Hugging Face blocked)');
  for (const q of ['When is my sister Lindiwe’s birthday?', 'Give me two quick tips to stick to a monthly budget.']) {
    const a = await ask(page, q); evidence.answers.push({ phase: 'offline', q, ...a });
    R.ok(a.text && !a.error, `OFFLINE answer to "${q}"`, `${(a.ms / 1000).toFixed(1)}s: ${a.text || a.error}`);
  }
  R.ok(/March|3/.test(evidence.answers.at(-2).text), 'offline answer used saved memory (birthday = 3 March)', evidence.answers.at(-2).text);
  const chatLen = await page.evaluate(() => window.__anna.S.chat.length);
  // unload works
  await page.click('[data-act="close"]'); await page.click('[data-act="ai-unload"]'); await waitState(page, ['cached'], 60000); R.ok(true, 'Unload returns to "Installed · not loaded"');
  // 7-9: restart the browser while still offline
  await ctx.close(); ({ ctx, page } = await open()); await ctx.setOffline(true);
  await page.goto(url).catch((e) => R.note('goto: ' + e.message)); const loaded = await page.waitForFunction(() => window.__anna, null, { timeout: 30000 }).then(() => true, () => false);
  R.ok(loaded, 'after restart with no internet, Anna opens from the offline cache');
  if (loaded) {
    R.ok((await page.evaluate(() => window.__anna.S.chat.length)) === chatLen, 'conversation history survived the restart', chatLen);
    await page.click('[data-tab="brain"]'); await waitState(page, ['cached', 'absent', 'partial'], 60000); s = await st(page);
    R.ok(s.state === 'cached' && s.info.verified, 'model still installed and verified after restart', s.state);
    await page.click('[data-act="ai-load"]'); await waitState(page, ['ready', 'cached', 'absent'], 300000); s = await st(page);
    R.ok(s.state === 'ready', 'model loads again with no internet', s.error);
    await page.click('[data-act="chat-open"] >> nth=0');
    const a = await ask(page, 'What is 15% of R2000? Answer briefly.'); evidence.answers.push({ phase: 'offline after restart', q: 'What is 15% of R2000?', ...a });
    R.ok(a.text && !a.error, 'OFFLINE answer after restart', `${(a.ms / 1000).toFixed(1)}s: ${a.text || a.error}`);
    const d = await page.evaluate(() => window.__anna.runDiagnostics()); evidence.diagnostics = d;
    R.ok(/VERDICT: Ready for offline use/.test(d), 'offline diagnostics verdict: ready', d.split('\n').at(-1));
  }
  await ctx.close();
} catch (e) { R.ok(false, 'unexpected error', e.stack); }
try { srv.close(); cdn?.srv.close(); } catch {}
rmSync(dir, { recursive: true, force: true });
process.exit(R.finish({ evidence }) ? 0 : 1);
