# Anna's AI model

| Field | Value |
|---|---|
| Model | **Qwen2.5-0.5B-Instruct** (Alibaba Cloud, Qwen team), instruction-tuned chat model |
| Format / quantisation | GGUF, **Q4_K_M** (4-bit k-quant, medium) |
| GGUF publisher | `bartowski/Qwen2.5-0.5B-Instruct-GGUF` on Hugging Face |
| Exact version | Hugging Face commit **`41ba88dbac95fed2528c92514c131d73eb5a174b`** (2024-09-19) |
| File | `Qwen2.5-0.5B-Instruct-Q4_K_M.gguf` |
| Size | **397 808 192 bytes** (398 MB) |
| **SHA-256** | **`6eb923e7d26e9cea28811e1a8e852009b21242fb157b26149d3b188f3a8c8653`** |
| Architecture (read from the GGUF at load) | `qwen2`, `general.name` = "Qwen2.5 0.5B Instruct" |
| Context used by Anna | 2 048 tokens |
| Licence | Apache-2.0 |
| Download URL used by the app | `https://huggingface.co/bartowski/Qwen2.5-0.5B-Instruct-GGUF/resolve/41ba88dbac95fed2528c92514c131d73eb5a174b/Qwen2.5-0.5B-Instruct-Q4_K_M.gguf` |

## How the checksum was established
1. Hugging Face's API (`/api/models/bartowski/Qwen2.5-0.5B-Instruct-GGUF?blobs=true`) publishes the LFS SHA-256 of the file: `6eb923e7…8c8653`, size 397 808 192.
2. The file was downloaded from the pinned commit URL above and hashed with `sha256sum`: **identical**.
3. Anna's own JavaScript SHA-256 (`sha256.js`) hashed the same file: **identical** (3.2 s on the test machine).
4. In the browser test against live Hugging Face, the file Anna stored in OPFS hashed to the same value.

The URL is pinned to a commit, so the bytes cannot change. Anna re-checks the hash after every download and before loading if its verification record is missing; a mismatch deletes the file.

## Why this model (decision record)
Requirement: a genuinely useful assistant that runs **offline inside iPhone Safari** without crashing.

| Candidate | Size | Verdict |
|---|---|---|
| **Qwen2.5-0.5B-Instruct Q4_K_M** | 398 MB | **Chosen.** Real tests: correct, fluent answers about the user's data (rand amounts, memories, percentages), follows the system prompt, multilingual. Small enough for Safari's per-page memory on a 6 GB iPhone 15. |
| Qwen2.5-0.5B Q8_0 | 531 MB | Slightly better quality, +33% memory and download; not worth the crash risk on iPhone. |
| Qwen2.5-1.5B / Llama-3.2-1B (Q4) | 0.8–1.1 GB | Better answers but 2–3× slower on a phone CPU and a real risk of iOS terminating the page while loading. |
| SmolLM2-360M | ~270 MB | Faster but noticeably weaker at following instructions and using the data block. |

Engine: **wllama 3.5.1** (llama.cpp compiled to WebAssembly). It is the most mature in-browser GGUF runtime, has a dedicated Safari ("compat") build, writes to OPFS through a worker (needed on iPhone), and was proven here with the real model on both its normal and Safari code paths. WebGPU engines (e.g. WebLLM) were not chosen: WebGPU on iPhone is newer and memory-hungrier, and a crash-free CPU path matters more than speed for daily use. The GPU switch remains available as an experiment.

## Measured behaviour (test machine, not an iPhone)
4-vCPU cloud Xeon, headless Chromium, single thread (GitHub Pages cannot enable multi-threading):
- Load from OPFS: ~5–6 s. Prompt reading: ~5 tokens/s. Generation: ~3 tokens/s.
- After loading, Anna pre-reads the system prompt + data (~230 tokens) in the background, and the engine keeps it cached, so follow-up questions answer in ~10 s.
- These numbers are dominated by this slow virtual CPU; an iPhone 15 (A16) should be several times faster, but **this has not been measured on real hardware**.

Sample real answers (from `test-results/ai-real*.json`):
- “How much did I spend on groceries this month?” → *“You spent R 450,00 on groceries this month.”* (correct)
- Offline: “When is my sister Lindiwe’s birthday?” → *“Your sister Lindiwe's birthday is on 3 March”* (from a saved memory)
- Offline after browser restart: “What is 15% of R2000?” → *“15% of R2000 is R300.”*
