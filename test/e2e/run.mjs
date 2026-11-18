// Runs every browser test suite (Playwright, Chromium with iPhone 15 emulation) and writes test-results/summary.json.
// The AI engine itself needs WebGPU and a real device; routing.mjs uses a stand-in engine to test everything around it.
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { RESULTS } from './lib.mjs';
const runs = [['ui.mjs'], ['ui.mjs', 'desktop'], ['life.mjs'], ['reminders.mjs'], ['money.mjs'], ['books.mjs'], ['routing.mjs'], ['offline.mjs']];
spawnSync(process.execPath, ['scripts/build.mjs'], { stdio: 'inherit' });
const sum = [];
for (const r of runs) { console.log(`\n=== ${r.join(' ')} ===`); const p = spawnSync(process.execPath, [new URL(r[0], import.meta.url).pathname, ...r.slice(1)], { stdio: 'inherit', env: process.env }); sum.push({ run: r.join(' '), exit: p.status }); }
writeFileSync(RESULTS + 'summary.json', JSON.stringify(sum, null, 1)); console.log('\n' + sum.map((s) => `${s.exit === 0 ? 'PASS' : 'FAIL'}  ${s.run}`).join('\n'));
process.exit(sum.every((s) => s.exit === 0) ? 0 : 1);
