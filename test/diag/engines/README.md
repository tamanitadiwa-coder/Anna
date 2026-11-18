# Engine comparison work in progress (webllm-wip)
WebKit (WebKitGTK 2.52, JavaScriptCore) measurements, no WebGPU adapter available in the sandbox:
- wllama 3.5.1 and 3.13.0 + Qwen2.5-0.5B Q4_K_M (Safari/compat build): web process > 2.5 GB within 16 s of load, then 7 GB / hang. FAIL.
- Transformers.js 4.3.2 (ORT plain WASM via esbuild alias, entry.mjs) + Qwen2.5-0.5B ONNX q4 (786 MB): peak 4.2 GB. FAIL (> 1.2 GB).
- SmolLM2-360M / 135M ONNX q4 on Transformers.js WASM: not measured yet (tokenizer path bug found: env.localModelPath must not be a full URL).
- WebLLM (WebGPU): cannot run here; needs the iPhone.
Live diagnostic page for the iPhone: main/test/ai.html (https://tamanitadiwa-coder.github.io/Anna/test/ai.html).
Files: wkeng.mjs = WebKit harness (Xvfb + WebKitWebDriver + MiniBrowser), *.html = per-engine test pages, entry.mjs = Transformers.js bundle entry.
Next: run test/ai.html on the iPhone 15, pick the engine that loads and replies offline, then wire it into ai.js (Home chat) with progress/error/retry.
