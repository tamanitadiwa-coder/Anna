# ANNA — engineering handover (v0.4.0)

Last updated: 2026-11-18. Branch: `claude/anna-completion-deployment-t9c6gw`. Read this first if you are continuing the work.

## 1. State in one paragraph
Anna v0.4.0 is feature-complete and tested in Chromium, including the **genuine Qwen2.5-0.5B-Instruct model** working end-to-end through the UI, offline, and after a browser restart (also via the Safari engine path, and downloading from live Hugging Face). **Not yet done:** (a) pushing to GitHub: the Claude GitHub App had read-only access to `tamanitadiwa-coder/Anna` (git push: 403 *Resource not accessible by integration*), so the code was delivered as ZIPs; (b) the live site still serves v0.3.0 until `main` is updated; (c) physical iPhone 15 verification (no hardware), see `docs/IPHONE-COMPATIBILITY.md`.

## 2. Recovery findings (what this session started from)
- Both uploaded archives (`anna-web_44.zip` dev, `anna-web-built.zip` built) were **v0.3.0** and byte-identical to the repo's files. **No v0.4.0 code had survived**; there was no HANDOVER or v0.4.0 report in any file. The v0.4.0 feature list from the previous session's chat report was therefore re-implemented on top of v0.3.0.
- The repo on GitHub was missing `icons/`, `test/`, `scripts/`, `.github/` (restored from the dev archive in commit `f621262`).
- Original archives are preserved unchanged in the deliverables (`anna-original-archives-backup.zip`).
- **Model host failure root cause:** the previous sandbox's network policy blocked `huggingface.co` (a proxy 403), and Hugging Face now redirects downloads to `us.aws.cdn.hf.co`. Hugging Face itself works and sends correct CORS headers for `https://tamanitadiwa-coder.github.io` on both hops (verified with curl and in a real browser download).
- **Repo owner:** `tamanitadiwa-coder` is correct (`tamanity-coder.github.io/Anna` is a 404). The live site `https://tamanitadiwa-coder.github.io/Anna/` is served by GitHub Pages "deploy from branch" (`main`, root).
- wllama 3.5.1 has no standalone `tokenize()` export (as the previous session found); Anna does not need it. The old "AI READY" could be shown without a generation: fixed, ready now requires a real self-test answer.

## 3. Done in v0.4.0 (all tested; see docs/TEST-REPORT.md)
ZAR default (R 1 234,56) and comma-decimal input · black & silver theme and icons · edit + delete (with Undo) for tasks, entries, budgets, bills, business records, memories · reminders (date, time, repeat, complete, alerts while open, notifications, .ics calendar export, missed-reminder notice) · business search · paid-bill history + undo · chat history persisted, in backups, readable without the model, Stop button · backup restore with preview, verification and undo · offline diagnostics with verdict · 44 px touch targets, fixed switch overlap · model pinned to an HF commit, SHA-256 verified (streaming JS hash), loaded from OPFS only, ready only after a real generation · prompt pre-warm (KV cache) · engine vendored in the repo so `main` is directly deployable · CI workflow.

## 4. To finish (in order)
1. **Give Claude write access** (or push yourself): install/repair the Claude GitHub App for `tamanitadiwa-coder/Anna` with write permission (https://github.com/apps/claude/installations/select_target), or reconnect GitHub at https://claude.ai/connect-github. Then push branch `claude/anna-completion-deployment-t9c6gw`.
   - Without Claude, with git: `git clone https://github.com/tamanitadiwa-coder/Anna && cd Anna && git pull /path/to/anna-v0.4.0.gitbundle claude/anna-completion-deployment-t9c6gw && git push origin HEAD:main` (keeps the full commit history).
   - Without Claude, in the browser only: unzip `anna-v0.4.0-dev.zip`, open the repo on github.com → **Add file → Upload files**, drag in **everything inside the `anna/` folder** (including the `vendor`, `icons`, `docs`, `test`, `scripts` and `.github` folders), commit to `main`. Then delete the old root files that no longer exist (`build.mjs`, `logic.test.mjs`). Note: the browser uploader may skip files starting with a dot (`.nojekyll`, `.gitignore`, `.github/`); the site still works without them, but the CI workflow needs `.github/workflows/ci.yml`.
2. **Deploy:** merge the branch into `main`. Pages (deploy from branch `main` / root) publishes automatically within ~1 minute. No Pages settings change is needed.
3. **Verify live:** open https://tamanitadiwa-coder.github.io/Anna/ and check `vendor/manifest.json` returns JSON, then run `ANNA_LIVE=https://tamanitadiwa-coder.github.io/Anna/ node test/e2e/live.mjs` (checks every file, the version, offline start and the engine cache on the real site).
4. **iPhone 15:** follow the checklist in `docs/IPHONE-COMPATIBILITY.md` and record times + the diagnostics report.

## 5. Commands
```bash
npm ci && npm test                         # 33 unit/build tests
npm run build && npm run serve             # http://127.0.0.1:8080/Anna/
node test/e2e/ui.mjs [desktop]             # 116 UI checks (Playwright Chromium)
ANNA_MODEL_FILE=/path/qwen.gguf node test/e2e/ai-real.mjs [--safari-engine]
ANNA_REAL_HF=1 node test/e2e/ai-real.mjs   # downloads from live Hugging Face
node test/e2e/ai-failures.mjs              # cancel / corrupt / dropped / recovery
npm run e2e                                 # all of the above
```
Get the model for tests: `curl -L -o qwen.gguf <MODEL.url from ai.js>` then `sha256sum qwen.gguf` must equal `6eb923e7d26e9cea28811e1a8e852009b21242fb157b26149d3b188f3a8c8653`.
In Claude cloud sessions run Node network scripts with `NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt`. Cloud sessions need these hosts allowed: `huggingface.co`, `us.aws.cdn.hf.co` (HF's CDN), `tamanitadiwa-coder.github.io`. A personal environment named **"Anna"** with these hosts was created in this session.

## 6. Known limitations (by design / platform)
- iPhone web apps cannot alert while closed (no local scheduled notifications without a push server) → Calendar .ics export.
- Single-threaded CPU inference (GitHub Pages cannot send COOP/COEP; Safari uses the compat build): answers take seconds, not milliseconds.
- A 0.5B model can be wrong; numbers are taken from the user's data, but the UI tells users to check.
- Home Screen app and Safari tab have separate storage.

## 7. Ideas for later (not started)
Optional larger model choice for desktop; Web Push via a tiny server for closed-app reminders; recurring transactions; CSV export of money records.
