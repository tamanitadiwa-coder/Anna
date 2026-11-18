// Builds _site/: exactly the files the browser needs (app + icons + vendored AI engine). Used for tests and the production ZIP.
// The repository root itself is also a valid site (GitHub Pages "deploy from branch"); _site/ is the clean version of it.
import { cpSync, rmSync, mkdirSync, existsSync, readFileSync, writeFileSync, statSync } from 'node:fs';
export const APP = ['index.html', 'app.js', 'ai.js', 'logic.js', 'sha256.js', 'auth.js', 'life.js', 'time.js', 'money.js', 'router.js', 'styles.css', 'sw.js', 'manifest.webmanifest', '.nojekyll', '404.html'];
const pkg = JSON.parse(readFileSync('package.json', 'utf8')), man = JSON.parse(readFileSync('vendor/manifest.json', 'utf8'));
const missing = [...APP, 'icons', 'fonts/jost.woff2', 'vendor/manifest.json', ...man.engine.files].filter((f) => !existsSync(f));
if (missing.length) { console.error('Cannot build, missing:', missing.join(', ')); process.exit(1); }
// Versions must agree, or phones would keep an old cached copy.
const ver = (f, re) => (readFileSync(f, 'utf8').match(re) || [])[1];
const vs = { 'package.json': pkg.version, 'app.js': ver('app.js', /VERSION = '([^']+)'/), 'sw.js': ver('sw.js', /VERSION = '([^']+)'/) };
if (new Set(Object.values(vs)).size !== 1) { console.error('Version mismatch:', vs); process.exit(1); }
rmSync('_site', { recursive: true, force: true }); mkdirSync('_site', { recursive: true });
for (const f of [...APP, 'icons', 'fonts', 'lib', 'vendor']) cpSync(f, `_site/${f}`, { recursive: true });
const size = man.engine.files.reduce((n, f) => n + statSync(f).size, 0);
console.log(`Built _site/ for Anna Web ${pkg.version}. AI engine: ${man.engine.name || 'engine'} ${man.engine.version}, ${man.engine.files.length} files ready (${(size / 1e6).toFixed(1)} MB).`);
