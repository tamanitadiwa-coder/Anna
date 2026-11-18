// Generic WebKit engine attempt: node wkeng.mjs <page.html> [label]. Page must define window.__start() -> sets window.__phase, window.__res {reply}, and window.__ask(q) -> Promise<string>.
import { spawn, execSync } from 'node:child_process'; import { readFileSync, readdirSync } from 'node:fs';
import { serve } from '/home/user/Anna/test/e2e/serve.mjs';
const [page, label = page] = process.argv.slice(2), CAP_MB = +(process.env.CAP_MB || 3000), CAP_S = +(process.env.CAP_S || 900);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); const kill = () => { try { execSync("pkill -9 -f '[W]ebKit' ; pkill -9 -f '[M]iniBrowser' ; pkill -9 -x Xvfb ; true"); } catch {} };
kill(); await sleep(500);
const xvfb = spawn('Xvfb', [':99', '-screen', '0', '1280x1024x24'], { stdio: 'ignore' }); await sleep(800);
const drv = spawn('WebKitWebDriver', ['--port=4444'], { stdio: 'ignore', env: { ...process.env, DISPLAY: ':99' } }); await sleep(1200);
const srv = await serve(new URL('./site', import.meta.url).pathname, 18090, '/');
const W = async (m, p, b) => { const j = await (await fetch('http://127.0.0.1:4444' + p, { method: m, headers: { 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined })).json(); if (j.value?.error) throw new Error(j.value.error + ': ' + j.value.message); return j.value; };
const sess = await W('POST', '/session', { capabilities: { alwaysMatch: { 'webkitgtk:browserOptions': { binary: '/usr/lib/x86_64-linux-gnu/webkit2gtk-4.1/MiniBrowser', args: ['--automation', '--features=' + (process.env.FEATURES || '+WebGPU')] } } } }); const sid = sess.sessionId;
await W('POST', `/session/${sid}/timeouts`, { script: 240000, pageLoad: 60000 });
const js = (src, args = []) => W('POST', `/session/${sid}/execute/sync`, { script: src, args });
const mem = () => { const o = { web: 0, gpu: 0 }; for (const p of readdirSync('/proc').filter((x) => /^\d+$/.test(x))) { try { const c = readFileSync(`/proc/${p}/cmdline`, 'utf8'); const r = +readFileSync(`/proc/${p}/status`, 'utf8').match(/VmRSS:\s+(\d+)/)[1] / 1024; if (/WebKitWebProcess/.test(c)) o.web = Math.max(o.web, r); if (/WebKitGPUProcess/.test(c)) o.gpu = Math.max(o.gpu, r); } catch {} } return { web: Math.round(o.web), gpu: Math.round(o.gpu) }; };
let out = { label };
try {
  await W('POST', `/session/${sid}/url`, { url: 'http://127.0.0.1:18090/' + page }); await sleep(1500);
  const base = mem(); let peak = { ...base }; const t0 = Date.now();
  const iv = setInterval(() => { const m = mem(); peak.web = Math.max(peak.web, m.web); peak.gpu = Math.max(peak.gpu, m.gpu); }, 300);
  await js('window.__start(); return 1;');
  let st, last = '';
  while (true) { await sleep(2000); try { st = await js('return { phase: window.__phase, res: window.__res, err: window.__err };'); } catch (e) { out.hang = 'page unresponsive: ' + e.message.slice(0, 80); break; }
    if (st.phase !== last) { last = st.phase; console.log(`  ${((Date.now() - t0) / 1000).toFixed(0)}s ${st.phase} web=${mem().web}MB`); }
    if (st.res || st.err) break; if (peak.web > CAP_MB) { out.capped = `web process > ${CAP_MB} MB`; break; } if (Date.now() - t0 > CAP_S * 1000) { out.capped = 'time > ' + CAP_S + 's'; break; } }
  clearInterval(iv); Object.assign(out, { base, peak, seconds: Math.round((Date.now() - t0) / 1000), ...(st || {}) });
  if (st?.res?.reply) {
    srv.srv.closeAllConnections?.(); srv.srv.close(); await sleep(500);
    await js("window.__off = null; fetch('/x?' + Date.now()).then(() => window.__net = 'REACHABLE', () => window.__net = 'off'); window.__ask('Give me one tip for saving money.').then((t) => window.__off = t, (e) => window.__off = 'ERR ' + e);");
    const t1 = Date.now(); while (Date.now() - t1 < 600000) { await sleep(2000); const o = await js('return { off: window.__off, net: window.__net };').catch(() => null); if (o?.off) { out.offline = { net: o.net, reply: o.off, s: Math.round((Date.now() - t1) / 1000) }; break; } }
    const m = mem(); out.peakAfterOffline = Math.max(peak.web, m.web);
  }
} catch (e) { out.error = e.message.slice(0, 300); }
console.log('RESULT ' + JSON.stringify(out));
kill(); try { srv.srv.close(); } catch {} process.exit(0);
