# iPhone 15 / Safari compatibility report — v0.4.0

**Honest summary:** no physical iPhone (and no Apple WebKit/Safari) was available in the engineering environment, so nothing in this report is a physical-device result. What *was* done is listed by level of evidence below. Physical verification is the one remaining acceptance step and takes about 15 minutes with the checklist at the end.

## Levels of evidence

| Level | Status | Evidence |
|---|---|---|
| Desktop browser (Chromium) | **Tested** | 116/116 UI checks; real model end-to-end 30/30 (incl. live Hugging Face download); failure paths 11/11 |
| Safari code path of the AI engine | **Tested in Chromium** | wllama's *compat* build is the one Safari uses (Safari lacks JSPI). Tests hide JSPI so wllama takes exactly that path: real model loads and answers online, offline and after restart (30/30). |
| Mobile layout (iPhone 15 viewport 393×852, touch, iOS user agent) | **Emulated in Chromium** | 116/116 UI checks incl. no horizontal overflow, all buttons ≥ 44 px (40 px minimum enforced in tests), switches not overlapped (the old GPU-toggle overlap is fixed) |
| WebKit engine | **Not tested** | Playwright WebKit was not available in the environment |
| Real iPhone 15 / Safari / Home Screen | **Not tested** | No hardware |

## Safari-specific design decisions (implemented)
- **Engine:** wllama's compat (Asyncify, wasm32) build, single-threaded. Required because Safari has no JSPI; multi-threading also needs cross-origin isolation headers that GitHub Pages cannot send.
- **Model storage:** OPFS. wllama writes it through a worker with sync access handles, the method Safari supports (Safari lacks `createWritable` on older versions).
- **Offline engine loading:** the `.wasm` is handed to the worker as a `blob:` URL so it loads offline regardless of whether Safari lets the service worker control blob workers.
- **Memory:** 398 MB model in a wasm32 heap plus a ~24 MB context (n_ctx 2048). Expected peak is roughly 0.6–1 GB, within what iOS normally allows a foreground Safari page on a 6 GB iPhone 15. If iOS terminates the page while loading, Anna detects it on the next launch and explains it.
- **Storage quota:** checked before download (needs ~480 MB free for the page). Home Screen apps are exempt from Safari's 7-day storage expiry; `navigator.storage.persist()` is requested.
- **Home Screen:** manifest (`display: standalone`, black theme), `apple-mobile-web-app-*` meta tags, 180 px apple-touch-icon, safe-area padding, keyboard handling (tab bar hides, focused field scrolls into view, chat follows the visual viewport).
- **Notifications:** iOS 16.4+ supports notifications only for Home Screen web apps and only while they run. Closed-app alerts use the Calendar (.ics) route.
- **Separate storage:** the Home Screen app and Safari tabs do not share storage; the docs and Settings say so.

## 15-minute physical checklist (please run on the iPhone 15)
1. Safari → https://tamanitadiwa-coder.github.io/Anna/ → Share → Add to Home Screen. Open from the icon. ☐ opens full-screen, black theme, no overlaps
2. Add a task, a reminder 2 minutes ahead, an expense of `150,50`, a memory. ☐ all saved; reminder alert appears while open
3. Brain → Download AI model (Wi-Fi). ☐ progress, then “Checking SHA-256”, then *Installed · not loaded*. Note the time taken.
4. Load into memory. ☐ *Self-test passed* and *Ready · works offline*. Note the load time.
5. Ask “How much did I spend this month?” ☐ correct answer. Note seconds to answer.
6. Turn on **Airplane Mode**. Ask another question. ☐ answer arrives
7. Swipe Anna away (close it), reopen from the icon while still in Airplane Mode. ☐ app opens, data present, Brain shows *Installed*; Load → ask ☐ answer arrives
8. Settings → Run diagnostics → Copy report, and send it back along with the times from steps 3–5. ☐ verdict “Ready for offline use”
9. Settings → Export backup → save to Files. Erase all data → Restore from that file. ☐ “Restored and verified”

If step 4 crashes repeatedly: close all other apps and retry once; if it still fails, report it. The fallback is a smaller model (e.g. Qwen2.5-0.5B Q3 or SmolLM2-360M), which is a one-line change in `ai.js` (`MODEL`) plus its checksum.
