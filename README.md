# Anna Web — v0.3.0

Independent browser/PWA edition of Anna for **iPhone Safari**. Separate from **Anna Native** (React Native / Expo): no shared files, database or build.

## New in v0.3.0: offline AI brain (needs on-device verification, see below)
Anna can answer questions with a small language model running **inside your browser** (wllama = llama.cpp compiled to WebAssembly). No cloud AI, no API key, no subscription.
- **Model:** Qwen2.5 0.5B Instruct, Q4_K_M, about 398 MB (`bartowski/Qwen2.5-0.5B-Instruct-GGUF` on Hugging Face; published under Apache-2.0, check the model card).
- **Engine:** `@wllama/wllama` 3.5.1 + `@wllama/wllama-compat` 3.5.1, bundled into your site at build time (`npm install`), so the engine also works offline.
- **Storage:** the model is downloaded once into the browser's private file system (OPFS). After that Anna answers with no internet.
- **Brain screen:** Download (with progress and Cancel), Load into memory, Unload, Delete, storage status, an honest status pill (*Not installed / Incomplete / Downloaded · not loaded / Ready*), and a **Run self-test** button.
- **Privacy:** Anna can read your data only for categories you switch on (Tasks, Money, Business, Memories). All are **off by default**. Notes and customer names are never sent to the model, Anna cannot change data, and *Preview exactly what Anna sees* shows the full data block. The conversation is kept in memory only.
- Existing features, data, backups and deployment are unchanged. The model file is **not** part of backups.

## What was and was not tested
- **Tested (automated):** all v0.2.0 features (33 checks, incl. upgrade from v0.1.0 data); the AI integration logic (23 checks) against a **stand-in engine**: download progress/cancel/failure, partial files never shown as installed, load/unload/delete, out-of-memory failure and retry, crash-during-load detection, missing engine files, permissions and prompt contents, answers while offline.
- **NOT tested:** the real wllama engine, the real model, and iPhone Safari / Home Screen. I had no network or iPhone. Answers shown in my tests came from the stand-in, **not** from a real model. Treat v0.3.0 as ready for *your* testing, not as proven.

## Expected limits on iPhone (please read)
- Default wllama builds do not run on Safari. Anna uses the **compat** build (slower, single thread; GitHub Pages cannot send the headers multi-threading needs). Expect a slow load and a few words per second.
- A 0.5B model gives short, sometimes wrong answers. Numbers come from your data, but check the Money screen.
- Loading puts roughly 400 MB+ into Safari's memory. An iPhone 15 should cope, but iOS can close the page if memory runs short. Anna detects this and shows a warning next time instead of retrying silently.
- **Home Screen app and Safari tab have separate storage.** Download the model inside the one you will use (Home Screen recommended).
- GPU use is a switch, off by default, because it may crash on iPhone.

## Install on iPhone
1. **Deploy:** put the *contents* of `anna-web.zip` at the root of your GitHub repo (`index.html` and `.github/` at the top). Settings → Pages → Source: **GitHub Actions**. Push to `main`. The workflow runs `npm install`, tests, builds and publishes. In the Actions log look for `AI engine: 4 files ready`; if it says `INCOMPLETE`, send me that log line.
2. **Home Screen:** open the site in Safari → Share → **Add to Home Screen**. Close Safari and open Anna from the new icon.
3. **Download:** on Wi-Fi, in Anna open **Brain → Download model**. Keep the screen on and Anna open until it says *Downloaded*.
4. **Load:** tap **Load into memory**. Wait until the pill says **Ready · works offline**.
5. **Choose what Anna may read** (Brain → What Anna may read). Then tap **Ask Anna** (Home or Brain).
6. **Offline test:** turn on Airplane Mode, reopen Anna, Load, ask a question.
7. **Report back:** Brain → **Run self-test** → **Copy report** and send it to me, with what you saw.

## If Safari cannot run it
If loading fails or crashes repeatedly, the honest conclusion is that this model or engine is too heavy for Safari on your phone. Options: (a) change `MODEL` in `ai.js` to a smaller GGUF (not yet verified by me); (b) use **Anna Native** with llama.rn, which runs the model natively and is the better long-term home for the AI.

## Develop
`npm install` · `npm test` (Node 22) · `npm run build` (writes `_site/`, including `vendor/manifest.json` describing the engine files) · `npm run serve`. Bump the version in `package.json`, `app.js` and `sw.js` together on each release.
