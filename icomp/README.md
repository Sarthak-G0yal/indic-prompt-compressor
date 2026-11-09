# icomp: the Indic Prompt Compressor layer (app)

A small Python app that sits **between the user and the LLM**.
It cleans and compresses Hindi / Kannada / Tamil prompts using the methods validated in Experiment 01, sends them to the target model through the Sarvam API,
translates English answers back, and reports tokens saved, ₹ saved and the expected quality.

```
user prompt ─▶ detect language ─▶ M1 clean-up ─▶ rule router ─▶ method (translate / prune / romanise …) ─▶ LLM (Sarvam API)
                                                     │                                                         │
                                                     └── guards (short prompt, numbers, code, low saving) ◀── answer ─▶ back-translate ─▶ user + savings report
```

## Plan

| Part | File | What it does |
|---|---|---|
| Config | `config.py` | paths, `.env`, model list, ₹ prices, thresholds |
| Text utils | `text.py` | M1 normalisation, sentence/line splitting, script → language detection, romanisation, digit/Latin ratios |
| Tokens | `tokens.py` | offline token counts per target model (HF tokenizers in `models/tokenizers/`) |
| Local models | `local_models.py` | lazy, cached IndicTrans2 (both directions), LLMLingua-2, LaBSE. A VRAM budget evicts the least-recently-used model on the 4 GB GPU |
| Methods | `methods.py` | M0, M1, M2_80/60/40, M3, M3_b5, M3h, M4, M5, M5_80, M6: build the LLM messages plus the post-processing for each |
| Rules | `routing_rules.toml` | the routing table **filled from the Run 4 results** (`results/01_deepseek/summary.csv`): target family × language × task × profile → method, with the measured saving and quality |
| Router | `router.py` | looks up the table, applies the guard rules, and returns the method plus human-readable reasons |
| LLM client | `llm.py` | async Sarvam chat client (thinking off where possible, retries, usage, ₹ cost) |
| Pipeline | `pipeline.py` | `Compressor.preview()` (free: compressed prompt and token estimate only) and `Compressor.run()` (call the LLM, back-translate, run the "not mentioned" fallback, report). Optional **compare mode**: also sends the original prompt and lets `sarvam-105b` judge both answers |
| Server | `server.py` | FastAPI: `/api/health`, `/api/options`, `/api/examples`, `/api/preview`, `/api/run`; also serves the frontend |
| Frontend | `static/index.html` | one page, no build step: input form, routing decision, compressed prompt, answer, savings, compare view, session totals |
| Tests | `tests/test_router.py` | router and text utilities (no models, no API) |

### Routing rules (rule-based, no ML)
1. **Profile** `balanced` (default) = the cheapest method whose mean quality is ≥ 95% of the original. `safe` = the cheapest method whose 95% CI lower bound is ≥ 95%.
2. **Table lookup** by (target family, language, task). DeepSeek rows are measured. GLM rows reuse the DeepSeek choice and are marked *projected* (only the tokenizer saving was measured).
   Models with Indic-efficient tokenizers (sarvam-105b, gemma4) get only M1: translating saves little there and was never validated.
3. **Guards**, applied in order:
   - not an Indic script (or mostly Latin/code) → M1, no translation;
   - prompt shorter than `min_tokens` → M1 (the saving is not worth the latency);
   - many digits and the chosen method prunes the text → the same route without pruning (M5 → M3, M2_xx → M1). Pruning dropped numbers in Run 4 (52.52% → 32%);
   - task `chat` (free-form, not validated) → M3_b5 if the prompt is long, else M1;
   - after preparing the prompt, if the measured saving with the target tokenizer is < `min_saving` → M1.
4. **Fallback:** if an English-route QA answer says "not mentioned / does not say", re-send the original prompt (M0), and count that cost too.
5. The user can override the method in the UI or the API.

## Run it
```bash
uv sync                                   # adds fastapi + uvicorn (in pyproject)
uv run uvicorn icomp.server:app --port 8000
# open http://localhost:8000
uv run pytest icomp/tests -q              # router / text tests (no GPU, no API)
```
The first request that needs a local model loads it (IndicTrans2 ≈ 10 s, LLMLingua-2 ≈ 10 s, LaBSE only for M3h). Later requests reuse it.
Settings via `.env`: `SARVAM_API_KEY` (required), `ICOMP_DEVICE` (`cuda`/`cpu`), `ICOMP_GPU_BUDGET_MB` (default 2600), `ICOMP_CACHE` (`1` = disk-cache API calls).
