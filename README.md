# Anna Web — v0.1.0

Independent browser/PWA edition of Anna for **iPhone Safari**. This is a separate project from **Anna Native** (React Native / Expo). It shares no files, database, or build with it.

## What works in v0.1.0
Tasks · Money (transactions, bills, budgets) · Business (sales, expenses, invoices, cash basis) · Brain (memories) · Data (backup export/import, currency, erase). Works offline once loaded. Money is stored in whole cents, like Anna Native.

## Not in Anna Web (needs the native app)
Chat and the on-device AI model (llama.rn can't run in a browser) · SQLite database · native file picker/model install.

## Your data
Stored in this browser's IndexedDB (falls back to localStorage). Nothing is sent to any server.
**Safari can clear website data**, so use *Data → Export backup* regularly. A Home Screen app and a Safari tab have *separate* storage on iPhone: pick one (Home Screen is best) and use backups to move data. Anna Web backups (`app: "anna-web"`) are not compatible with Anna Native backups.

## Put it on your iPhone (free, GitHub Pages)
1. Create a new GitHub repository (e.g. `anna-web`). Unzip `anna-web.zip` and upload **the contents** so `index.html` and `.github/` are at the repo root.
2. Repo → Settings → Pages → Source: **GitHub Actions**.
3. Push to `main`. The *Deploy Anna Web* action tests, builds `_site/`, and publishes it. The URL is `https://<you>.github.io/<repo>/`.
4. On iPhone: open the URL in Safari → Share → **Add to Home Screen**.

If both projects share one repo, move this workflow to the repo root, add `defaults.run.working-directory: anna-web`, and set the upload path to `anna-web/_site`. Separate repos are simpler and recommended.

## Develop
`npm test` (logic tests, Node 22) · `npm run build` · `npm run serve`. Bump the version in `package.json`, `app.js` and `sw.js` together on each release so phones update.
