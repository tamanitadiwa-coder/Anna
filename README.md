# Anna — v0.4.1

**Anna** is a private personal assistant that runs entirely in your browser and is designed for **iPhone (Safari, added to the Home Screen)**. It organises your tasks, reminders, money, small business and personal memories, and has a **genuine offline AI** (Qwen2.5 0.5B Instruct) that runs on the phone itself. No accounts, no cloud, no subscriptions: your data and the AI stay on your device.

Live site: **https://tamanitadiwa-coder.github.io/Anna/**

| Area | What you can do |
|---|---|
| **Ask Anna (AI)** | Chat with a local AI model that works with no internet. It can read the categories you allow (tasks & reminders, money, business, memories) and answers from your real data. Conversation history is saved and readable even without the model. Stop button, clear conversation. |
| **Tasks & reminders** | Tasks with due date, priority and notes (Today / Later / Done). Reminders with date, time and repeat (daily, weekly, monthly), alerts while Anna is open, optional notifications, and **Add to iPhone Calendar** (.ics) so you are alerted even when Anna is closed. |
| **Money** | Income and expenses in rand (R 1 234,56), spending breakdown, 6-month cash flow, monthly budgets per category, bills with due dates, paid status, monthly roll-over and payment history. |
| **Business** | Sales, expenses and invoices (cash basis profit), unpaid invoices, search across all records. |
| **Brain** | Personal memories (save, search, filter, edit, delete), AI model management, privacy switches, diagnostics. |
| **Owner lock** | Anna belongs to **Jamal Tamani**. Password-protected (PBKDF2 hash only, never the password), auto-lock after 5 min, Lock now, change password. |
| **Your logo** | Settings → Anna logo: upload your own image; shown on the lock screen and every page; replace or reset any time. |
| **Settings** | Encrypted backup export, verified restore with preview and undo, name, currency (rand by default), notifications, offline diagnostics, erase. |

Every record can be **edited** (tap it) and **deleted** (bin icon, with Undo).

## Install on iPhone 15 (5 minutes + model download)

1. Open **https://tamanitadiwa-coder.github.io/Anna/** in **Safari**.
2. Create your password on the welcome screen. Then tap **Share → Add to Home Screen → Add**. Close Safari and **always open Anna from the new icon** (the Home Screen app has its own storage, separate from Safari tabs).
3. On **Wi-Fi**, open **Brain → Download AI model · 398 MB**. Keep the screen on and Anna open until the pill says **Installed · not loaded** (the file is checked with SHA-256 automatically).
4. Tap **Load into memory**. Anna runs a real test answer; when it passes the pill says **Ready · works offline**.
5. Tap **Ask Anna**. Try *“What should I focus on today?”*
6. Optional: **Settings → Reminder alerts → Allow notifications**.
7. Check offline readiness: **Settings → Offline diagnostics → Run diagnostics** should end with *“VERDICT: Ready for offline use.”* Then turn on Airplane Mode and use Anna normally.

After an iPhone restart or closing Anna, the model stays installed; just tap **Load into memory** again (it does not re-download).

**Back up regularly:** Settings → Export backup → save to Files/iCloud. Backups are encrypted with your password and contain all records, reminders, chat history, settings, logo and owner identity (not the 398 MB model). To move to a new phone see `HANDOVER.md` §12.

## What to expect from the AI

- It is a **small model running on the phone’s CPU**, so it is slower than cloud AI and can make mistakes. Always check important numbers on the Money screen.
- In our test machine (a slow cloud CPU) the first answer after loading took ~40 s and later answers ~10 s; an iPhone 15 is expected to be faster, but this has **not yet been measured on a real iPhone** (see `docs/IPHONE-COMPATIBILITY.md`).
- Loading needs roughly 0.5–1 GB of memory. If iOS closes Anna while loading, Anna tells you next time. Close other apps and try again.

## For developers

```bash
npm ci            # installs the AI engine (wllama 3.5.1) — Node 22
npm test          # 38 unit/build tests
npm run build     # writes _site/ (exactly what the browser needs)
npm run serve     # http://127.0.0.1:8080/Anna/
npm run e2e       # browser tests (Playwright/Chromium); real-model tests need ANNA_MODEL_FILE or ANNA_REAL_HF=1
npm run vendor    # after upgrading wllama: refresh vendor/ (committed engine files)
```

The repository root **is** the website (engine files are committed in `vendor/`), so GitHub Pages can serve it directly from `main`. See `HANDOVER.md` for the engineering state, `docs/TECHNICAL.md` for architecture, `docs/TEST-REPORT.md` for results, `docs/MODEL.md` for the AI model and checksum.

Release checklist: bump the version in `package.json`, `app.js` and `sw.js` together (the build refuses mismatches).

Licence: MIT (see `LICENSE`). The AI model is Qwen2.5-0.5B-Instruct by Alibaba Cloud (Apache-2.0), GGUF by bartowski.
