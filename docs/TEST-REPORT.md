# Anna v0.4.0 — test report

Generated 2026-11-18 18:10 UTC by `node scripts/report.mjs` from `test-results/*.json` (written by the test scripts themselves). Every number below comes from an executed run.

## Summary

| Suite | Environment | Result | Run |
|---|---|---|---|
| Unit + build tests (`npm test`) | Node 22 | **33/33** ✅ | — |
| UI, every screen and control | Chromium, iPhone 15 emulation (393×852, touch, iOS UA) | **110/110** ✅ | 2026-11-18 18:07 (41s) |
| UI, every screen and control | Chromium desktop 1280×860 | **109/110** ❌ | 2026-11-18 18:07 (32s) |
| Genuine model end-to-end (fast engine build) | Chromium; model served at the real HF URL from a verified local copy | **26/26** ✅ | 2026-11-18 17:41 (254s) |
| Genuine model end-to-end (Safari engine build) | Chromium with JSPI hidden → wllama compat build used by Safari | **27/27** ✅ | 2026-11-18 17:50 (246s) |
| Genuine model end-to-end, downloaded from live huggingface.co | Chromium through the internet | **27/27** ✅ | 2026-11-18 18:04 (258s) |
| Model download failure paths | Chromium, Safari engine build | **11/11** ✅ | 2026-11-18 17:59 (60s) |
| Live production site (before this release is deployed) | https://tamanitadiwa-coder.github.io/Anna/ | **8/17** ❌ | 2026-11-18 18:09 (3s) |
| Live production site | https://tamanitadiwa-coder.github.io/Anna/ | **8/17** ❌ | 2026-11-18 18:09 (3s) |

## Not tested (no hardware / not available)

- **Physical iPhone 15, real Safari, Home Screen install**: no device available. Mobile results above are Chromium emulation (layout/touch only). Use the checklist in `docs/IPHONE-COMPATIBILITY.md`.
- **WebKit engine**: Playwright WebKit was not available in the environment. The Safari *engine path* of the AI (wllama compat build) was exercised in Chromium.
- **iPhone model memory / speed**: not measurable without the device. Test-machine numbers are in `docs/MODEL.md`.

## Genuine offline AI evidence

Model: Qwen2.5 0.5B Instruct Q4_K_M, HF commit `41ba88dbac95fed2528c92514c131d73eb5a174b`, 397808192 bytes, SHA-256 `6eb923e7d26e9cea28811e1a8e852009b21242fb157b26149d3b188f3a8c8653`. Engine: default build. Source: live huggingface.co.

Load: 14s including the readiness self-test, which answered: “Hello! How can I assist you today?”. Model name read from the GGUF: Qwen2.5 0.5B Instruct.

| Phase | Question | Answer (verbatim) | Time |
|---|---|---|---|
| online | In one sentence, what is an emergency fund? | An emergency fund is a savings account specifically set aside for unexpected expenses, typically to cover a one-time event like a medical crisis or job loss. | 44.5s |
| online | How much did I spend on groceries this month? | You spent R 450,00 on groceries this month. | 10.0s |
| offline | When is my sister Lindiwe’s birthday? | Your sister Lindiwe's birthday is on 3 March | 9.5s |
| offline | Give me two quick tips to stick to a monthly budget. | 1. Prioritize essential expenses like housing, utilities, and food. 2. Use a budgeting app or planner to track your spending and stay on | 16.5s |
| offline after restart | What is 15% of R2000? | 15% of R2000 is R300. | 87.5s |

“offline” = the app server was shut down, huggingface.co was blocked and the browser was set offline. “offline after restart” = the browser was closed and reopened with no network; Anna loaded from its service-worker cache and the model from OPFS.

Diagnostics produced by Anna after the offline restart:

```
Anna Web 0.4.0 diagnostics · 2026/11/18, 18:04:35
Device: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/157.0.8103.78 Safari/537.36
Opened from Home Screen: no
Internet: offline (Anna does not need it after setup)
Database: indexeddb (best), read/write OK; 0 tasks, 0 reminders, 2 entries, 0 bills, 0 budgets, 0 business records, 1 memory, 10 messages
Storage: 421 MB used of 11159 MB available to Anna; persistent=false
Offline app files: service worker active, controlling this page; app cache 12 files; AI engine cache wllama 3.5.1 (4/4 files)
Notifications: denied; pending reminders: 0
Browser capabilities: opfs=yes, worker=yes, wasm=yes, simd=yes, secure=yes, jspi=yes, webgpu=yes, ok=yes
Engine path: fast build (JSPI + memory64)
Engine files: ok, wllama 3.5.1 (4 files)
Model: Qwen2.5 0.5B Instruct Q4_K_M @ 41ba88db; state=ready; stored=397808192/397808192 bytes; SHA-256 verified=true
Last load: 3.2 s; self-test reply: "Hello! How can I assist you today?"; prompt pre-read: 418 tokens in 76.5 s
Previous load interrupted: false; last error: none
Live test (10.4 s, 3.6 tokens/s): Saving money is useful because it helps individuals and households manage their financial goals, reduce debt, and build wealth over time.

VERDICT: Ready for offline use. You can turn on Airplane Mode.
```

## UI, every screen and control — 110/110

File: `test-results/ui-iphone-15.json` · Chromium with iPhone 15 viewport/touch/UA emulation (layout only, not real Safari or hardware)

<details><summary>All checks</summary>

- ✅ five main tabs render
- ✅ ZAR is the default currency (R 0,00)
- ✅ black theme background
- ✅ tab "home" renders
- ✅ tab home: no horizontal overflow — 393 vs 393
- ✅ tab home: all buttons are at least 40×40 px touch targets
- ✅ tab "tasks" renders
- ✅ tab tasks: no horizontal overflow — 393 vs 393
- ✅ tab tasks: all buttons are at least 40×40 px touch targets
- ✅ tab "money" renders
- ✅ tab money: no horizontal overflow — 393 vs 393
- ✅ tab money: all buttons are at least 40×40 px touch targets
- ✅ tab "biz" renders
- ✅ tab biz: no horizontal overflow — 393 vs 393
- ✅ tab biz: all buttons are at least 40×40 px touch targets
- ✅ tab "brain" renders
- ✅ tab brain: no horizontal overflow — 393 vs 393
- ✅ tab brain: all buttons are at least 40×40 px touch targets
- ✅ Settings opens from the gear button
- ✅ settings: no horizontal overflow — 393 vs 393
- ✅ settings: all buttons are at least 40×40 px touch targets
- ✅ new-task sheet: no horizontal overflow — 393 vs 393
- ✅ new-task sheet: all buttons are at least 40×40 px touch targets
- ✅ empty task is rejected with a clear message
- ✅ create task
- ✅ task shows in Today
- ✅ edit sheet is pre-filled
- ✅ edit task (no duplicate)
- ✅ complete task
- ✅ completed task listed under Done
- ✅ un-complete task
- ✅ delete task
- ✅ Undo restores the deleted task
- ✅ future task shows under Later
- ✅ reminder sheet: no horizontal overflow — 393 vs 393
- ✅ reminder sheet: all buttons are at least 40×40 px touch targets
- ✅ create reminder with date, time and repeat
- ✅ reminder confirmation shown
- ✅ edit reminder
- ✅ reminder in the past is refused
- ✅ Add-to-Calendar exports a valid .ics with alarm and repeat — anna-reminder-2026-11-19.ics
- ✅ due reminder raises an in-app alert while Anna is open
- ✅ reminder is alerted only once
- ✅ "Done" on a weekly reminder schedules the next one
- ✅ mark one-off reminder complete
- ✅ completed reminders listed
- ✅ delete reminder
- ✅ Home shows upcoming reminders
- ✅ invalid amount rejected
- ✅ record expense (comma decimal) and income
- ✅ net this month correct (R 16 749,50) — R 16 749,50
- ✅ spending breakdown shows the category
- ✅ edit entry pre-fills amount
- ✅ edit entry
- ✅ delete entry
- ✅ budget shows over-limit
- ✅ edit budget
- ✅ budget shows amount left — Groceries R 1 300,00 of R 2 000,00 R 700,00 left this month
- ✅ add bills
- ✅ mark bill paid and record expense — Mark “Gym” as paid and record R 450,00 as an expense in Money?  OK = paid + record expense Cancel = just mark paid
- ✅ paid bills listed with payment date
- ✅ undo bill payment
- ✅ monthly bill rolls to next month
- ✅ edit bill
- ✅ delete bill
- ✅ delete budget
- ✅ undo budget delete
- ✅ create sale, expense and invoice
- ✅ profit is cash basis (unpaid invoice excluded) — R 3 050,00
- ✅ paid invoice counts towards profit
- ✅ search business records by customer
- ✅ search by amount
- ✅ search with no match shows a message
- ✅ edit business record
- ✅ delete business record
- ✅ save memories
- ✅ search memories
- ✅ filter memories by category
- ✅ edit memory
- ✅ memory feedback recorded
- ✅ delete memory
- ✅ privacy switch toggles
- ✅ brain with Advanced open: no horizontal overflow — 393 vs 393
- ✅ brain with Advanced open: all buttons are at least 40×40 px touch targets
- ✅ GPU switch toggles and is not covered by its label
- ✅ "What Anna sees" shows data but never notes or customer names
- ✅ chat explains the AI is not installed
- ✅ Send is disabled until the AI is ready
- ✅ chat history is readable without the model
- ✅ chat: no horizontal overflow — 393 vs 393
- ✅ chat: all buttons are at least 40×40 px touch targets
- ✅ clear conversation (after confirmation)
- ✅ name preference shows in greeting
- ✅ currency can be changed
- ✅ diagnostics: database, internet and cached AI engine — Internet: connected (Anna does not need it after setup) | Database: indexeddb (best), read/write OK; 2 tasks, 1 reminder, 4 entries, 1 bill, 1 budget, 2 busines
- ✅ diagnostics verdict explains what is missing (no model yet)
- ✅ export backup contains every record type incl. reminders and chat — anna-backup-2026-11-18.json
- ✅ erase all data (two confirmations) — {"d":["Erase ALL Anna data on this device (tasks, reminders, money, business, memories, chat)? Export a backup first.","Really erase everything? (A safety copy 
- ✅ invalid backup file is refused — This is not an Anna Web backup.
- ✅ restore shows a preview before overwriting
- ✅ restore completes and verifies what was saved — Restored and verified: 2 tasks, 1 reminder, 4 entries, 1 bill, 1 budget, 2 business records, 1 memory, 2 messages.
- ✅ restored records are identical to the originals
- ✅ undo-restore is offered
- ✅ all data identical after closing and reopening the browser (IndexedDB)
- ✅ settings persist
- ✅ app opens with no internet and no server (service worker cache)
- ✅ data available offline
- ✅ diagnostics detect offline
- ✅ all tabs work offline
- ✅ no JavaScript errors during the whole run

</details>

## UI, every screen and control — 109/110

File: `test-results/ui-desktop.json` · Desktop Chromium

<details><summary>All checks</summary>

- ✅ five main tabs render
- ✅ ZAR is the default currency (R 0,00)
- ✅ black theme background
- ✅ tab "home" renders
- ✅ tab home: no horizontal overflow — 1280 vs 1280
- ✅ tab home: all buttons are at least 40×40 px touch targets
- ✅ tab "tasks" renders
- ✅ tab tasks: no horizontal overflow — 1280 vs 1280
- ✅ tab tasks: all buttons are at least 40×40 px touch targets
- ✅ tab "money" renders
- ✅ tab money: no horizontal overflow — 1280 vs 1280
- ✅ tab money: all buttons are at least 40×40 px touch targets
- ✅ tab "biz" renders
- ✅ tab biz: no horizontal overflow — 1280 vs 1280
- ✅ tab biz: all buttons are at least 40×40 px touch targets
- ✅ tab "brain" renders
- ✅ tab brain: no horizontal overflow — 1280 vs 1280
- ✅ tab brain: all buttons are at least 40×40 px touch targets
- ✅ Settings opens from the gear button
- ✅ settings: no horizontal overflow — 1280 vs 1280
- ✅ settings: all buttons are at least 40×40 px touch targets
- ✅ new-task sheet: no horizontal overflow — 1280 vs 1280
- ✅ new-task sheet: all buttons are at least 40×40 px touch targets
- ✅ empty task is rejected with a clear message
- ✅ create task
- ✅ task shows in Today
- ✅ edit sheet is pre-filled
- ✅ edit task (no duplicate)
- ✅ complete task
- ✅ completed task listed under Done
- ✅ un-complete task
- ✅ delete task
- ✅ Undo restores the deleted task
- ✅ future task shows under Later
- ✅ reminder sheet: no horizontal overflow — 1280 vs 1280
- ✅ reminder sheet: all buttons are at least 40×40 px touch targets
- ✅ create reminder with date, time and repeat
- ✅ reminder confirmation shown
- ✅ edit reminder
- ✅ reminder in the past is refused
- ✅ Add-to-Calendar exports a valid .ics with alarm and repeat — anna-reminder-2026-11-19.ics
- ✅ due reminder raises an in-app alert while Anna is open
- ✅ reminder is alerted only once
- ✅ "Done" on a weekly reminder schedules the next one
- ✅ mark one-off reminder complete
- ✅ completed reminders listed
- ✅ delete reminder
- ✅ Home shows upcoming reminders
- ✅ invalid amount rejected
- ✅ record expense (comma decimal) and income
- ✅ net this month correct (R 16 749,50) — R 16 749,50
- ✅ spending breakdown shows the category
- ✅ edit entry pre-fills amount
- ✅ edit entry
- ✅ delete entry
- ✅ budget shows over-limit
- ✅ edit budget
- ✅ budget shows amount left — Groceries R 1 300,00 of R 2 000,00 R 700,00 left this month
- ✅ add bills
- ✅ mark bill paid and record expense — Mark “Gym” as paid and record R 450,00 as an expense in Money?  OK = paid + record expense Cancel = just mark paid
- ✅ paid bills listed with payment date
- ✅ undo bill payment
- ✅ monthly bill rolls to next month
- ✅ edit bill
- ✅ delete bill
- ✅ delete budget
- ✅ undo budget delete
- ✅ create sale, expense and invoice
- ✅ profit is cash basis (unpaid invoice excluded) — R 3 050,00
- ✅ paid invoice counts towards profit
- ✅ search business records by customer
- ✅ search by amount
- ✅ search with no match shows a message
- ✅ edit business record
- ✅ delete business record
- ✅ save memories
- ✅ search memories
- ✅ filter memories by category
- ✅ edit memory
- ✅ memory feedback recorded
- ✅ delete memory
- ✅ privacy switch toggles
- ✅ brain with Advanced open: no horizontal overflow — 1280 vs 1280
- ✅ brain with Advanced open: all buttons are at least 40×40 px touch targets
- ✅ GPU switch toggles and is not covered by its label
- ✅ "What Anna sees" shows data but never notes or customer names
- ✅ chat explains the AI is not installed
- ✅ Send is disabled until the AI is ready
- ✅ chat history is readable without the model
- ✅ chat: no horizontal overflow — 1280 vs 1280
- ✅ chat: all buttons are at least 40×40 px touch targets
- ✅ clear conversation (after confirmation)
- ✅ name preference shows in greeting
- ✅ currency can be changed
- ✅ diagnostics: database, internet and cached AI engine — Internet: connected (Anna does not need it after setup) | Database: indexeddb (best), read/write OK; 2 tasks, 1 reminder, 4 entries, 1 bill, 1 budget, 2 busines
- ✅ diagnostics verdict explains what is missing (no model yet)
- ✅ export backup contains every record type incl. reminders and chat — anna-backup-2026-11-18.json
- ✅ erase all data (two confirmations) — {"d":["Erase ALL Anna data on this device (tasks, reminders, money, business, memories, chat)? Export a backup first.","Really erase everything? (A safety copy 
- ✅ invalid backup file is refused — This is not an Anna Web backup.
- ❌ restore shows a preview before overwriting
- ✅ restore completes and verifies what was saved — Restored and verified: 2 tasks, 1 reminder, 4 entries, 1 bill, 1 budget, 2 business records, 1 memory, 2 messages.
- ✅ restored records are identical to the originals
- ✅ undo-restore is offered
- ✅ all data identical after closing and reopening the browser (IndexedDB)
- ✅ settings persist
- ✅ app opens with no internet and no server (service worker cache)
- ✅ data available offline
- ✅ diagnostics detect offline
- ✅ all tabs work offline
- ✅ no JavaScript errors during the whole run

</details>

## Genuine model end-to-end (fast engine build) — 26/26

File: `test-results/ai-real.json`

<details><summary>All checks</summary>

- ✅ Brain shows "Not installed" before download
- ✅ download progress shown — Downloading 0%
- ✅ SHA-256 verification phase shown
- ✅ model downloaded and stored in OPFS
- ✅ stored size is exactly 397808192 bytes — 397808192
- ✅ SHA-256 of stored file equals published checksum — 6eb923e7d26e9cea28811e1a8e852009b21242fb157b26149d3b188f3a8c8653
- ✅ pill says Installed · not loaded
- ✅ model loaded and marked ready
- ✅ loaded architecture is qwen2 — qwen2
- ✅ readiness self-test produced real text — Hello! How can I assist you today?
- ✅ UI shows "Self-test passed"
- ✅ ONLINE answer to "In one sentence, what is an emergency fund?" — 73.0s: An emergency fund is a savings account specifically designed to cover unexpected expenses, often used for immediate needs like medical bills or car repai
- ✅ answer is rendered in the chat bubble
- ✅ ONLINE answer to "How much did I spend on groceries this month?" — 10.0s: You spent R 450,00 on groceries this month.
- ✅ answer is rendered in the chat bubble
- ✅ browser reports offline (app server stopped, Hugging Face blocked)
- ✅ OFFLINE answer to "When is my sister Lindiwe’s birthday?" — 9.5s: Your sister Lindiwe's birthday is on 3 March
- ✅ OFFLINE answer to "Give me two quick tips to stick to a monthly budget." — 19.5s: .1. Prioritize essential expenses and set aside a portion of your budget for non-essential items. 2. Track your spending and adjust your budget as needed
- ✅ offline answer used saved memory (birthday = 3 March) — Your sister Lindiwe's birthday is on 3 March
- ✅ Unload returns to "Installed · not loaded"
- ✅ after restart with no internet, Anna opens from the offline cache
- ✅ conversation history survived the restart — 8
- ✅ model still installed and verified after restart — cached
- ✅ model loads again with no internet
- ✅ OFFLINE answer after restart — 95.0s: 15% of R2000 is R300.
- ✅ offline diagnostics verdict: ready — VERDICT: Ready for offline use. You can turn on Airplane Mode.

</details>

## Genuine model end-to-end (Safari engine build) — 27/27

File: `test-results/ai-real-safari-engine.json`

<details><summary>All checks</summary>

- ✅ Brain shows "Not installed" before download
- ✅ download progress shown — Downloading 0%
- ✅ SHA-256 verification phase shown
- ✅ model downloaded and stored in OPFS
- ✅ stored size is exactly 397808192 bytes — 397808192
- ✅ SHA-256 of stored file equals published checksum — 6eb923e7d26e9cea28811e1a8e852009b21242fb157b26149d3b188f3a8c8653
- ✅ pill says Installed · not loaded
- ✅ model loaded and marked ready
- ✅ loaded architecture is qwen2 — qwen2
- ✅ readiness self-test produced real text — Hello! How can I assist you today?
- ✅ system prompt + data pre-read in the background after loading — 233 tokens in 41122 ms
- ✅ UI shows "Self-test passed"
- ✅ ONLINE answer to "In one sentence, what is an emergency fund?" — 41.0s: An emergency fund is a savings account specifically designed to cover unexpected expenses, such as medical bills or job loss.
- ✅ answer is rendered in the chat bubble
- ✅ ONLINE answer to "How much did I spend on groceries this month?" — 9.5s: You spent R 450,00 on groceries this month.
- ✅ answer is rendered in the chat bubble
- ✅ browser reports offline (app server stopped, Hugging Face blocked)
- ✅ OFFLINE answer to "When is my sister Lindiwe’s birthday?" — 9.0s: Your sister Lindiwe's birthday is on 3 March
- ✅ OFFLINE answer to "Give me two quick tips to stick to a monthly budget." — 13.0s: .1. Prioritize expenses and stick to your spending plan. 2. Review your budget regularly and adjust as
- ✅ offline answer used saved memory (birthday = 3 March) — Your sister Lindiwe's birthday is on 3 March
- ✅ Unload returns to "Installed · not loaded"
- ✅ after restart with no internet, Anna opens from the offline cache
- ✅ conversation history survived the restart — 8
- ✅ model still installed and verified after restart — cached
- ✅ model loads again with no internet
- ✅ OFFLINE answer after restart — 84.0s: 15% of R2000 is R300.
- ✅ offline diagnostics verdict: ready — VERDICT: Ready for offline use. You can turn on Airplane Mode.

</details>

## Genuine model end-to-end, downloaded from live huggingface.co — 27/27

File: `test-results/ai-real-hf.json`

<details><summary>All checks</summary>

- ✅ Brain shows "Not installed" before download
- ✅ download progress shown — Downloading 0%
- ✅ SHA-256 verification phase shown
- ✅ model downloaded and stored in OPFS
- ✅ stored size is exactly 397808192 bytes — 397808192
- ✅ SHA-256 of stored file equals published checksum — 6eb923e7d26e9cea28811e1a8e852009b21242fb157b26149d3b188f3a8c8653
- ✅ pill says Installed · not loaded
- ✅ model loaded and marked ready
- ✅ loaded architecture is qwen2 — qwen2
- ✅ readiness self-test produced real text — Hello! How can I assist you today?
- ✅ system prompt + data pre-read in the background after loading — 233 tokens in 42018 ms
- ✅ UI shows "Self-test passed"
- ✅ ONLINE answer to "In one sentence, what is an emergency fund?" — 44.5s: An emergency fund is a savings account specifically set aside for unexpected expenses, typically to cover a one-time event like a medical crisis or job l
- ✅ answer is rendered in the chat bubble
- ✅ ONLINE answer to "How much did I spend on groceries this month?" — 10.0s: You spent R 450,00 on groceries this month.
- ✅ answer is rendered in the chat bubble
- ✅ browser reports offline (app server stopped, Hugging Face blocked)
- ✅ OFFLINE answer to "When is my sister Lindiwe’s birthday?" — 9.5s: Your sister Lindiwe's birthday is on 3 March
- ✅ OFFLINE answer to "Give me two quick tips to stick to a monthly budget." — 16.5s: 1. Prioritize essential expenses like housing, utilities, and food. 2. Use a budgeting app or planner to track your spending and stay on
- ✅ offline answer used saved memory (birthday = 3 March) — Your sister Lindiwe's birthday is on 3 March
- ✅ Unload returns to "Installed · not loaded"
- ✅ after restart with no internet, Anna opens from the offline cache
- ✅ conversation history survived the restart — 8
- ✅ model still installed and verified after restart — cached
- ✅ model loads again with no internet
- ✅ OFFLINE answer after restart — 87.5s: 15% of R2000 is R300.
- ✅ offline diagnostics verdict: ready — VERDICT: Ready for offline use. You can turn on Airplane Mode.

</details>

## Model download failure paths — 11/11

File: `test-results/ai-failures.json`

<details><summary>All checks</summary>

- ✅ Cancel download: state Not installed, message says nothing was kept — Download cancelled. Nothing was kept.
- ✅ cancelled download leaves no model bytes in storage — {"n":0,"bytes":0}
- ✅ corrupted download is detected by SHA-256 and rejected — Checksum mismatch: the downloaded file is damaged or not the expected model (got 8bc5b2c725de…). It was deleted. Please download again.
- ✅ corrupted file was deleted — {"n":0,"bytes":0}
- ✅ no verification record kept for the bad file
- ✅ dropped connection: download fails safely with a message — Network problem while downloading. Check your connection and try again. Anything already downloaded is discarded safely.
- ✅ partial file from dropped connection was deleted — {"n":0,"bytes":0}
- ✅ download while offline is refused with a clear message
- ✅ a clean download afterwards succeeds and verifies
- ✅ if the verification record is lost, the file is re-hashed before loading
- ✅ Delete model frees the storage — {"n":0,"bytes":0}

</details>

## Live production site (before this release is deployed) — 8/17

File: `test-results/live-site-before-deploy.json`

<details><summary>All checks</summary>

- ✅ GET / → 200 text/html; charset=utf-8
- ✅ GET /index.html → 200 text/html; charset=utf-8
- ✅ GET /app.js → 200 application/javascript; charset=utf-8
- ✅ GET /ai.js → 200 application/javascript; charset=utf-8
- ✅ GET /logic.js → 200 application/javascript; charset=utf-8
- ❌ GET /sha256.js → 404 text/html; charset=utf-8
- ✅ GET /styles.css → 200 text/css; charset=utf-8
- ✅ GET /sw.js → 200 application/javascript; charset=utf-8
- ✅ GET /manifest.webmanifest → 200 application/manifest+json; charset=utf-8
- ❌ GET /icons/apple-touch-icon.png → 404 text/html; charset=utf-8
- ❌ GET /vendor/manifest.json → 503 text/html; charset=utf-8
- ❌ live app version is 0.4.0 — live: 0.3.0
- ❌ engine file vendor/wllama/index.js matches committed checksum — 404 9379 bytes
- ❌ engine file vendor/wllama/wllama.wasm matches committed checksum — 503 54887 bytes
- ❌ engine file vendor/wllama-compat/wllama.js matches committed checksum — 503 54887 bytes
- ❌ engine file vendor/wllama-compat/wllama.wasm matches committed checksum — 404 9379 bytes
- ❌ unknown paths get the 404 page that returns to the app

</details>

## Live production site — 8/17

File: `test-results/live-site.json`

<details><summary>All checks</summary>

- ✅ GET / → 200 text/html; charset=utf-8
- ✅ GET /index.html → 200 text/html; charset=utf-8
- ✅ GET /app.js → 200 application/javascript; charset=utf-8
- ✅ GET /ai.js → 200 application/javascript; charset=utf-8
- ✅ GET /logic.js → 200 application/javascript; charset=utf-8
- ❌ GET /sha256.js → 404 text/html; charset=utf-8
- ✅ GET /styles.css → 200 text/css; charset=utf-8
- ✅ GET /sw.js → 200 application/javascript; charset=utf-8
- ✅ GET /manifest.webmanifest → 200 application/manifest+json; charset=utf-8
- ❌ GET /icons/apple-touch-icon.png → 404 text/html; charset=utf-8
- ❌ GET /vendor/manifest.json → 503 text/html; charset=utf-8
- ❌ live app version is 0.4.0 — live: 0.3.0
- ❌ engine file vendor/wllama/index.js matches committed checksum — 404 9379 bytes
- ❌ engine file vendor/wllama/wllama.wasm matches committed checksum — 503 54887 bytes
- ❌ engine file vendor/wllama-compat/wllama.js matches committed checksum — 503 54887 bytes
- ❌ engine file vendor/wllama-compat/wllama.wasm matches committed checksum — 404 9379 bytes
- ❌ unknown paths get the 404 page that returns to the app

</details>
