# Anna v0.4.0 — technical documentation

## Architecture
A static Progressive Web App: plain ES modules, no framework, no build step beyond copying files. Everything runs in the browser; there is no server-side code and no external API except the one-time model download from Hugging Face.

```
index.html ─ app.js (UI, storage, actions, reminders, diagnostics)
               ├─ logic.js   pure functions: money in cents, budgets, bills, business (cash basis), reminders, .ics, backups
               ├─ ai.js      model lifecycle (download → SHA-256 → OPFS → load → self-test → ready), prompts, privacy filter
               │    └─ sha256.js  streaming SHA-256 (hashes 400 MB in 8 MB slices; WebCrypto cannot stream)
               └─ vendor/    wllama 3.5.1 engine: index.js, wllama.wasm (fast build), wllama-compat/{wllama.js,wllama.wasm} (Safari build)
sw.js  service worker: offline cache for app files + engine (separate, version-named engine cache)
```

### Storage (all on the device)
| What | Where | Survives restart | In backups |
|---|---|---|---|
| Tasks, reminders, money, bills, budgets, business, memories, feedback, **chat history**, settings | IndexedDB `anna-web` → store `kv` → key `state` (falls back to localStorage, then memory with a warning banner) | yes | yes |
| Safety copy before restore/erase | IndexedDB key `prev` | yes | no |
| AI model (398 MB) | OPFS (`navigator.storage.getDirectory()/cache`, managed by wllama) | yes | no |
| Model verification record | localStorage `anna-web:model-verified` (sha256 + bytes) | yes | no |
| App + engine files | Cache Storage `anna-web-<version>` and `anna-engine-<wllama version>` | yes | n/a |

Anna calls `navigator.storage.persist()` so the browser is less likely to evict data. The schema is additive-only (`SCHEMA = 1`): every backup from v0.1.0 onward still loads (tested).

### AI lifecycle (ai.js)
States: `unknown → absent → downloading → verifying → cached → loading → ready` (+ `partial`, `unsupported`).
1. **Download**: storage quota check (needs ~1.2 × model size) → wake lock → fetch engine files (so they are cached) → `cacheManager.download()` into OPFS with progress → **SHA-256** of the stored file compared to the pinned checksum. Any failure, cancel or mismatch deletes the file; nothing partial is ever reported as installed.
2. **Load**: re-verify if the verification record is missing → open the OPFS blob → `loadModel([blob])` (never touches the network) → **self-test generation**. Only when the model produces real text is the state `ready`. A flag in localStorage detects iOS killing the page during load and shows a warning next time.
3. **Ask**: streamed chat completion with Stop (AbortSignal). Pre-warm: after loading and when the chat opens, Anna sends the system prompt + data with `max_tokens: 1`; wllama keeps the KV cache, so the user's question only costs its own tokens.
4. **Engine selection**: wllama uses the fast build when the browser has JSPI + memory64 (Chromium), otherwise the compat build (Safari). Anna fetches the needed `.wasm` on the main thread (served by the service worker when offline) and passes a `blob:` URL to the worker, because service-worker control of blob workers differs between browsers.

### Privacy filter (`buildContext`)
Only categories switched on in Brain → *What Anna may read* are given to the model. Never included: transaction notes, customer/supplier names, task notes, memories marked *assumption*. Memories are chosen by word overlap with the question when there are more than 10. *Preview exactly what Anna sees* shows the full block. Nothing is sent anywhere: the model runs locally.

### Reminders
Checked every 15 s while Anna is open and when it returns to the foreground; each occurrence alerts once (in-app toast + system notification if permitted, via `registration.showNotification`). Repeating reminders roll to their next future time when marked done. Reminders that fell due while Anna was closed are announced on next open.
**Limitation (platform):** an iPhone web app cannot run code or schedule local notifications while closed; only server-sent Web Push can wake it, which would require a server and an account. Anna therefore offers **Add to Calendar (.ics with VALARM and RRULE)**, which makes the iPhone Calendar alert on time even offline.

### Service worker
- Install: precache app files, then the 4 engine files into `anna-engine-<version>` (skipped if already present, so app updates do not re-download 22 MB).
- App files: network-first with 6 s timeout, cache fallback (fresh when online, works offline). Navigations fall back to `index.html`.
- Engine files: cache-first. The model is never touched by the service worker.

### Deployment
GitHub Pages, base path `/Anna/`. All paths are relative. The repository root is a complete site (engine committed in `vendor/`, `.nojekyll`, `404.html` redirecting to the app), so **Settings → Pages → Deploy from a branch → `main` / root** works with no build. Alternatively set the repository variable `PAGES_VIA_ACTIONS=true` and choose *GitHub Actions* as the source; `.github/workflows/ci.yml` then deploys `_site/` after tests.

### Updating the engine
`npm install @wllama/wllama@X @wllama/wllama-compat@X && npm run vendor && npm test && npm run e2e`, then bump the app version. `scripts/vendor.mjs --check` (run in CI) fails if `vendor/` does not match `package-lock.json`.

### Tests
- `test/*.test.mjs` (node:test): logic, AI prompt/privacy, SHA-256, build/version/paths.
- `test/e2e/ui.mjs`: 116 checks through the real UI (iPhone 15 emulation or desktop), including restart persistence and offline start.
- `test/e2e/ai-real.mjs`: the genuine model end-to-end, online → offline → browser restart offline. `--safari-engine` forces wllama's Safari build. `ANNA_REAL_HF=1` downloads from live Hugging Face.
- `test/e2e/ai-failures.mjs`: cancel, corrupted bytes, dropped connection, offline start, recovery, re-verification, delete.
Results are written to `test-results/*.json`.
