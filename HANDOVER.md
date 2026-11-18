# ANNA — engineering handover (v0.4.1)

Last updated: 2026-11-18 · Repository: `tamanitadiwa-coder/Anna` · Working branch: `claude/anna-completion-deployment-t9c6gw` · Live URL: https://tamanitadiwa-coder.github.io/Anna/

Legend: ✅ implemented and tested · 🟡 implemented, not verified on a real iPhone · ⏸ planned / paused

## 1. Architecture
Static offline-first web app (PWA). No server, no accounts service, no paid APIs.
```
index.html → app.js  UI, IndexedDB storage, lock screen, reminders, backups, diagnostics
             ├ logic.js   money (cents), budgets, bills, business (cash basis), reminders, .ics, backup validation
             ├ ai.js      local AI lifecycle: download → SHA-256 → OPFS → load → self-test → ready; prompts; privacy filter
             ├ auth.js    owner identity, PBKDF2 password hash, AES-GCM encrypted backups (WebCrypto)
             ├ sha256.js  streaming SHA-256 for the 398 MB model
             └ vendor/    wllama 3.5.1 engine (fast build + Safari "compat" build), committed so main is deployable as-is
sw.js        service worker: offline cache of app + engine
```
Details: `docs/TECHNICAL.md`. Model facts and checksum: `docs/MODEL.md`.

## 2. Completed features ✅
Tasks (due date, priority, notes) · reminders (date/time, repeat, complete, alerts while open, notifications where allowed, Add-to-Calendar .ics, missed-reminder notice) · money (income/expenses, rand formatting, spending breakdown, cash flow, budgets, bills with paid status/history/undo) · business (sales, expenses, invoices, cash-basis profit, search) · memories (save, search, filter, edit, delete, feedback) · edit + delete with Undo everywhere · persistent chat with Stop · encrypted backup/restore with preview, verification and undo · offline diagnostics · owner lock · custom logo · black & silver theme.

## 3. AI engine status ✅ (🟡 on iPhone)
Qwen2.5-0.5B-Instruct Q4_K_M (398 MB, SHA-256 `6eb923e7d26e9cea28811e1a8e852009b21242fb157b26149d3b188f3a8c8653`, pinned HF commit `41ba88db…`) running in wllama 3.5.1 (llama.cpp → WebAssembly). Proven with the genuine model through the real UI: download from live Hugging Face, checksum, load, answers, internet cut, answers, browser restart offline, answers (30/30 on the fast engine, the Safari engine and live HF). Speed on the slow test CPU: first answer ~40 s, follow-ups ~10 s; iPhone speed not yet measured.

## 4. Offline capabilities
| Works with no internet ✅ | Needs internet |
|---|---|
| Opening the app (after first visit), all screens, all records, chat history, memories, settings, logo, lock/unlock, backups export/restore (files), AI answers (after the model is installed), diagnostics, reminders while open, Calendar alerts | First visit / app updates · the one-time 398 MB model download (Hugging Face) · nothing else |

## 5. Memory implementation
| What Anna remembers | How | Status |
|---|---|---|
| Owner's name | Fixed identity `Jamal Tamani` in `auth.js` (`OWNER`), recorded in the password record, in every backup, and in the AI system prompt | ✅ |
| Previous conversations | Saved in IndexedDB (last 300 messages), shown after restart, in backups; the AI sees the last 6 messages of the current conversation | ✅ |
| Personal information / preferences / ongoing projects | **Brain → ＋ Remember** (category e.g. Personal, Work, Projects). The AI receives up to 10 memories, the most relevant to the question first | ✅ (saved deliberately by you; Anna does not auto-extract facts from chat) |
| Records (tasks, money, business) | Given to the AI only for categories switched on in Brain | ✅ |
Memory lives on the device. It survives restarts and updates. It does **not** survive deleting the Home Screen app / clearing Safari data unless you restore a backup. There is no automatic multi-device sync (⏸): use encrypted backups to move it.

## 6. Authentication and owner identity ✅
- First launch shows a lock screen that greets Jamal and asks him to create a password (min. 8 characters, obvious passwords refused). Nothing is visible until unlocked.
- Only a **PBKDF2-SHA-256 hash (310 000 iterations, random salt)** is stored, in IndexedDB key `auth`. The password itself is never stored, logged or committed. No password exists in the source code.
- Auto-lock after 5 minutes in the background; **Settings → Lock now**; **Change password** (needs the current one).
- Wrong passwords: after 5 failures, waiting time 30 s doubling up to 1 hour.
- The owner name is not editable in the app, and a backup belonging to a different owner is refused. (The greeting name in Preferences is just a display name.)
- Forgot password: no recovery by design. "Reset Anna on this device" wipes the device; data can come back only from an encrypted backup whose password you know.
- Honest limits: the lock protects the app's screens; data on the phone is protected at rest by the iPhone's own encryption and passcode, not by a separate Anna encryption layer. Backups **are** encrypted (AES-256-GCM, key derived from the password).
- Multi-user registration: ⏸ paused. The design (owner record + per-record data in one store) can later move to per-user records keyed by user id.

## 7. Custom logo ✅
Settings → **Anna logo → Upload logo…** → choose a PNG/JPG from Photos or Files. It is resized to max 512 px, stored on the device, shown on the lock screen and at the top of every page, and included in backups. **Replace logo…** or **Reset to default** at any time. To use it as the Home Screen icon too: upload it first, then do *Add to Home Screen* (iPhone reads the icon when the shortcut is created; re-add the shortcut after changing the logo).

## 8. Remaining limitations
- 🟡 Not verified on a physical iPhone 15 / real Safari (no device was available). Checklist: `docs/IPHONE-COMPATIBILITY.md`.
- iPhone web apps cannot alert while closed → use the Calendar button on reminders.
- Small on-device model: answers take seconds and can be wrong; check numbers on the Money screen.
- Home Screen app and Safari tab have separate storage.
- Backups made with v0.4.0 (unencrypted) can still be restored after you create a password; new backups are always encrypted.

## 9. GitHub status
Branch `claude/anna-completion-deployment-t9c6gw` contains all work (v0.4.0 commits `f621262 → 7827bf7`, plus the v0.4.1 owner/lock/logo commit). The branch is pushed. `main` still holds v0.3.0, so the live site is still v0.3.0 until the branch is merged (see 10). Test evidence: `docs/TEST-REPORT.md`, `test-results/`.

## 10. Production deployment (no terminal needed)
GitHub Pages is set to "Deploy from a branch: `main` / root", and the repository root is the complete site, so **merging into `main` is the deployment**:
1. On github.com open **tamanitadiwa-coder/Anna → Pull requests → New pull request**.
2. Set **base: `main`** and **compare: `claude/anna-completion-deployment-t9c6gw`** → **Create pull request** → **Merge pull request** → **Confirm merge**.
3. Wait 1–2 minutes (**Actions** tab shows "pages build and deployment" turning green).
4. Open https://tamanitadiwa-coder.github.io/Anna/ and check that Settings shows **v0.4.1** at the bottom (after unlocking). If the old version still shows, close and reopen the page once (the service worker picks up the update).
Alternative without git: unzip `anna-v0.4.1-production.zip`, on github.com **Add file → Upload files**, drag in all files and folders, commit to `main`.
Developer check: `ANNA_LIVE=https://tamanitadiwa-coder.github.io/Anna/ node test/e2e/live.mjs` verifies every file, the engine checksums, the version and offline start on the real site.

## 11. Using Anna on the iPhone
1. Safari → https://tamanitadiwa-coder.github.io/Anna/ → **Share → Add to Home Screen** (upload your logo first if you want it as the icon). Always open Anna from that icon.
2. Create your password on the welcome screen.
3. On Wi-Fi: **Brain → Download AI model** (398 MB, checked automatically) → **Load into memory** → wait for *Ready · works offline*.
4. Settings → **Anna logo** (optional), **Allow notifications** (optional), **Run diagnostics** → should say *Ready for offline use*.
5. Settings → **Export backup** regularly and save it to Files/iCloud.
After closing Anna or restarting the phone: unlock, then Brain → Load into memory (no re-download).

## 12. Moving Anna (data + identity) to another device
1. Old device: Settings → **Export backup** (encrypted with your current password) → save to iCloud Drive/Files.
2. New device: open Anna (step 11.1), on the welcome screen choose **Moving from another device? → Choose backup file…**, pick the file, enter **the password that was active when the backup was made** → *Restore and unlock*. Records, chat, memories, settings, logo and owner identity are restored, and that password becomes the new device's password.
3. Download the AI model again on the new device (it is not in backups).

## 13. Tests (final state; details in docs/TEST-REPORT.md)
| Suite | Result | Code version |
|---|---|---|
| Unit + build (`npm test`) | 38/38 ✅ | v0.4.1 |
| UI, iPhone 15 emulation | 135/135 ✅ | v0.4.1 |
| UI, desktop | 135/135 ✅ | v0.4.1 |
| Real model, Safari engine path | 30/30 ✅ | v0.4.1 |
| Real model, fast engine | 30/30 ✅ | v0.4.0 (AI code unchanged since, except the owner line in the prompt) |
| Real model downloaded from live Hugging Face | 30/30 ✅ | v0.4.0 |
| Download failure paths (cancel, corrupt, dropped, recovery) | 11/11 ✅ | v0.4.0 (download code unchanged) |
| Live site | not yet run against v0.4.1: deploy first | — |
| Physical iPhone 15 | not tested (no device) | — |

Commands: `npm ci && npm test` · `npm run build && npm run serve` · `node test/e2e/ui.mjs [desktop]` · `ANNA_MODEL_FILE=… node test/e2e/ai-real.mjs [--safari-engine]` · `ANNA_REAL_HF=1 node test/e2e/ai-real.mjs` · `node test/e2e/ai-failures.mjs`. In Claude cloud sessions, Node network scripts need `NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt`, and the environment named **"Anna"** allows huggingface.co, us.aws.cdn.hf.co and tamanitadiwa-coder.github.io.

## 14. Recovery history (v0.4.0 session)
The uploaded archives were v0.3.0; the earlier v0.4.0 work had been lost and was rebuilt. The old model-download failure was the sandbox's network policy blocking Hugging Face, not Hugging Face itself. Original archives are kept in `anna-original-archives-backup.zip`.
