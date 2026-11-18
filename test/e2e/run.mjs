// Runs every browser test and writes test-results/summary.json. The real-model tests need the model file
// (ANNA_MODEL_FILE, default /home/user/models/qwen.gguf) or ANNA_REAL_HF=1 to download it from Hugging Face.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { RESULTS } from './lib.mjs';
const model = process.env.ANNA_REAL_HF === '1' || existsSync(process.env.ANNA_MODEL_FILE || '/home/user/models/qwen.gguf');
const runs = [['ui.mjs'], ['ui.mjs', 'desktop'], ...(model ? [['ai-real.mjs'], ['ai-real.mjs', '--safari-engine'], ['ai-failures.mjs']] : [])];
if (!model) console.log('NOTE: model file not found, skipping real-model tests (set ANNA_MODEL_FILE or ANNA_REAL_HF=1).');
spawnSync(process.execPath, ['scripts/build.mjs'], { stdio: 'inherit' });
const sum = [];
for (const r of runs) { console.log(`\n=== ${r.join(' ')} ===`); const p = spawnSync(process.execPath, [new URL(r[0], import.meta.url).pathname, ...r.slice(1)], { stdio: 'inherit', env: process.env }); sum.push({ run: r.join(' '), exit: p.status }); }
writeFileSync(RESULTS + 'summary.json', JSON.stringify(sum, null, 1)); console.log('\n' + sum.map((s) => `${s.exit === 0 ? 'PASS' : 'FAIL'}  ${s.run}`).join('\n'));
process.exit(sum.every((s) => s.exit === 0) ? 0 : 1);
