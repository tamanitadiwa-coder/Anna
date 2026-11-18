// AI failure paths with the real model file: cancelled download, corrupted bytes (checksum mismatch), dropped connection,
// and recovery (a clean download afterwards still works). Nothing partial or damaged may ever be reported as installed.
import { mkdtempSync, rmSync, statSync, createReadStream } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os'; import { join } from 'node:path';
import { pw, reporter, SAFARI_ENGINE, ready, TEST_PW } from './lib.mjs';
import { serve } from './serve.mjs';
import { MODEL } from '../../ai.js';
const FILE = process.env.ANNA_MODEL_FILE || '/home/user/models/qwen.gguf', SIZE = statSync(FILE).size;
const R = reporter('ai-failures'), SITE = new URL('../../_site', import.meta.url).pathname, dir = mkdtempSync(join(tmpdir(), 'anna-fail-'));
const { srv, url } = await serve(SITE, 0);
let mode = 'good';
// CDN stand-in that can misbehave: 'corrupt' flips one byte, 'drop' cuts the connection at 30%, 'slow' throttles (for cancel).
const cdn = createServer((req, res) => {
  const h = { 'content-type': 'application/octet-stream', 'content-length': SIZE, 'access-control-allow-origin': '*' };
  if (req.method === 'OPTIONS') { res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }); return res.end(); }
  res.writeHead(200, h); if (req.method === 'HEAD') return res.end();
  let sent = 0; const st = createReadStream(FILE, { highWaterMark: 1 << 20 });
  st.on('data', (c) => {
    if (mode === 'corrupt' && sent <= 5e6 && sent + c.length > 5e6) { c = Buffer.from(c); c[5e6 - sent] ^= 0xff; }
    sent += c.length;
    if (mode === 'drop' && sent > SIZE * 0.3) { st.destroy(); res.socket.destroy(); return; }
    if (!res.write(c)) { st.pause(); res.once('drain', () => (mode === 'slow' ? setTimeout(() => st.resume(), 40) : st.resume())); } else if (mode === 'slow') { st.pause(); setTimeout(() => st.resume(), 40); }
  });
  st.on('end', () => res.end()); req.on('close', () => st.destroy());
}).listen(0, '127.0.0.1');
await new Promise((r) => cdn.once('listening', r)); const cdnUrl = `http://127.0.0.1:${cdn.address().port}/model.gguf`;
const ctx = await pw.chromium.launchPersistentContext(dir, { viewport: { width: 430, height: 932 } }); await ctx.addInitScript(SAFARI_ENGINE);
await ctx.route('https://huggingface.co/**', (route) => route.fulfill({ status: 302, headers: { location: cdnUrl, 'access-control-allow-origin': '*' } }));
const page = ctx.pages()[0] || await ctx.newPage(); page.on('dialog', (d) => d.accept());
const st = () => page.evaluate(() => ({ state: window.__anna.AI.ai.state, error: window.__anna.AI.ai.error, info: window.__anna.AI.ai.info }));
const waitState = (w, ms = 900000) => page.waitForFunction((w) => w.includes(window.__anna.AI.ai.state), w, { timeout: ms, polling: 300 });
const stored = () => page.evaluate(async () => { const d = await navigator.storage.getDirectory(); let n = 0, bytes = 0; const walk = async (h) => { for await (const [, e] of h.entries()) { if (e.kind === 'file') { n++; bytes += (await e.getFile()).size; } else await walk(e); } }; await walk(d); return { n, bytes }; });
try {
  await page.goto(url); await ready(page); await page.click('[data-tab="brain"]'); await waitState(['absent'], 30000);
  // cancel
  mode = 'slow'; await page.click('[data-act="ai-download"]'); await page.waitForFunction(() => (window.__anna.AI.ai.progress?.loaded || 0) > 2e6, null, { timeout: 120000 });
  await page.click('[data-act="ai-cancel"]'); await waitState(['absent', 'partial'], 60000); let s = await st();
  R.ok(s.state === 'absent' && /cancelled/i.test(s.error), 'Cancel download: state Not installed, message says nothing was kept', s.error);
  let o = await stored(); R.ok(o.bytes < 1e6, 'cancelled download leaves no model bytes in storage', JSON.stringify(o));
  // corrupt
  mode = 'corrupt'; await page.click('[data-act="ai-download"]'); await waitState(['absent', 'cached', 'partial']); s = await st();
  R.ok(s.state === 'absent' && /Checksum mismatch/.test(s.error), 'corrupted download is detected by SHA-256 and rejected', s.error);
  o = await stored(); R.ok(o.bytes < 1e6, 'corrupted file was deleted', JSON.stringify(o));
  R.ok(!(await page.evaluate(() => localStorage.getItem('anna-web:model-verified'))), 'no verification record kept for the bad file');
  // dropped connection
  mode = 'drop'; await page.click('[data-act="ai-download"]'); await waitState(['absent', 'cached', 'partial']); s = await st();
  R.ok(s.state === 'absent' && s.error, 'dropped connection: download fails safely with a message', s.error);
  o = await stored(); R.ok(o.bytes < 1e6, 'partial file from dropped connection was deleted', JSON.stringify(o));
  // offline before starting
  await ctx.setOffline(true); await page.click('[data-act="ai-download"]'); await page.waitForTimeout(500); R.ok(/offline/i.test(await page.locator('#toast').innerText()), 'download while offline is refused with a clear message'); await ctx.setOffline(false);
  // recovery
  mode = 'good'; await page.click('[data-act="ai-download"]'); await waitState(['absent', 'cached', 'partial']); s = await st();
  R.ok(s.state === 'cached' && s.info.verified, 'a clean download afterwards succeeds and verifies', s.error);
  // tampering after install is caught at load time
  await page.evaluate(() => localStorage.removeItem('anna-web:model-verified')); await page.reload(); await ready(page); await page.click('[data-tab="brain"]'); await waitState(['cached'], 60000);
  await page.click('[data-act="ai-load"]'); await waitState(['ready', 'absent', 'cached'], 600000); s = await st();
  R.ok(s.state === 'ready' && s.info.verified, 'if the verification record is lost, the file is re-hashed before loading', s.error);
  // delete
  await page.click('[data-act="ai-delete"]'); await waitState(['absent'], 60000); o = await stored(); R.ok(o.bytes < 1e6, 'Delete model frees the storage', JSON.stringify(o));
} catch (e) { R.ok(false, 'unexpected error', e.stack); }
await ctx.close(); srv.close(); cdn.close(); rmSync(dir, { recursive: true, force: true });
process.exit(R.finish() ? 0 : 1);
