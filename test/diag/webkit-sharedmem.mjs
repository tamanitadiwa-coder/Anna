import { spawn } from 'node:child_process'; import { readFileSync, readdirSync } from 'node:fs';
import { serve } from '/home/user/Anna/test/e2e/serve.mjs';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const xvfb = spawn('Xvfb', [':99', '-screen', '0', '1280x1024x24'], { stdio: 'ignore' }); await sleep(800);
const drv = spawn('WebKitWebDriver', ['--port=4444'], { stdio: 'ignore', env: { ...process.env, DISPLAY: ':99' } }); await sleep(1200);
const app = await serve('/home/user/Anna/_site', 18090);
const W = async (m, p, b) => (await (await fetch('http://127.0.0.1:4444' + p, { method: m, headers: { 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined })).json()).value;
const rss = () => { let t = 0; for (const p of readdirSync('/proc').filter((x) => /^\d+$/.test(x))) { try { if (!/WebKitWebProcess/.test(readFileSync(`/proc/${p}/cmdline`, 'utf8'))) continue; t = Math.max(t, +readFileSync(`/proc/${p}/status`, 'utf8').match(/VmRSS:\s+(\d+)/)[1] / 1024); } catch {} } return Math.round(t); };
for (const [label, desc] of [['non-shared max 4GB', { initial: 2048, maximum: 65536 }], ['shared max 4GB', { initial: 2048, maximum: 65536, shared: true }], ['shared max 1GB', { initial: 2048, maximum: 16384, shared: true }], ['shared max 2GB', { initial: 2048, maximum: 32768, shared: true }]]) {
  const sid = (await W('POST', '/session', { capabilities: { alwaysMatch: { 'webkitgtk:browserOptions': { binary: '/usr/lib/x86_64-linux-gnu/webkit2gtk-4.1/MiniBrowser', args: ['--automation'] } } } })).sessionId;
  await W('POST', `/session/${sid}/url`, { url: 'http://127.0.0.1:18090/Anna/404.html' }); await sleep(1500); const before = rss();
  const r = await W('POST', `/session/${sid}/execute/sync`, { script: `try { window.__m = new WebAssembly.Memory(arguments[0]); return 'ok ' + window.__m.buffer.byteLength / 1048576 + 'MB'; } catch (e) { return 'FAIL ' + e.message; }`, args: [desc] });
  await sleep(1500); const after = rss();
  const g = await W('POST', `/session/${sid}/execute/sync`, { script: `try { window.__m.grow(4096); return 'grew to ' + window.__m.buffer.byteLength / 1048576 + 'MB'; } catch (e) { return 'grow FAIL ' + e.message; }`, args: [] }); await sleep(1000);
  console.log(`${label.padEnd(20)} create: ${r}  RSS ${before} -> ${after} MB (+${after - before}); ${g}; RSS now ${rss()} MB`);
  await W('DELETE', `/session/${sid}`); await sleep(800);
}
drv.kill(); xvfb.kill(); app.srv.close(); process.exit(0);
