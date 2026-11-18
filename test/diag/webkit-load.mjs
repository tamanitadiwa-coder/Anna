// Anna in real WebKit (WebKitGTK MiniBrowser via WebDriver). Measures the WebKit content process and proves offline replies.
import { spawn } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { serve } from '/home/user/Anna/test/e2e/serve.mjs';
const PW = 'anna-test-pass-1', OUT = [];
const log = (...a) => { const s = a.join(' '); OUT.push(s); console.log(s); };
function dumpReads(t0, series) { if (!RL.length) return log('reads: none logged'); let sum = 0; const rows = []; let next = 0; for (const r of RL) { sum += +r.n; const ts = (r.t - t0) / 1000; if (ts >= next) { rows.push(`${ts.toFixed(0)}s reads=${RL.indexOf(r) + 1} bytesMB=${(sum / 1048576).toFixed(0)} heapMB=${(+r.heap / 1048576).toFixed(0)} lastReqMB=${(+r.n / 1048576).toFixed(2)}`); next = ts + 5; } } log('reads total', RL.length, 'MB', (sum / 1048576).toFixed(0)); log(rows.join('\n')); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
import { execSync } from 'node:child_process'; try { execSync('pkill -9 -f WebKitWebProcess; pkill -9 -f MiniBrowser; pkill -9 -f WebKitWebDriver; pkill -9 -f WebKitNetworkProcess; pkill -9 Xvfb'); } catch {} await sleep(500);
const xvfb = spawn('Xvfb', [':99', '-screen', '0', '1280x1024x24'], { stdio: 'ignore' }); await sleep(800);
const drv = spawn('WebKitWebDriver', ['--port=4444'], { stdio: 'ignore', env: { ...process.env, DISPLAY: ':99', ...(process.env.JSCENV ? Object.fromEntries(process.env.JSCENV.split(',').map((kv) => kv.split('='))) : {}) } }); await sleep(1200);
import { createServer } from 'node:http';
const RL = []; const logSrv = createServer((q, r) => { const u = new URL(q.url, 'http://x'); RL.push({ t: Date.now(), ...Object.fromEntries(u.searchParams) }); r.writeHead(204, { 'access-control-allow-origin': '*' }); r.end(); }).listen(18092, '127.0.0.1');
let app = await serve('/home/user/Anna/_site', 18090), cdn = await serve('/home/user/models', 18091, '/cdn/');
const W = async (method, path, body) => { const r = await fetch('http://127.0.0.1:4444' + path, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); const j = await r.json(); if (j.value?.error) throw new Error(j.value.error + ': ' + j.value.message); return j.value; };
const sess = await W('POST', '/session', { capabilities: { alwaysMatch: { 'webkitgtk:browserOptions': { binary: '/usr/lib/x86_64-linux-gnu/webkit2gtk-4.1/MiniBrowser', args: ['--automation', '--features=+FileSystem,+FileSystemWritableStream,+StorageAPI,+StorageAPIEstimate'] } } } });
const sid = sess.sessionId; log('WebKit session', sess.capabilities.browserName, sess.capabilities.browserVersion);
const js = (fn, ...args) => W('POST', `/session/${sid}/execute/async`, { script: `const done = arguments[arguments.length-1]; Promise.resolve((${fn})(...Array.from(arguments).slice(0,-1))).then((v) => done({ ok: v }), (e) => done({ err: String(e && (e.message + ' | ' + e.stack) || e) }));`, args }).then((v) => { if (v?.err) throw new Error(v.err); return v?.ok; });
await W('POST', `/session/${sid}/timeouts`, { script: 3600000, pageLoad: 60000 });
const wkRss = () => { let t = 0; for (const p of readdirSync('/proc').filter((x) => /^\d+$/.test(x))) { try { if (!/WebKitWebProcess/.test(readFileSync(`/proc/${p}/cmdline`, 'utf8'))) continue; t = Math.max(t, +readFileSync(`/proc/${p}/status`, 'utf8').match(/VmRSS:\s+(\d+)/)[1] / 1024); } catch {} } return Math.round(t); };
const waitFor = (cond, ms) => js(`(c, ms) => new Promise((res, rej) => { const t0 = Date.now(); const iv = setInterval(() => { try { if (new Function('return (' + c + ')')()) { clearInterval(iv); res(true); } else if (Date.now() - t0 > ms) { clearInterval(iv); rej(new Error('timeout: ' + c + ' state=' + (window.__anna && window.__anna.AI.ai.state) + ' stage=' + (window.__anna && window.__anna.AI.ai.stage) + ' err=' + (window.__anna && window.__anna.AI.ai.error))); } } catch (e) {} }, 250); })`, cond, ms);
async function openAndUnlock(online) {
  await W('POST', `/session/${sid}/url`, { url: 'http://127.0.0.1:18090/Anna/' }); log('step: url');
  log('probe', JSON.stringify(await js(() => ({ href: location.href, anna: !!window.__anna, html: document.body.innerHTML.slice(0, 200) }))));
  await waitFor('window.__anna', 30000); log('step: anna');
  await js(() => { window.__anna.AI.MODEL.url = 'http://127.0.0.1:18091/cdn/qwen.gguf'; });
  await js(async (pw) => { const q = (s) => document.querySelector(s); if (q('[data-act="meet"]')) q('[data-act="meet"]').click(); await new Promise((r) => setTimeout(r, 200)); const f = q('form[data-form="setup"]') || q('form[data-form="unlock"]'); f.querySelector('[name="pw"]').value = pw; if (f.querySelector('[name="pw2"]')) f.querySelector('[name="pw2"]').value = pw; f.requestSubmit(); }, PW);
  await waitFor('!window.__anna.locked', 30000);
  await js(() => document.querySelector('#tabs [data-tab="brain"]').click());
  await waitFor("['absent','cached','partial'].includes(window.__anna.AI.ai.state)", 60000);
}
async function ask(q) {
  const t0 = Date.now();
  await js((q) => { document.querySelector('[data-act="chat-open"]').click(); return new Promise((r) => setTimeout(() => { const ta = document.querySelector('.chatin textarea'); ta.value = q; ta.form.requestSubmit(); r(); }, 300)); }, q);
  await waitFor("window.__anna.S.chat.length && window.__anna.S.chat.at(-1).role === 'assistant' && window.__anna.S.chat.at(-1).at && !window.__anna.AI.ai.busy", 900000);
  const a = await js(() => { const m = window.__anna.S.chat.at(-1); document.querySelector('[data-act="close"]')?.click(); return { text: m.content, error: m.error || '' }; });
  return { ...a, s: ((Date.now() - t0) / 1000).toFixed(1) };
}
try {
  await openAndUnlock(true);
  const caps = await js(() => ({ ua: navigator.userAgent, jspi: typeof WebAssembly.Suspending, coi: self.crossOriginIsolated, sab: typeof SharedArrayBuffer, sharedMem: (() => { try { new WebAssembly.Memory({ initial: 1, maximum: 65536, shared: true }); return 'ok'; } catch (e) { return 'FAILS: ' + e.message; } })(), state: window.__anna.AI.ai.state }));
  log('caps', JSON.stringify(caps));
  if (process.env.INSTR) await js(() => { const OB = Blob; const P = function (parts, opts) { if (parts && typeof parts[0] === 'string' && parts[0].includes('getHeapU8().set(bytes, out_ptr);')) { parts = [parts[0].replace('getHeapU8().set(bytes, out_ptr);', "getHeapU8().set(bytes, out_ptr); try { fetch('http://127.0.0.1:18092/r?o=' + offset + '&n=' + req_size + '&got=' + bytes.length + '&heap=' + getHeapU8().length); } catch (e) {}")]; } return new OB(parts, opts); }; P.prototype = OB.prototype; window.Blob = P; });
  if (process.env.ENGINE) {
    const cfg = JSON.parse(process.env.ENGINE);
    await js(async () => { const r = await fetch('http://127.0.0.1:18091/cdn/qwen.gguf'); window.__model = await r.blob(); return window.__model.size; }).then((n) => log('model blob', n), (e) => log('blob err', e.message));
    const base = wkRss(); let peak = base; const series = []; const t0 = Date.now(); const iv = setInterval(() => { const r = wkRss(); peak = Math.max(peak, r); series.push(`${((Date.now() - t0) / 1000).toFixed(0)}s:${r}`); }, 500);
    log('step: engine start'); await js((cfg) => { window.__res = null; window.__phase = 'start'; (async (cfg) => { const out = { cfg }; const abs = (x) => new URL(x, document.baseURI).href; const m = await (await fetch('vendor/manifest.json')).json(); const mod = await import(abs(m.engine.entry));
      const wasm = new Blob([await (await fetch(abs(m.engine.compat.wasm))).arrayBuffer()], { type: 'application/wasm' }), wurl = URL.createObjectURL(wasm);
      const logs = []; const lg = (...a) => logs.push(String(a[0]).slice(0, 120)); const w = new mod.Wllama({ default: abs(m.engine.wasm) }, { logger: { debug: () => {}, log: lg, info: lg, warn: lg, error: lg } }); w.setCompat({ wasm: wurl, worker: abs(m.engine.compat.worker) });
      let t = performance.now(); window.__logs = logs; window.__phase = 'loading'; try { await w.loadModel([window.__model], { ...cfg, n_gpu_layers: 0 }); } catch (e) { out.loadErr = String(e); out.logs = logs.slice(-8); return out; } window.__phase = 'self-test';
      out.loadMs = Math.round(performance.now() - t); out.compat = w.getWorkerResources().compat; out.buffers = logs.filter((l) => /buffer size/.test(l));
      t = performance.now(); const r = await w.createChatCompletion({ messages: [{ role: 'user', content: 'Reply with exactly one short friendly greeting.' }], max_tokens: 16, temperature: 0 }); out.selfTest = r.choices[0].message.content; out.selfTestMs = Math.round(performance.now() - t); window.__w = w; return out; })(cfg).then((r) => { window.__res = r; }, (e) => { window.__res = { err: String(e) }; }); }, cfg);
    let res = null, lastPhase = ''; while (!res) { await sleep(3000); let st; try { st = await js(() => ({ res: window.__res, phase: window.__phase, last: (window.__logs || []).slice(-1)[0] })); } catch (e) { dumpReads(t0, series); log('POLL FAILED (web process gone?)', e.message, 'elapsed', ((Date.now() - t0) / 1000).toFixed(0) + 's', 'peakMB', peak); log('series', series.filter((_, i) => i % 4 === 0).join(' ')); throw new Error('stop'); } if (st.phase !== lastPhase) { lastPhase = st.phase; log('phase', st.phase, ((Date.now() - t0) / 1000).toFixed(0) + 's', 'rss', wkRss(), st.last || ''); } res = st.res; if (Date.now() - t0 > Number(process.env.CAP_MS || 1500000) || peak > Number(process.env.CAP_MB || 1e9)) { log('CAPPED at', ((Date.now() - t0) / 1000).toFixed(0) + 's', 'peak', peak, 'phase', st.phase); break; } }
    dumpReads(t0, series); clearInterval(iv); log('engine', JSON.stringify({ ...res, webProcessMB: { base, peak, after: wkRss() } })); log('series', series.filter((_, i) => i % 4 === 0).join(' '));
    if (res.selfTest) {
      app.srv.closeAllConnections?.(); app.srv.close(); cdn.srv.closeAllConnections?.(); cdn.srv.close(); await sleep(500);
      log('network', await js(() => fetch('http://127.0.0.1:18090/Anna/app.js?x=' + Date.now(), { cache: 'no-store' }).then(() => 'REACHABLE', () => 'off (servers stopped)')));
      log('offline-reply', JSON.stringify(await js(async () => { const t = performance.now(); const r = await window.__w.createChatCompletion({ messages: [{ role: 'system', content: 'You are Anna, a private assistant running offline on the user’s phone. Be warm, clear and brief.' }, { role: 'user', content: 'Give me one tip for saving money.' }], max_tokens: 48, temperature: 0.4 }); return { text: r.choices[0].message.content, ms: Math.round(performance.now() - t) }; })));
    }
    throw new Error('engine done'); }
  if (process.env.OPFS) { log('opfs', JSON.stringify(await js(async () => { const out = {}; out.est = await navigator.storage.estimate().catch((e) => String(e)); out.persist = await navigator.storage.persist?.().catch((e) => String(e));
    const code = `onmessage = async (e) => { const r = {}; try { const d = await navigator.storage.getDirectory(); for (const mb of e.data) { const fh = await d.getFileHandle('t' + mb, { create: true }); const h = await fh.createSyncAccessHandle(); const buf = new Uint8Array(1 << 20); let w = 0; try { for (let i = 0; i < mb; i++) w += h.write(buf, { at: i << 20 }); h.flush(); r['mb' + mb] = 'ok ' + w; } catch (er) { r['mb' + mb] = 'FAIL at ' + w + ': ' + er.name + ' ' + er.message; } h.close(); await d.removeEntry('t' + mb); } } catch (er) { r.err = er.name + ' ' + er.message; } postMessage(r); };`;
    const w = new Worker(URL.createObjectURL(new Blob([code], { type: 'text/javascript' }))); out.worker = await new Promise((res) => { w.onmessage = (e) => res(e.data); w.onerror = (e) => res('worker error ' + e.message); w.postMessage([10, 100, 420]); }); return out; }))); throw new Error('opfs done'); }
  if (process.env.RAW) { log('raw', JSON.stringify(await js(async () => { const m = await import(new URL('vendor/wllama/index.js', document.baseURI).href); const cm = new m.CacheManager(); const out = {}; try { await cm.download('http://127.0.0.1:18091/cdn/qwen.gguf', { progressCallback: (p) => { out.p = p.loaded; } }); out.ok = true; out.list = (await cm.list()).map((e) => [e.name, e.size]); } catch (e) { out.err = String(e) + ' | ' + (e && e.stack); out.name = e && e.name; } return out; }))); throw new Error('raw done'); }
  if (caps.state !== 'cached') { const t = Date.now(); await js(() => document.querySelector('[data-act="ai-download"]').click()); await waitFor("['cached','absent','partial'].includes(window.__anna.AI.ai.state) && !window.__anna.AI.ai.progress", 900000); log('download+verify', ((Date.now() - t) / 1000).toFixed(0) + 's', JSON.stringify(await js(() => ({ s: window.__anna.AI.ai.state, e: window.__anna.AI.ai.error, v: window.__anna.AI.ai.info.verified })))); }
  const base = wkRss(); let peak = base; const series = []; const t0 = Date.now(); const iv = setInterval(() => { const r = wkRss(); peak = Math.max(peak, r); series.push(`${((Date.now() - t0) / 1000).toFixed(0)}s:${r}`); }, 1000);
  await js(() => { window.__st = []; let last = ''; setInterval(() => { const a = window.__anna.AI.ai, s = a.stage || a.state; if (s !== last) { last = s; window.__st.push(s + '@' + ((Date.now() - window.__t0) / 1000).toFixed(1)); } }, 100); window.__t0 = Date.now(); document.querySelector('[data-act="ai-load"]').click(); });
  await waitFor("['ready','cached','absent'].includes(window.__anna.AI.ai.state) && !window.__anna.AI.ai.stage", Number(process.env.LOAD_MS || 900000)).catch((e) => log('LOAD WAIT:', e.message));
  clearInterval(iv);
  const r = await js(() => ({ state: window.__anna.AI.ai.state, error: window.__anna.AI.ai.error, info: window.__anna.AI.ai.info, stages: window.__st }));
  log('load', JSON.stringify({ state: r.state, error: r.error, loadS: ((Date.now() - t0) / 1000).toFixed(1), selfTest: r.info.selfTest, stages: r.stages, webProcessMB: { base, peak, after: wkRss() } }));
  log('series', series.filter((_, i) => i % 3 === 0).join(' '));
  if (r.state === 'ready') {
    log('online', JSON.stringify(await ask('In one sentence, what is a budget?')));
    app.srv.closeAllConnections?.(); app.srv.close(); cdn.srv.closeAllConnections?.(); cdn.srv.close(); await sleep(500);
    log('servers stopped; fetch app now:', await js(() => fetch('http://127.0.0.1:18090/Anna/app.js?x=' + Date.now(), { cache: 'no-store' }).then(() => 'reachable', () => 'unreachable')));
    log('offline', JSON.stringify(await ask('Give me one tip for saving money.')));
  }
} catch (e) { log('ERROR', e.message.slice(0, 600)); }
try { await W('DELETE', `/session/${sid}`); } catch {}
try { execSync('pkill -9 -f WebKitWebProcess; pkill -9 -f MiniBrowser; pkill -9 -f WebKitNetworkProcess'); } catch {} drv.kill(); xvfb.kill(); try { app.srv.close(); cdn.srv.close(); } catch {}
process.exit(0);
