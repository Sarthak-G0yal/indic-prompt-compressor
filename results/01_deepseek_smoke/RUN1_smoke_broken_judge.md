# Run 1: smoke run, first attempt (judge bug)

**Date:** 2026-11-07 · **n = 5** per (language × task) · methods M0, M0_rep, M1, M2 (keep 60%), M3, M4, M5, M6 · judge `sarvam-105b` with `reasoning_effort: "low"` (the bug)

Shared setup (data, prompts, methods, metrics): [`../00_SETUP.md`](../00_SETUP.md) · Index of all runs: [`../README.md`](../README.md)

> The per-item files of this run were overwritten by Run 2 (same folder). Only this write-up remains. Its quality numbers are **invalid** because 26% of verdicts were missing; token numbers are valid.


Smoke run: 5 items per (language × task), 8 methods, target `deepseekv4.1-flash-1017` (thinking off), judge `sarvam-105b`.
**With n = 5, quality numbers are only directional.** Token numbers are reliable: they are exact and identical when re-sent (see M0_rep).

## 1. The gap (FLORES+ devtest, ~1000 sentences): this result is solid
Parity = tokens vs the same content in English.

| Tokenizer | hi | kn | ta | ITRANS romanisation hi / kn / ta |
|---|---|---|---|---|
| **GLM-5.3** | 4.31 | **8.85** | **7.64** | 2.52 / 2.69 / 3.89, a big gain |
| **DeepSeek V4.1** | 2.79 | 3.69 | 3.07 | 2.53 / 2.70 / **3.64 (worse)** |
| GPT-4o (o200k) | 1.57 | 1.97 | 1.98 | 2.39 / 2.50 / 3.42 (worse) |
| Gemma 4 | 1.31 | 1.92 | 1.47 | worse |
| Sarvam-105B | 1.31 | 1.51 | 1.47 | worse |

- Kannada is the most expensive language on every tokenizer. On GLM it costs ~9× English.
- **Romanisation only pays off on tokenizers that are bad at Indic** (GLM; DeepSeek for hi/kn). On Indic-aware tokenizers it *adds* tokens.
  → The best method depends on the target tokenizer, so the router must take the target model as an input.

## 2. Savings vs quality on DeepSeek (smoke; total cost saving vs M0)

| Method | Input saving | Total ₹ saving | Projected GLM-5.3 saving | Quality (directional) |
|---|---|---|---|---|
| M1 normalise | 0–2% | ~0% | ~0% | = M0. Wikipedia text is already clean; this needs real user prompts to matter |
| M2 LLMLingua-2 (keep 60%) | 33–38% | 19–36% | 23–38% | held for hi/kn; ta QA dropped (2/4) |
| **M3 via English (IndicTrans2)** | **57–67%** | **57–67%** | **72–85%** | mostly held; kn QA 0.8 |
| **M5 English + LLMLingua** | **71–79%** | **63–75%** | **80–89%** | QA held; summarisation judge failed (see §3) |
| M4 ITRANS romanise | −18% to +27% | −16% to +25% | 28–64% | dips (ta summ 0.63) → **not useful on DeepSeek**, maybe on GLM |
| M6 answer in English | ~1% in, ~50% out (summ) | 17–29% (summ), ~0 (QA) | — | **bad for QA** (back-translating 2-word answers breaks them) |

Other observations:
- Thinking-off works: 0 reasoning tokens, no truncation, no API errors.
- For QA, output is about 10 tokens, so the cost is all input. For summaries, output is about 200 tokens (≈35% of cost), so output-side methods (M3/M5/M6) matter there.
- Via-English also shrinks the **output** by about 50–70%, because the English answer is shorter and the back-translation is local.
- Token-F1 drops for M3/M5 even when the judge says the answer is correct. Back-translation changes the wording, so F1 is unfair to these methods and the judge is needed.
- Local overhead: IndicTrans2 (beam 5) adds **1–4 s per item**. That latency cost should be reported.

## 3. Bug: the judge returned empty output for 63 / 240 answers (26%)
`sarvam-105b` with `reasoning_effort: "low"` still thinks for more than 1,500 and even more than 4,000 tokens, so it hits `max_tokens` before writing the JSON
(190 empty responses, all `finish_reason: length`). It hits summaries and English-route methods the hardest (M5/M6 summaries: 4–5 of 5 missing),
so the missing cells **bias the comparison**. It also inflates the M0-vs-M0_rep "noise" (ta summ 0.85).

Fix: judge with thinking off (`reasoning_effort: "none"`), plus a fallback retry with a large budget. Then rerun from section G only; target outputs are cached.

## 4. Next steps (proposed)
1. Fix the judge, then re-judge the smoke run (free for the target, about 240 judge calls).
2. Run the full experiment (`SMOKE = False`, 50 per cell). Target ≈ 2,400 calls, judge ≈ 2,400, about 1 hour because of rate limits, and well under ₹200.
3. Method changes before the full run:
   - LLMLingua rate sweep (0.4 / 0.6 / 0.8) to draw a real savings–quality curve.
   - M6 for summarisation only.
   - Keep M4 as a documented negative result on DeepSeek.
   - IndicTrans2 `num_beams` 5 → 2 to cut latency, and measure the quality impact.
4. Judge validation: regenerate `hindi_spotcheck.csv` after the fix (the current one is from the broken judge), add the perturbation suite, and add gemma4 as a second judge.
5. Then the router (E3), and the cross-model test on GLM-5.3-Flash, where via-English and romanisation should save the most.
