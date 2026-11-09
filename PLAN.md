# Indic Prompt Compressor — Understanding & Experiment Plan

_Last updated: 2026-11-07 (v6: develop on `deepseekv4.1-flash-1017` with thinking OFF; `glm5.3-flash` / `glm5.3` for the cross-model test at the end)_

## 0. Decisions so far
| Decision | Choice |
|---|---|
| Experiment format | Jupyter notebooks (`.ipynb`), with reusable code in a `src/` package that the notebooks import |
| Environment | `uv` (pyproject + lockfile), with a Jupyter kernel registered from the uv venv |
| Inference | **Sarvam API** for everything (credits available; cost is not a constraint for testing) |
| **Development target** | **`deepseekv4.1-flash-1017`, thinking OFF** (`reasoning_effort: "none"`): clean, repeatable token counts; gap 3–4× on Indic (₹25/₹105 per 1M) |
| **Cross-model test (end of project)** | **`glm5.3-flash`**, then **`glm5.3`**: rerun the finished compressor to show savings on the worst-gap tokenizer (4.7–8.9×) |
| **Main judge** | **`sarvam-105b`**: strong in Indic languages, and a different family from GLM (no self-preference bias) |
| Decision model | **Laya** (open weights, local) only. **Jev dropped** (needs a subscription) |
| Translation | Local: IndicTrans2-dist-200M + sarvam-translate 4B Q4 GGUF (Ollama). Sarvam `/translate` API is the quality reference only |
| Quality threshold | **τ = 95%** of original-prompt answer quality |
| Human labels | Kannada/Tamil: none → automatic judge validation (§3b). **Hindi: the user spot-checks ~30 items** |
| Sample size | 50 items per language × task for all methods (screening); 100 for the top 3 methods + the router (confirmation) |
| Framing | Report findings as they are. If "via English" wins, that *is* the result, together with what it costs in nuance |

## 1. Problem, restated precisely
- LLMs charge for, slow down with, and are limited by the number of **tokens**. English-centric tokenizers split Indic scripts into many
  more tokens. The measures we use: **fertility** (tokens per word) and **parity ratio** (`tokens(Indic) / tokens(parallel English)`).
- The deliverable is a middleware layer, `app → compressor → target LLM`, that:
  1. **Measures the gap**: the parity ratio per language for each model's tokenizer.
  2. **Closes the gap**: picks the cheapest transform with quality ≥ τ, and reports tokens saved, ₹ saved and the change in quality.
- Phase-1 scope: **Hindi, Kannada, Tamil**, **QA + summarisation**.

## 2. Models

### 2a. Measured tokenizer gap (one parallel news sentence, run 2026-11-07, `scripts/tokgap.py`)
Tokens for the same sentence; × = ratio vs English on the same tokenizer:

| Tokenizer (Sarvam model) | en | hi | kn | ta | hi romanised |
|---|---|---|---|---|---|
| GLM-5.3 (`glm5.3`, `glm5.3-flash`) | 35 | 164 (**4.7×**) | 311 (**8.9×**) | 288 (**8.2×**) | 73 (2.1×) |
| DeepSeek V4.1 (`deepseekv4.1-flash-1017`) | 35 | 100 (2.9×) | 132 (3.8×) | 107 (3.1×) | 71 (2.0×) |
| Gemma 4 (`gemma4`) | 35 | 40 (1.1×) | 54 (1.5×) | 41 (1.2×) | 64 (1.8×) |
| Sarvam (`sarvam-105b`) | 35 | 40 (1.1×) | 45 (1.3×) | 41 (1.2×) | 64 (1.8×) |
| GPT-4o (o200k, reference) | 35 | 42 (1.2×) | 56 (1.6×) | 61 (1.7×) | 71 (2.0×) |

This is one sentence only; E1 repeats it on FLORES (about 1000 sentences). Early takeaways:
- **GLM has the worst Indic gap, by far**: Kannada/Tamil cost about 8–9× English. This is the strongest case for the project.
- **Gemma 4 and Sarvam have almost no gap**: compression has little to save there, and **romanising makes them worse** (1.1× → 1.8×).
- **Romanisation helps only on GLM/DeepSeek** (Hindi 4.7× → 2.1× on GLM). Whether a method helps depends on the tokenizer, which is why the router needs the target model as a feature.

### 2b. Model roles
| Model | Role | ₹/1M in / cached / out | Thinking | Notes |
|---|---|---|---|---|
| `glm5.3-flash` (v2) | **Cross-model test** (end) | 13.5 / 2.5 / 45 | always on (default `high`); use `low` | **same tokenizer as `glm5.3`**, so token savings transfer exactly; no stated rate limit (check in E0); set `max_tokens` explicitly (no small default) |
| `glm5.3` (v2) | **Cross-model test** (end) | 126 / 20 / 390 | always on (default `max`); use `low` | rerun the finished compressor on a subset; report real ₹ saved |
| `sarvam-105b` (v1/v2) | **Main judge** | 15 / 5 / 60 | can be off (`reasoning_effort="none"`) | Indic-native (10 languages + English) |
| `deepseekv4.1-flash-1017` (v2) | **Development target** (thinking off) | 25 / 0.5 / 105 | **can be off** | gap 3–4×; use it as the target if GLM-flash thinking noise is too high |
| `gemma4` (v2) | Not a target | 35 / 10 / 90 | off by default | almost no gap; shown only in the gap chart |
| Laya (local) | Router | free | — | see §3a |

**Why `glm5.3-flash` for development:** (1) its tokenizer is byte-identical to GLM 5.3 (same `tokenizer.json` hash on Hugging Face), so every
token-savings number we measure *is* GLM 5.3's number; (2) it is the cheapest model on Sarvam, so we can iterate a lot; (3) the gap is huge, so there is
plenty to save. **What does not transfer:** answer quality, because Flash is a smaller model. That is why the final step re-checks quality on `glm5.3`.
**Risk:** it always thinks (it can't be turned off), which adds noise to output tokens and latency. We log input / reasoning / answer tokens separately. If the noise is
too large, we switch the development target to `deepseekv4.1-flash` with thinking off.

Offline token counting (no API calls) uses the HF tokenizers above: `zai-org/GLM-5.3(-Flash)`, `deepseek-ai/DeepSeek-V4.1-Flash-1017`,
`google/gemma-4-31B-it`, `sarvamai/sarvam-105b`, plus tiktoken. The Sarvam model ids were matched to these repos **by name**, so E0 checks
that offline counts equal the API's `usage.prompt_tokens` (minus chat-template overhead).

## 3. Quality evaluation ("good enough")
- **Quality retained** = score(method) / score(M0), both answered by the same target (`deepseekv4.1-flash-1017` in development; GLM models in the cross-model test). Pass = **≥ 0.95**, judged on the lower bound of a
  paired-bootstrap 95% CI, not only the mean.
- **QA:** EM / token-F1 vs gold (no judge needed) + judge verdict (correct / partial / wrong).
- **Summarisation:** chrF++ vs reference + judge score 1–5 for faithfulness, coverage and fluency.
- **Fidelity (reference-free):** LaBSE / multilingual-e5 similarity between the M0 answer and the method's answer.
- **Judge protocol (`sarvam-105b`):** temperature 0, fixed `reasoning_effort`, rubric prompt in English with Indic content, JSON output.
  For pairwise comparisons, judge both answer orders (position bias). Run M0 twice to measure the noise floor.
- Headline output: a **Pareto plot** per language × task (x = tokens saved %, y = quality retained %).

### 3a. Laya: what it can and can't do here (researched 2026-11-07)
| Checkpoint | Base | Params | Context | Languages |
|---|---|---|---|---|
| `convaiinnovations/laya` | ModernBERT-large | 421M | 512 | English only |
| `convaiinnovations/laya-multilingual` | mmBERT-base | 322M | 1024 (up to 8192) | "100+", 45/51 usable on MASSIVE |
| `convaiinnovations/laya-typed-decisions` | ModernBERT-large | 421M | 1024 | English |

Install with `pip install laya` (Python ≥3.10; `laya[onnx]` for ONNX Runtime), then `laya.load(...)`, `agent.predict(state, questions)`. Licence Apache-2.0.

**Indic support (from the model card, MASSIVE 20-way intent, random = 0.05):**
- **Hindi 0.387**: usable but weak.
- **Tamil 0.250**: listed under "low-resource languages are weak".
- **Kannada: not reported at all.** Your suspicion is right: treat it as unsupported.
- The multilingual checkpoint **ships uncalibrated** ("systematically over-confident"). Refitting temperatures on held-out data cuts ECE from 0.314 to 0.106.

**Consequences for our design:**
1. **Laya is not used as a judge on Indic text.** At 0.25–0.39 accuracy on a simple intent task, it can't judge meaning in Tamil or Kannada.
2. **Laya as the router (M7) still works, because we feed it English.** The router input is a structured English description of the request
   (language, task, char length, token count under GLM, script, digit/entity counts, the English-translated prompt, the M1–M4 token counts).
   The English `laya` / `laya-typed-decisions` checkpoint then picks the method. So the Kannada gap doesn't matter.
3. We refit Laya's calibration (temperature per question type) on our own E2 results before trusting its probabilities.
4. Optional extra: Laya as a cheap judge on **English back-translations** of the answers, reported only as agreement with Sarvam. Not used in the headline results.

### 3b. Validating the judge without human labels
Nobody can hand-label Kannada/Tamil, so we test the judge automatically:
1. **Gold anchoring (QA):** IndicQA has gold answers. Check that Sarvam's correct/wrong verdicts agree with EM/F1 vs gold (target: high agreement).
2. **Perturbation suite:** take M0 answers and inject known errors (flip a negation, change a number, swap a named entity, delete a key sentence,
   or answer in the wrong language). The judge must catch ≥ 90% of them, and must also not penalise harmless paraphrases.
3. **Inter-judge agreement:** `sarvam-105b` vs `gemma4` (Cohen's κ) per language (DeepSeek is now the target, so it can't judge itself).
4. **Self-consistency:** re-judge 10% of items and report how often verdicts flip.
5. **Hindi human spot-check:** the user hand-labels ~30 Hindi judgements (blind to the judge's verdict); we report agreement.

A language's judge scores are trusted only if 1 and 2 pass for that language. Otherwise we report that language with metrics only (EM/F1, chrF++, embedding similarity).

## 4. Methods
| ID | Method | Implementation | Note |
|----|--------|----------------|------|
| M0 | Baseline | raw prompt | — |
| M1 | Normalise + de-redundancy | NFC, ZWJ/ZWNJ cleanup, whitespace, sentence dedupe, filler lists | free, safe |
| M2 | Keep what matters | LLMLingua-2 (xlm-roberta-large), rate 0.5–0.8 | local GPU |
| M3 | Via English | **local** (a) IndicTrans2-dist-200M (fast, ~1 GB) and (b) sarvam-translate 4B Q4 GGUF in Ollama (~2.5 GB). `/translate` API = full-precision reference | §6 cost trap |
| M4 | Romanise | rule-based ISO/ITRANS vs natural romanisation (`/transliterate`, or IndicXlit locally) | can *increase* tokens |
| M5 | Combos | M1→M3→M2, M1→M2 | — |
| M6 | Output-side | GLM answers in English → translate back locally | GLM output costs 3× input, and an Indic answer is 5–9× more tokens |
| M7 | Auto-router | logistic-regression baseline vs **Laya** (English features, §3a) | must not need the M0 answer at inference time |

**Running sarvam-translate locally:**
- Official `sarvamai/sarvam-translate` is a 4B model fine-tuned from Gemma-3-4B-IT, covering 22 Indian languages + English. In bf16 it is ~8 GB, which doesn't fit 4 GB VRAM.
- Use a **community** Q4 GGUF: `ollama run hf.co/fischerman/sarvam-translate-gguf:Q4_K_S` or `trysem/sarvam-translate-Q4_K_M-GGUF` (~2.5 GB).
  These are unofficial: compare a sample against the `/translate` API. Use the prompt format from the official model card, and check the licence.
- The GPU holds one model at a time. Run stages in batches: translate everything, unload (`keep_alive=0`), then run the next stage.

## 5. Data
- **Gap:** FLORES-200 devtest (eng/hin/kan/tam parallel).
- **QA:** IndicQA (AI4Bharat), about 50–100 items per language (has gold answers → needed for §3b).
- **Summarisation (exp 01):** a separate set of IndicQA paragraphs (600–3000 chars), **reference-free**: judge score + LaBSE fidelity to the M0 summary. XL-Sum/IndicNLG with references can be added later.
- Fixed seeds, frozen sample IDs in `data/samples/*.jsonl`. Keep a held-out split for the router (M7) and for Laya calibration.

## 6. Things to consider (risks and gotchas)
1. **GLM (Flash and full) always thinks.** Reasoning can't be turned off, it is billed as output, and it counts toward `max_tokens`. Fix
   `reasoning_effort="low"` for all runs, set `max_tokens` high enough (≥ 4096) to avoid empty answers, and log **input / reasoning / answer
   tokens separately**. Compression mainly affects input, so the headline is input savings, with total-cost savings reported alongside.
   Reasoning length is noisy and may itself change with prompt language. That is worth reporting.
2. **Paid translation costs more than it saves.** `/translate` costs ₹2 per 1,000 chars, against about ₹0.01 (Flash) to ₹0.07 (GLM 5.3) of input for the same 1,000 Hindi chars.
   So the transforms must be **local** for net savings. Every ₹ figure includes overhead and latency.
3. **Prompt caching:** compression must be deterministic, or it breaks cache hits.
4. **API limits:** translate ≤ 1,000/2,000 chars per call (chunk long docs). Rate limits are about 50–60 req/min: async client + throttle + retry on 429 (402 = out of credits).
5. **Response cache on disk** (model + params + prompt hash), so notebooks re-run for free and give the same results.
6. **Answer language:** a Hindi question gets a Hindi answer. Through-English and output-side methods are scored *after* back-translation.
7. **Named entities, numbers and negation:** track their preservation separately (they are also used in the perturbation suite).
8. **Statistics:** about 50 items per cell is small, so report CIs and the M0-vs-M0 noise floor. If noise is about 3%, τ = 95% is close to the noise.
9. **Secrets:** `SARVAM_API_KEY` in `.env` (git-ignored), never printed in notebook outputs.
10. **Router chicken-and-egg:** at request time we can't run M0, so the router predicts the outcome from features learned on E2.

## 7. Repo layout
```
pyproject.toml / uv.lock / .env (ignored)
src/icomp/        tokenizers.py, methods/, sarvam_client.py (async+cache), local_models.py (Ollama, IndicTrans2, Laya),
                  judge.py, perturb.py, router.py, metrics.py
notebooks/        00_setup_checks, 01_gap_measurement, 02_methods_smoke, 03_judge_validation,
                  04_qa_eval, 05_summ_eval, 06_router, 07_glm53_validation, 08_report   (.ipynb)
data/             raw/ (downloads), samples/ (frozen eval sets)
cache/            API response cache
models/           local weights (Laya, IndicTrans2), git-ignored
results/          *.jsonl per run, *.csv summaries, figures/
```

## 8. Experiment sequence
- **E0 – Setup** (`00`): uv env + kernel. Sarvam smoke test: list `/v2/models`, call `glm5.3-flash`, `sarvam-105b`, `deepseekv4.1-flash-1017`; check how `usage` splits reasoning tokens,
  measure M0-vs-M0 noise for Flash at `low`, check rate limits, compare offline token counts vs API `prompt_tokens`. Pull the sarvam-translate GGUF and compare 10 sentences vs `/translate`. `pip install laya`, run one decision.
- **E1 – Gap** (`01`): parity ratio per tokenizer × language on FLORES, plus the token-count upper bound for each of M1–M4 (no LLM calls).
- **E2a – Judge validation** (`03`): gold anchoring + perturbation suite + inter-judge agreement, per language.
- **E2b – Methods × langs × tasks** (`04`, `05`): `glm5.3-flash` answers, Sarvam judges. 50 items per cell, then 100 for the top 3 methods.
- **E3 – Router** (`06`): logistic regression vs Laya (English features, recalibrated); savings at τ = 95% and how often it falls back to M0.
- **E3b – GLM 5.3 validation** (`07`): run M0 vs the finished compressor (router) on a subset with `glm5.3`; report real ₹ saved and quality retained.
- **E4 – Report + demo** (`08`): Pareto plots, savings tables, a per-prompt report, and the "findings" narrative (incl. if via-English wins).

## 9. Status
- **Experiment 01** is ready to run: `notebooks/01_deepseek_experiment.ipynb` (see README.md). It covers E0 smoke checks, E1 gap measurement, E2b methods × langs × tasks,
  gold anchoring and the Hindi spot-check sheet. Still to build: perturbation suite (§3b.2), second-judge agreement, router (E3), cross-model GLM test.

## 10. Sources
- Sarvam API docs: https://docs.sarvam.ai (models, pricing, `/translate`, `/transliterate`, rate limits); GLM-5.3 page: https://docs.sarvam.ai/api/token-factory/models/glm-5-3
- GLM-5.3 / Flash weights + tokenizer: https://huggingface.co/zai-org/GLM-5.3 , https://huggingface.co/zai-org/GLM-5.3-Flash
- Model pages: https://docs.sarvam.ai/api/token-factory/models/glm-5-3-flash , .../deepseek-v4.1-flash-1017 , .../gemma-4-31b ; https://docs.sarvam.ai/api/getting-started/models/openweight
- Laya: https://huggingface.co/convaiinnovations/laya , https://huggingface.co/convaiinnovations/laya-multilingual , https://github.com/NandhaKishorM/laya
- sarvam-translate GGUF (community): https://huggingface.co/fischerman/sarvam-translate-gguf , https://huggingface.co/mashriram/sarvam-translate_q4_km.gguf
- Sarvam-Translate on Gemma 3: https://deepmind.google/models/gemma/gemmaverse/sarvam-ai/
- Jev & Laya as decision layers: https://arxiv.org/pdf/2609.28940
