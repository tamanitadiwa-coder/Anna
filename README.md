# ANNA — v1.0.0

**ANNA** is Jamal's private, offline-first personal companion for **iPhone (Safari, added to the Home Screen)**. A small AI (Qwen2.5-0.5B-Instruct, running on the phone through WebLLM/WebGPU) talks with you. Exact things like sums, money, dates and staff hours come from ANNA's own code, never from the AI. No accounts, no cloud and no push server: your data and the AI stay on the phone.

Live: **https://tamanitadiwa-coder.github.io/Anna/**

## What ANNA does

| Area | What you get |
|---|---|
| **Chat (Home → Talk to ANNA)** | One companion. Each question goes to the tool that owns the answer first: time → clock, sums → calculator, “remind me” → reminders, “what did I tell you” → memory, “can I afford” → finance, “how did I feel” → journal, staff hours → timesheets, current events → research. Everything else goes to the AI. When the AI is awake it re-phrases the tool's answer, but its wording is only kept if every number stays exactly the same. |
| **Memory & journal (Brain)** | Separate on-device stores: profile, preferences, goals, journal, memories, progress, finance, staff. Private journal with moods, tags, search, edit and delete. ANNA asks before remembering anything. Goals and habits with real progress. Light check-ins. |
| **Money** | Monthly calculator (30-day month or actual days, ZAR by default), exact calculator (big.js: percentages, 15% VAT, wages, overtime, margins, P&L, projections), “Can I afford…?” answered BUY/WAIT/REDUCE COST/AVOID, bills with priorities and due dates, “What must I pay first?”. Chat entries like “spent R200 on food” only save after you tap **Save**, and can be undone. Warnings show real numbers. **Books Day** on the 25th closes the month. |
| **Business** | Sales, expenses, invoices; staff, shifts, timesheets, overtime (BCEA defaults), optional 2× pay on Sundays and SA public holidays. |
| **Time & reminders** | Device clock, world time, SA public holidays, “tomorrow / next Friday”. Reminders stay in ANNA, go to iPhone Reminders through the **ANNA Reminder** shortcut, or go to Calendar as an .ics file. Each item says where it is saved. |
| **Web research** | Not switched on. It needs a search service you approve (Settings → Web research lists two options with their cost). Offline, ANNA says research needs internet and never guesses. |
| **Owner lock** | Password (PBKDF2, never stored), auto-lock, encrypted backups. |

## Install on iPhone

1. Open **https://tamanitadiwa-coder.github.io/Anna/** in **Safari** → **Meet ANNA** → create your password.
2. **Share → Add to Home Screen → Add**. From then on, always open ANNA from the icon, because it has its own storage.
3. On Wi-Fi: **Brain → Download AI brain (~290 MB)**, then turn on **ANNA is awake** on Home. The first load takes about a minute. After that it works in Airplane Mode.
4. For iPhone Reminders, create the shortcut once in the **Shortcuts** app. Name it exactly **ANNA Reminder** and set it to receive **Text** input. Add **Get Dictionary from Input**, then **Add New Reminder** with the dictionary's `title`, `due` and `notes` values.
5. Check offline use: **Settings → Run diagnostics**.

If an old AI model from v0.3–v0.5 is still on the phone, Brain shows **Delete old model**. Nothing is deleted until you tap it.

## Backup

Safari can clear website data, so export a backup regularly: **Settings → Export backup**, then save the file to Files or iCloud. The file is encrypted with your password. It contains every store (journal, memories, goals, money, staff…), reminders, chat and settings, but not the AI model. To restore: **Settings → Choose backup file…**, enter your password and confirm. ANNA checks that the restore matches before it reports success.

## For developers

```bash
npm ci           # Node 22
npm test         # unit tests (money, time, routing, memory, auth, build)
npm run build    # writes _site/
npm run serve    # local server
npm run e2e      # every browser suite (Playwright/Chromium, iPhone 15 emulation): ui, life, reminders, money, books, routing, offline
npm run vendor   # after upgrading @mlc-ai/web-llm: refresh vendor/ (committed engine files)
```

The repository root is the website, and GitHub Pages serves it from `main`. When you release, bump the version in `package.json`, `app.js` and `sw.js` together (the build refuses mismatches). Product spec: `ANNA SPEC 3.md`.

Licence: MIT. AI model: Qwen2.5-0.5B-Instruct (Apache-2.0) via WebLLM (Apache-2.0). big.js (MIT).
