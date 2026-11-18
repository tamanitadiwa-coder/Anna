# Priority 1 (offline AI load on iPhone) — investigation status

Measured, not guessed (scripts in this folder; WebKit = WebKitGTK 2.52.6 MiniBrowser via WebDriver, same JavaScriptCore engine as Safari).

## Chromium (Safari engine path = wllama compat/Asyncify build), model from OPFS
- Load 13 s; renderer 141 MB → peak ~1.0 GB → steady ~700 MB. Weights 374 MB, KV 18 MB, compute 9 MB.
- Transient ~200–330 MB is wasm compilation (liftoff-only peak 836 MB, turbofan-only 1172 MB). Not JS garbage
  (forced GC: no change), not blob reads (chunked/piecewise reads: no change). Compat build costs ~160 MB more than fast build.

## WebKit (real JSC) — failure reproduced
- Compat build, real model (Blob), n_ctx 1536 / n_batch 128: all 296 file reads (567 MB) finish in ~5 s, but the
  WebKit content process then grows to ~7 GB within ~57 s and the page stops responding (never reaches a reply).
  On a 6 GB iPhone 15 iOS kills the page well before that = "loads for minutes, then closes".
- Shared wasm memory in JSC commits pages on grow (+256 MB RSS per 256 MB grow; non-shared: +0).
- Prime suspect (not yet confirmed): JSC compiling the 14 MB Asyncify-transformed compat wasm (memory grows after reads end).
- WebKit automation sessions are ephemeral: OPFS throws UnknownError there, so the app's storage step can't run in WebKit;
  it is proven in Chromium.

## Next
1. Confirm compiler hypothesis with JSC env flags (JSC_useOMGJIT=0, JSC_useBBQJIT=0) — run was interrupted.
2. If confirmed: find a Safari-compatible path that avoids the Asyncify build (newer wllama, or another engine)
   and verify a real offline reply in WebKit before replacing anything. Keep the cached model.
3. Then add load progress/errors/retry polish as needed (stages + cancel already exist in v0.5.0).
No app code changed in this phase yet.
