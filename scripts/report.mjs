// Generates docs/TEST-REPORT.md from the machine-written results in test-results/ (nothing is typed in by hand).
import { readFileSync, existsSync, writeFileSync, readdirSync } from 'node:fs';
const R = 'test-results/', j = (f) => (existsSync(R + f) ? JSON.parse(readFileSync(R + f, 'utf8')) : null);
const unit = existsSync(R + 'unit.txt') ? readFileSync(R + 'unit.txt', 'utf8') : '';
const up = +(unit.match(/# pass (\d+)/) || [])[1], uf = +(unit.match(/# fail (\d+)/) || [])[1];
const suites = [['ui-iphone-15.json', 'UI, every screen and control', 'Chromium, iPhone 15 emulation (393×852, touch, iOS UA)'], ['ui-desktop.json', 'UI, every screen and control', 'Chromium desktop 1280×860'],
  ['ai-real.json', 'Genuine model end-to-end (fast engine build)', 'Chromium; model served at the real HF URL from a verified local copy'], ['ai-real-safari-engine.json', 'Genuine model end-to-end (Safari engine build)', 'Chromium with JSPI hidden → wllama compat build used by Safari'],
  ['ai-real-hf.json', 'Genuine model end-to-end, downloaded from live huggingface.co', 'Chromium through the internet'], ['ai-failures.json', 'Model download failure paths', 'Chromium, Safari engine build'],
  ['live-site-before-deploy.json', 'Live production site (before this release is deployed)', 'https://tamanitadiwa-coder.github.io/Anna/'], ['live-site.json', 'Live production site', 'https://tamanitadiwa-coder.github.io/Anna/']];
const L = [`# Anna v0.4.0 — test report`, '', `Generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC by \`node scripts/report.mjs\` from \`test-results/*.json\` (written by the test scripts themselves). Every number below comes from an executed run.`, '',
  '## Summary', '', '| Suite | Environment | Result | Run |', '|---|---|---|---|', `| Unit + build tests (\`npm test\`) | Node 22 | **${up}/${up + uf}** ${uf ? '❌' : '✅'} | — |`];
const seen = [];
for (const [f, what, env] of suites) { const d = j(f); if (!d) continue; seen.push([f, what, d]); L.push(`| ${what} | ${env} | **${d.passed}/${d.total}** ${d.passed === d.total ? '✅' : '❌'} | ${d.when.slice(0, 16).replace('T', ' ')} (${d.seconds}s) |`); }
L.push('', '## Not tested (no hardware / not available)', '', '- **Physical iPhone 15, real Safari, Home Screen install**: no device available. Mobile results above are Chromium emulation (layout/touch only). Use the checklist in `docs/IPHONE-COMPATIBILITY.md`.', '- **WebKit engine**: Playwright WebKit was not available in the environment. The Safari *engine path* of the AI (wllama compat build) was exercised in Chromium.', '- **iPhone model memory / speed**: not measurable without the device. Test-machine numbers are in `docs/MODEL.md`.', '');
const ev = (j('ai-real-hf.json') || j('ai-real-safari-engine.json') || j('ai-real.json'))?.evidence;
if (ev) {
  L.push('## Genuine offline AI evidence', '', `Model: ${ev.model.name} ${ev.model.quant}, HF commit \`${ev.model.revision}\`, ${ev.model.bytes} bytes, SHA-256 \`${ev.model.sha256}\`. Engine: ${ev.engine}. Source: ${ev.source}.`, '');
  if (ev.load) L.push(`Load: ${ev.load.seconds}s including the readiness self-test, which answered: “${ev.load.selfTest?.reply}”. Model name read from the GGUF: ${ev.load.modelName}.`, '');
  L.push('| Phase | Question | Answer (verbatim) | Time |', '|---|---|---|---|');
  for (const a of ev.answers) L.push(`| ${a.phase} | ${a.q} | ${(a.text || a.error || '').replace(/\n/g, ' ').replace(/\|/g, '\\|')} | ${(a.ms / 1000).toFixed(1)}s |`);
  L.push('', '“offline” = the app server was shut down, huggingface.co was blocked and the browser was set offline. “offline after restart” = the browser was closed and reopened with no network; Anna loaded from its service-worker cache and the model from OPFS.', '');
  if (ev.diagnostics) L.push('Diagnostics produced by Anna after the offline restart:', '', '```', ev.diagnostics, '```', '');
}
for (const [f, what, d] of seen) { L.push(`## ${what} — ${d.passed}/${d.total}`, '', `File: \`test-results/${f}\`${d.note ? ' · ' + d.note : ''}`, '', '<details><summary>All checks</summary>', '', ...d.checks.map((c) => `- ${c.ok ? '✅' : '❌'} ${c.what}${c.detail ? ` — ${c.detail.replace(/\n/g, ' ').slice(0, 160)}` : ''}`), '', '</details>', ''); }
writeFileSync('docs/TEST-REPORT.md', L.join('\n')); console.log('docs/TEST-REPORT.md written:', seen.map(([f, , d]) => `${f} ${d.passed}/${d.total}`).join(', '));
