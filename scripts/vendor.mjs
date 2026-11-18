// Copies the AI engine (WebLLM, a single self-contained ES module) from node_modules into vendor/ (committed, so the
// repository root is a complete deployable site and the service worker can cache it for Airplane Mode).
// `--check` only verifies vendor/ is up to date. The model itself is downloaded by WebLLM at first use and cached by it.
import { cpSync, mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const FILES = [['node_modules/@mlc-ai/web-llm/lib/index.js', 'vendor/webllm/web-llm.js']];
const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const check = process.argv.includes('--check'), missing = FILES.filter(([s]) => !existsSync(s)).map(([s]) => s);
if (missing.length) { console.error('Missing (run npm ci):', missing.join(', ')); process.exit(1); }
const version = JSON.parse(readFileSync('node_modules/@mlc-ai/web-llm/package.json', 'utf8')).version;
const manifest = { engine: { ok: true, name: 'WebLLM', version, missing: [], entry: FILES[0][1], files: FILES.map(([, d]) => d), sha256: Object.fromEntries(FILES.map(([s, d]) => [d, sha(s)])) } };
const text = JSON.stringify(manifest, null, 1) + '\n';
if (check) {
  const bad = FILES.filter(([s, d]) => !existsSync(d) || sha(d) !== sha(s)).map(([, d]) => d);
  if (!existsSync('vendor/manifest.json') || readFileSync('vendor/manifest.json', 'utf8') !== text) bad.push('vendor/manifest.json');
  if (bad.length) { console.error('vendor/ is out of date with node_modules:', bad.join(', '), '\nRun: npm run vendor'); process.exit(1); }
  console.log(`vendor/ OK: WebLLM ${version}.`);
} else {
  for (const [s, d] of FILES) { mkdirSync(d.replace(/\/[^/]+$/, ''), { recursive: true }); cpSync(s, d); }
  writeFileSync('vendor/manifest.json', text); console.log(`vendor/ written: WebLLM ${version}.`);
}
