// Creates the deliverable archives in deliverables/ and verifies each one opens and contains the expected files.
// anna-v<ver>-dev.zip         complete project (every committed file + test-results), ready to unzip into the repo
// anna-v<ver>-production.zip  exactly the website (_site/): upload the contents to any static host
// anna-v<ver>.gitbundle       the git history, so the commits can be pushed: git pull anna-v<ver>.gitbundle <branch>
import { execFileSync as x } from 'node:child_process';
import { mkdirSync, rmSync, readFileSync, existsSync, statSync, writeFileSync } from 'node:fs';
const v = JSON.parse(readFileSync('package.json', 'utf8')).version, D = 'deliverables', run = (c, a, o = {}) => x(c, a, { stdio: ['ignore', 'pipe', 'inherit'], ...o }).toString();
mkdirSync(D, { recursive: true });
x(process.execPath, ['scripts/build.mjs'], { stdio: 'inherit' });
const dev = `${D}/anna-v${v}-dev.zip`, prod = `${D}/anna-v${v}-production.zip`, bundle = `${D}/anna-v${v}.gitbundle`;
for (const f of [dev, prod, bundle]) rmSync(f, { force: true });
run('git', ['archive', '--format=zip', '--prefix=anna/', '-o', dev, 'HEAD']);
if (existsSync('test-results')) { const t = `${D}/.tmp`; rmSync(t, { recursive: true, force: true }); mkdirSync(`${t}/anna`, { recursive: true }); run('cp', ['-r', 'test-results', `${t}/anna/`]); run('bash', ['-c', `cd ${t} && zip -qr ${process.cwd()}/${dev} anna/test-results`]); rmSync(t, { recursive: true, force: true }); }
run('bash', ['-c', `cd _site && zip -qr ../${prod} . -x '.DS_Store'`]);
run('git', ['bundle', 'create', bundle, '--all']);
const list = (z) => run('unzip', ['-Z1', z]).split('\n').filter(Boolean);
const need = { [dev]: ['anna/index.html', 'anna/app.js', 'anna/ai.js', 'anna/sha256.js', 'anna/vendor/wllama/wllama.wasm', 'anna/vendor/wllama-compat/wllama.wasm', 'anna/HANDOVER.md', 'anna/docs/TEST-REPORT.md', 'anna/package-lock.json', 'anna/.github/workflows/ci.yml', 'anna/test/e2e/ai-real.mjs'], [prod]: ['index.html', 'app.js', 'sw.js', 'sha256.js', '.nojekyll', 'icons/icon-512.png', 'vendor/manifest.json', 'vendor/wllama/index.js', 'vendor/wllama-compat/wllama.js'] };
const report = [];
for (const [z, files] of Object.entries(need)) { run('unzip', ['-tq', z]); const l = list(z), miss = files.filter((f) => !l.includes(f)); if (miss.length) throw new Error(`${z} is missing ${miss.join(', ')}`); report.push(`${z}: OK, ${l.length} entries, ${(statSync(z).size / 1e6).toFixed(1)} MB, integrity test passed`); }
run('git', ['bundle', 'verify', bundle]); report.push(`${bundle}: OK (git bundle verify), ${(statSync(bundle).size / 1e6).toFixed(1)} MB`);
const sums = run('bash', ['-c', `cd ${D} && sha256sum *.zip *.gitbundle`]); writeFileSync(`${D}/SHA256SUMS.txt`, sums);
console.log(report.join('\n') + '\n' + sums);
