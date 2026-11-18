// Copies the 4 AI engine files from node_modules into vendor/ (committed, so the repository root is a complete,
// deployable site that also works with GitHub Pages "deploy from branch"). `--check` only verifies vendor/ is up to date.
import { cpSync, mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const FILES = [
  ['node_modules/@wllama/wllama/esm/index.js', 'vendor/wllama/index.js'],
  ['node_modules/@wllama/wllama/esm/wasm/wllama.wasm', 'vendor/wllama/wllama.wasm'],
  ['node_modules/@wllama/wllama-compat/wasm/wllama.js', 'vendor/wllama-compat/wllama.js'],
  ['node_modules/@wllama/wllama-compat/wasm/wllama.wasm', 'vendor/wllama-compat/wllama.wasm'],
];
const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const check = process.argv.includes('--check'), missing = FILES.filter(([s]) => !existsSync(s)).map(([s]) => s);
if (missing.length) { console.error('Missing (run npm ci):', missing.join(', ')); process.exit(1); }
const version = JSON.parse(readFileSync('node_modules/@wllama/wllama/package.json', 'utf8')).version;
const manifest = { engine: { ok: true, version, missing: [], entry: FILES[0][1], wasm: FILES[1][1], compat: { worker: FILES[2][1], wasm: FILES[3][1] }, files: FILES.map(([, d]) => d), sha256: Object.fromEntries(FILES.map(([s, d]) => [d, sha(s)])) } };
const text = JSON.stringify(manifest, null, 1) + '\n';
if (check) {
  const bad = FILES.filter(([s, d]) => !existsSync(d) || sha(d) !== sha(s)).map(([, d]) => d);
  if (!existsSync('vendor/manifest.json') || readFileSync('vendor/manifest.json', 'utf8') !== text) bad.push('vendor/manifest.json');
  if (bad.length) { console.error('vendor/ is out of date with node_modules:', bad.join(', '), '\nRun: npm run vendor'); process.exit(1); }
  console.log(`vendor/ OK: wllama ${version}, ${FILES.length} engine files match node_modules.`);
} else {
  for (const [s, d] of FILES) { mkdirSync(d.replace(/\/[^/]+$/, ''), { recursive: true }); cpSync(s, d); }
  writeFileSync('vendor/manifest.json', text); console.log(`vendor/ written: wllama ${version}, ${FILES.length} files.`);
}
