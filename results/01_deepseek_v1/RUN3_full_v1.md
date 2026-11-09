# Run 3: full run v1

**Date:** 2026-11-08 · **n = 50** per (language × task) · methods M0, M0_rep, M1, M2_40/60/80, M3, M4, M5, M6 · target `deepseekv4.1-flash-1017` (thinking off) · judge `sarvam-105b` (thinking off) · 2,850 target + 2,850 judge calls, 0 errors, 0 missing verdicts · files in this folder (backup copy of `01_deepseek/` taken before Run 4)

Shared setup (data, prompts, methods, metrics): [`../00_SETUP.md`](../00_SETUP.md) · Index of all runs: [`../README.md`](../README.md)

## 1. Noise floor (M0_rep = the identical prompt sent again)
- QA: M0_rep matches M0 on 98–100% of items, so QA verdicts are very stable.
- Summaries: per-item scores differ on 32–54% of items, but the means stay within 0.98–1.00 of M0.
  So summary means are reliable, but per-item summary scores are noisy and can't be used as single-item training labels.

## 2. Cost saving / quality retained (retained = judge mean vs M0; [CI lower bound])

| Method | hi QA | hi summ | kn QA | kn summ | ta QA | ta summ |
|---|---|---|---|---|---|---|
| M1 normalise | 0% / 1.00 | −2% / 0.99 | 1% / 1.01 | 2% / 1.00 | 0% / 0.97 | −1% / 0.99 |
| M2_80 | 16% / 0.99 [.96] | 10% / 0.97 [.948] | 17% / 1.04 [.99] | 12% / 1.00 [.98] | 17% / 1.01 [1.0] | 11% / 0.99 [.97] |
| M2_60 | 33% / 0.97 | 21% / 0.96 | 33% / **0.92** | 22% / **0.93** | 35% / **0.92** | 26% / 0.96 |
| M2_40 | 51% / **0.86** | 33% / **0.91** | 50% / **0.86** | 32% / **0.83** | 53% / **0.85** | 37% / **0.94** |
| **M3 via English** | 55% / 0.97 [.91] | 54% / 0.96 [.91] | 64% / 0.98 [.88] | **62% / 0.99 [.95]** | 60% / **0.90** | 57% / 0.99 [.95] |
| **M5 English + LLMLingua** | **70% / 1.00 [.97]** | 62% / **0.94** | 75% / **0.92** | 67% / **0.92** | 73% / **0.92** | 64% / 0.96 [.91] |
| M6 English answer (summ) | — | 19% / 1.00 [.97] | — | 31% / 0.99 [.95] | — | 18% / 0.98 [.94] |
| M4 ITRANS | 6% / 1.01 | 1% / 0.97 | 24% / 1.00 | 9% / **0.95−** | **−15% / 0.72** | **−7% / 0.72** |

Bold quality = below τ. With n = 50, one QA item is 2 points, so the CIs are about ±5–9 points.

## 3. Findings
1. **Via English (M3) is the best general method.** It saves 54–64% on DeepSeek (70–84% projected on GLM-5.3) and passes τ on the mean in 5 of 6 cells.
   It fails on **Tamil QA (0.90)**. The failures are IndicTrans2 ta→en *translation errors*, not the LLM:
   - புற்றுநோய் (cancer) → "Psoriasis"
   - சைன் → "Jaya"
   - "R. K. Narayan" → "K. Narayanan"
   - an answer that was present got lost ("Not mentioned in the context").
2. **M5 (English + pruning) is the cheapest (62–75%), but passes only for Hindi QA (1.00) and Tamil summaries (0.96).**
   Pruning the English text after translation drops facts: for example "52.52%" became "32%", and specific named entities were replaced by vaguer ones.
3. **Pruning in the original script (M2):**
   - Keeping 80% is safe everywhere: it passes on the mean in all 6 cells (the only method that does), with the CI lower bound ≥ 0.95 in 5 of 6. But it saves only 10–17%.
   - Keeping 60% holds for Hindi but drops to 0.92–0.93 for Kannada.
   - Keeping 40% fails everywhere.
   - The smoke run suggested "Hindi tolerates heavy pruning". At n = 50 that is weaker: Hindi M2_40 is also only 0.86.
4. **M6 (answer in English, then back-translate) for summaries is a nearly free 18–31% saving** with no measurable quality loss. It is output-side only, so it stacks with any input method.
5. **Romanisation (M4) is a negative result on DeepSeek.** It saves nothing, and on Tamil it costs *more* tokens and quality collapses to 0.72.
   Tamil script is ambiguous in ITRANS (for example, க = ka/ga/ha), so the model misreads the text. It is worth testing only on GLM, and only for hi/kn.
6. **Judge sub-scores for summaries:**
   - Via-English summaries score *higher* on coverage than M0 (kn 4.70 vs 4.42; ta 4.56 vs 4.14), because the English model summarises more completely.
   - They score lower on faithfulness (≈4.6 vs 4.9–5.0). Translation noise introduces small factual slips.
   - That is the trade-off to report.
7. **Local overhead:** IndicTrans2 adds 0.8–2.4 s per item on the RTX 3050 Ti, and M2 adds 0.13–0.24 s. Neither costs any ₹.

## 4. What a router can achieve

| Policy | DeepSeek ₹ saving | GLM-5.3 projected | Quality |
|---|---|---|---|
| Always M3 | 58% | — | fails ta QA (0.90) |
| Always M5 | 67% | — | fails 4 / 6 cells |
| **Best fixed method per cell** (hi QA M5 · hi summ M3 · kn QA M3 · kn summ M3 · ta QA M2_80 · ta summ M3) | **55%** | **72%** | all ≥ τ on mean |
| Same, strict (CI lower bound ≥ τ) | lower: hi QA M5, kn summ M3, ta summ M3; others fall back to M2_80 / M6 | | |
| Per-item oracle (upper bound) | 53–71% per cell, M5 chosen for ~75% of items | | optimistic for summaries (noise) |

The per-item oracle picks M5 for most items. A router that can predict *which* items M5 or M3 will break on could beat the per-cell policy by about 10–15 points.
For QA this is realistic, because verdicts are stable. For summaries, per-item labels are too noisy (see §1), so use the per-cell policy there.

## 5. Caveats
- Cost uses the full input price. 22% of prompt tokens were served from DeepSeek's prompt cache, because M0/M0_rep/M1 share prefixes. This is the same for all methods, so it doesn't change the comparison.
- Several "partial" verdicts are the judge being strict about extra or less specific information, or about name spelling after back-translation (for example Mancherial).
  The Hindi spot-check (30 rows in `hindi_spotcheck.csv`) is still needed to confirm that the judge is fair to back-translated answers.
- IndicQA gold answers are short spans. Summaries have no reference; they are judged against the source paragraph.

## 6. Next steps
1. **Hindi spot-check** (user): fill `your_score` in `hindi_spotcheck.csv`. Then run cell I2 to compute agreement.
2. **Fix the Tamil via-English failure** (cheap experiments):
   - (a) IndicTrans2 with beam 5 for ta→en only.
   - (b) sarvam-translate (M3b, Ollama) as the ta→en translator.
   - (c) *Hybrid*: translate the context, but keep the original-script question and named entities, or append the M2_80-pruned original context for numbers and names.
3. **M5 at a gentler rate** (keep 0.8 of the English instead of 0.6). It should land between M3 and M5 and may pass in more cells.
4. **Router (M7):** QA first, per item. Features: language, length, digit/named-entity density, translation round-trip similarity (LaBSE of back-translated context vs original) as a cheap "translation-risk" signal. Compare logistic regression vs Laya.
5. **Judge validation:** perturbation suite plus gemma4 as a second judge on a subset.
6. **Cross-model:** rerun the winning policy on `glm5.3-flash`, then `glm5.3`, where the projected saving is ~72% and M4 may finally pay off.

---
## Appendix: complete tables (Run 3, full v1 n = 50)

Generated from `01_deepseek_v1/summary.csv` and `01_deepseek_v1/results.jsonl`. Savings are % vs M0 on the same items; retained = judge mean vs M0, with a 95% paired-bootstrap CI; ✓ = passes τ = 0.95.

Run size: 2850 target answers, 2850 judge verdicts, 0 API errors, finish reasons {'stop': 2850}.

### A1. All metrics per cell

**Hindi · QA** (n = 50)

| Method | in tok | out tok | in save % | out save % | ₹ save % | GLM-5.3 proj % | judge | retained [95% CI] | pass mean / CI | F1 | sim to M0 | local s |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| M0 | 1079 | 11 | 0.0 | 0.0 | 0.0 | 0.0 | 0.990 | 1.000 [1.00–1.00] | ✓ / ✓ | 0.903 | 1.000 | 0.00 |
| M0_rep | 1079 | 11 | 0.0 | -0.2 | -0.0 | -0.0 | 1.000 | 1.010 [1.00–1.03] | ✓ / ✓ | 0.899 | 0.998 | 0.00 |
| M1 | 1077 | 11 | 0.2 | -0.2 | 0.2 | 0.1 | 0.990 | 1.000 [1.00–1.00] | ✓ / ✓ | 0.899 | 0.998 | 0.00 |
| M2_40 | 510 | 10 | 52.7 | 7.2 | 50.9 | 54.9 | 0.850 | 0.859 [0.76–0.94] | ✗ / ✗ | 0.755 | 0.823 | 0.17 |
| M2_60 | 712 | 10 | 34.0 | 4.0 | 32.8 | 36.1 | 0.960 | 0.970 [0.93–1.00] | ✓ / ✗ | 0.872 | 0.934 | 0.13 |
| M2_80 | 901 | 10 | 16.5 | 1.3 | 15.9 | 17.5 | 0.980 | 0.990 [0.96–1.00] | ✓ / ✓ | 0.878 | 0.950 | 0.13 |
| M3 | 480 | 5 | 55.5 | 49.0 | 55.3 | 71.1 | 0.960 | 0.970 [0.91–1.02] | ✓ / ✗ | 0.728 | 0.884 | 1.60 |
| M4 | 1014 | 11 | 6.0 | -1.5 | 5.7 | 38.6 | 1.000 | 1.010 [1.00–1.03] | ✓ / ✓ | 0.777 | 0.935 | 0.00 |
| M5 | 317 | 5 | 70.7 | 49.9 | 69.8 | 80.6 | 0.990 | 1.000 [0.97–1.03] | ✓ / ✓ | 0.735 | 0.880 | 1.72 |

**Hindi · summarisation** (n = 50)

| Method | in tok | out tok | in save % | out save % | ₹ save % | GLM-5.3 proj % | judge | retained [95% CI] | pass mean / CI | F1 | sim to M0 | local s |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| M0 | 1217 | 204 | 0.0 | 0.0 | 0.0 | 0.0 | 0.957 | 1.000 [1.00–1.00] | ✓ / ✓ | – | 1.000 | 0.00 |
| M0_rep | 1217 | 206 | 0.0 | -0.7 | -0.3 | -0.3 | 0.940 | 0.982 [0.96–1.00] | ✓ / ✓ | – | 0.937 | 0.00 |
| M1 | 1215 | 213 | 0.2 | -4.1 | -1.6 | -1.3 | 0.951 | 0.993 [0.98–1.01] | ✓ / ✓ | – | 0.941 | 0.00 |
| M2_40 | 542 | 203 | 55.5 | 0.6 | 32.8 | 38.7 | 0.869 | 0.908 [0.87–0.94] | ✗ / ✗ | – | 0.842 | 0.22 |
| M2_60 | 781 | 203 | 35.8 | 0.7 | 21.3 | 25.6 | 0.923 | 0.964 [0.94–0.99] | ✓ / ✗ | – | 0.867 | 0.22 |
| M2_80 | 1008 | 206 | 17.2 | -0.8 | 9.8 | 12.1 | 0.925 | 0.967 [0.95–0.98] | ✓ / ✗ | – | 0.891 | 0.22 |
| M3 | 529 | 104 | 56.5 | 49.2 | 53.5 | 70.3 | 0.916 | 0.957 [0.91–1.00] | ✓ / ✗ | – | 0.833 | 2.19 |
| M4 | 1134 | 219 | 6.8 | -7.0 | 1.1 | 23.8 | 0.931 | 0.972 [0.95–0.99] | ✓ / ✗ | – | 0.860 | 0.00 |
| M5 | 332 | 109 | 72.7 | 46.8 | 62.0 | 76.6 | 0.903 | 0.943 [0.90–0.98] | ✗ / ✗ | – | 0.828 | 2.39 |
| M6 | 1207 | 113 | 0.8 | 44.7 | 19.0 | 22.8 | 0.953 | 0.996 [0.97–1.02] | ✓ / ✓ | – | 0.843 | 0.40 |

**Kannada · QA** (n = 50)

| Method | in tok | out tok | in save % | out save % | ₹ save % | GLM-5.3 proj % | judge | retained [95% CI] | pass mean / CI | F1 | sim to M0 | local s |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| M0 | 760 | 15 | 0.0 | 0.0 | 0.0 | 0.0 | 0.920 | 1.000 [1.00–1.00] | ✓ / ✓ | 0.789 | 1.000 | 0.00 |
| M0_rep | 760 | 16 | 0.0 | -4.7 | -0.4 | -0.2 | 0.930 | 1.011 [1.00–1.03] | ✓ / ✓ | 0.769 | 0.966 | 0.00 |
| M1 | 750 | 15 | 1.3 | 2.8 | 1.5 | 0.4 | 0.930 | 1.011 [1.00–1.03] | ✓ / ✓ | 0.792 | 0.991 | 0.00 |
| M2_40 | 360 | 13 | 52.7 | 15.7 | 49.8 | 54.6 | 0.790 | 0.859 [0.74–0.99] | ✗ / ✗ | 0.643 | 0.738 | 0.16 |
| M2_60 | 489 | 14 | 35.6 | 5.4 | 33.3 | 36.3 | 0.850 | 0.924 [0.82–1.03] | ✗ / ✗ | 0.704 | 0.815 | 0.16 |
| M2_80 | 623 | 14 | 18.0 | 7.9 | 17.2 | 18.2 | 0.960 | 1.043 [0.99–1.13] | ✓ / ✓ | 0.814 | 0.923 | 0.16 |
| M3 | 269 | 6 | 64.6 | 63.6 | 64.5 | 84.4 | 0.900 | 0.978 [0.88–1.09] | ✓ / ✗ | 0.642 | 0.836 | 0.82 |
| M4 | 567 | 14 | 25.3 | 9.1 | 24.1 | 64.0 | 0.920 | 1.000 [0.93–1.08] | ✓ / ✗ | 0.653 | 0.861 | 0.00 |
| M5 | 186 | 6 | 75.5 | 63.2 | 74.5 | 89.0 | 0.850 | 0.924 [0.84–1.01] | ✗ / ✗ | 0.606 | 0.792 | 0.97 |

**Kannada · summarisation** (n = 50)

| Method | in tok | out tok | in save % | out save % | ₹ save % | GLM-5.3 proj % | judge | retained [95% CI] | pass mean / CI | F1 | sim to M0 | local s |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| M0 | 770 | 226 | 0.0 | 0.0 | 0.0 | 0.0 | 0.955 | 1.000 [1.00–1.00] | ✓ / ✓ | – | 1.000 | 0.00 |
| M0_rep | 770 | 219 | 0.0 | 3.1 | 1.7 | 1.7 | 0.949 | 0.994 [0.98–1.01] | ✓ / ✓ | – | 0.950 | 0.00 |
| M1 | 761 | 220 | 1.2 | 2.4 | 1.9 | 1.2 | 0.952 | 0.997 [0.98–1.01] | ✓ / ✓ | – | 0.943 | 0.00 |
| M2_40 | 332 | 200 | 56.8 | 11.4 | 31.8 | 37.1 | 0.796 | 0.834 [0.78–0.88] | ✗ / ✗ | – | 0.815 | 0.16 |
| M2_60 | 475 | 206 | 38.3 | 8.8 | 22.0 | 25.3 | 0.888 | 0.930 [0.89–0.96] | ✗ / ✗ | – | 0.857 | 0.16 |
| M2_80 | 621 | 214 | 19.3 | 5.2 | 11.5 | 12.8 | 0.952 | 0.997 [0.98–1.01] | ✓ / ✓ | – | 0.901 | 0.16 |
| M3 | 255 | 94 | 66.9 | 58.3 | 62.2 | 83.9 | 0.948 | 0.993 [0.95–1.03] | ✓ / ✓ | – | 0.821 | 1.20 |
| M4 | 575 | 237 | 25.3 | -5.1 | 8.5 | 32.4 | 0.907 | 0.950 [0.92–0.98] | ✗ / ✗ | – | 0.864 | 0.00 |
| M5 | 167 | 95 | 78.3 | 57.8 | 67.0 | 86.5 | 0.879 | 0.920 [0.86–0.98] | ✗ / ✗ | – | 0.830 | 1.34 |
| M6 | 754 | 102 | 2.1 | 54.6 | 31.1 | 39.5 | 0.944 | 0.989 [0.95–1.02] | ✓ / ✗ | – | 0.826 | 0.39 |

**Tamil · QA** (n = 50)

| Method | in tok | out tok | in save % | out save % | ₹ save % | GLM-5.3 proj % | judge | retained [95% CI] | pass mean / CI | F1 | sim to M0 | local s |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| M0 | 975 | 11 | 0.0 | 0.0 | 0.0 | 0.0 | 0.940 | 1.000 [1.00–1.00] | ✓ / ✓ | 0.766 | 1.000 | 0.00 |
| M0_rep | 975 | 11 | 0.0 | 0.0 | 0.0 | -0.0 | 0.940 | 1.000 [1.00–1.00] | ✓ / ✓ | 0.763 | 0.981 | 0.00 |
| M1 | 973 | 10 | 0.2 | 4.9 | 0.5 | 0.3 | 0.910 | 0.968 [0.91–1.00] | ✓ / ✗ | 0.755 | 0.959 | 0.00 |
| M2_40 | 446 | 9 | 54.3 | 18.0 | 52.6 | 57.3 | 0.800 | 0.851 [0.75–0.94] | ✗ / ✗ | 0.638 | 0.774 | 0.14 |
| M2_60 | 622 | 10 | 36.2 | 11.8 | 35.1 | 38.4 | 0.860 | 0.915 [0.83–0.98] | ✗ / ✗ | 0.729 | 0.871 | 0.13 |
| M2_80 | 802 | 11 | 17.8 | 3.1 | 17.1 | 18.7 | 0.950 | 1.011 [1.00–1.03] | ✓ / ✓ | 0.784 | 0.939 | 0.13 |
| M3 | 389 | 5 | 60.1 | 55.0 | 59.9 | 83.3 | 0.850 | 0.904 [0.82–0.97] | ✗ / ✗ | 0.653 | 0.849 | 1.24 |
| M4 | 1135 | 10 | -16.3 | 6.0 | -15.3 | 47.3 | 0.680 | 0.723 [0.60–0.84] | ✗ / ✗ | 0.574 | 0.707 | 0.00 |
| M5 | 258 | 5 | 73.5 | 55.0 | 72.7 | 88.7 | 0.860 | 0.915 [0.84–0.98] | ✗ / ✗ | 0.624 | 0.816 | 1.35 |

**Tamil · summarisation** (n = 50)

| Method | in tok | out tok | in save % | out save % | ₹ save % | GLM-5.3 proj % | judge | retained [95% CI] | pass mean / CI | F1 | sim to M0 | local s |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| M0 | 1227 | 203 | 0.0 | 0.0 | 0.0 | 0.0 | 0.943 | 1.000 [1.00–1.00] | ✓ / ✓ | – | 1.000 | 0.00 |
| M0_rep | 1227 | 194 | 0.0 | 4.3 | 1.8 | 1.4 | 0.939 | 0.996 [0.98–1.02] | ✓ / ✓ | – | 0.945 | 0.00 |
| M1 | 1225 | 207 | 0.2 | -1.8 | -0.6 | -0.6 | 0.937 | 0.994 [0.98–1.01] | ✓ / ✓ | – | 0.945 | 0.00 |
| M2_40 | 528 | 184 | 57.0 | 9.2 | 37.4 | 43.7 | 0.885 | 0.939 [0.89–0.98] | ✗ / ✗ | – | 0.812 | 0.24 |
| M2_60 | 761 | 185 | 38.0 | 8.7 | 26.0 | 30.2 | 0.900 | 0.955 [0.92–0.98] | ✓ / ✗ | – | 0.835 | 0.24 |
| M2_80 | 1001 | 200 | 18.4 | 1.4 | 11.5 | 13.5 | 0.931 | 0.987 [0.97–1.00] | ✓ / ✓ | – | 0.879 | 0.24 |
| M3 | 459 | 103 | 62.6 | 49.3 | 57.2 | 82.6 | 0.933 | 0.990 [0.95–1.03] | ✓ / ✗ | – | 0.808 | 1.99 |
| M4 | 1435 | 189 | -16.9 | 7.0 | -7.1 | 34.7 | 0.677 | 0.719 [0.66–0.77] | ✗ / ✗ | – | 0.741 | 0.00 |
| M5 | 289 | 109 | 76.5 | 46.1 | 64.0 | 85.9 | 0.904 | 0.959 [0.91–1.00] | ✓ / ✗ | – | 0.803 | 2.20 |
| M6 | 1220 | 118 | 0.6 | 42.0 | 17.6 | 25.8 | 0.925 | 0.982 [0.94–1.02] | ✓ / ✗ | – | 0.809 | 0.47 |

### A2. QA verdict counts (correct / partial / wrong)

| Method | Hindi | Kannada | Tamil |
|---|---|---|---|
| M0 | 49 / 1 / 0 | 44 / 4 / 2 | 46 / 2 / 2 |
| M0_rep | 50 / 0 / 0 | 45 / 3 / 2 | 46 / 2 / 2 |
| M1 | 49 / 1 / 0 | 45 / 3 / 2 | 44 / 3 / 3 |
| M2_40 | 39 / 7 / 4 | 34 / 11 / 5 | 39 / 2 / 9 |
| M2_60 | 46 / 4 / 0 | 38 / 9 / 3 | 42 / 2 / 6 |
| M2_80 | 48 / 2 / 0 | 46 / 4 / 0 | 47 / 1 / 2 |
| M3 | 47 / 2 / 1 | 42 / 6 / 2 | 42 / 1 / 7 |
| M4 | 50 / 0 / 0 | 44 / 4 / 2 | 32 / 4 / 14 |
| M5 | 49 / 1 / 0 | 39 / 7 / 4 | 42 / 2 / 6 |

### A3. Judge vs token-F1 (gold anchoring; native-script answers only; F1 ≥ 0.5 counts as correct)

| Language | n | agreement | Cohen's κ | judge says correct | F1 says correct |
|---|---|---|---|---|---|
| Hindi | 350 | 0.92 | 0.21 | 0.99 | 0.91 |
| Kannada | 350 | 0.87 | 0.38 | 0.95 | 0.83 |
| Tamil | 350 | 0.82 | 0.41 | 0.89 | 0.75 |

### A4. Summary judge sub-scores (1–5): faithfulness / coverage / fluency

| Method | Hindi | Kannada | Tamil |
|---|---|---|---|
| M0 | 4.98 / 4.38 / 5.00 | 4.90 / 4.42 / 5.00 | 5.00 / 4.14 / 5.00 |
| M0_rep | 4.86 / 4.26 / 4.98 | 4.84 / 4.40 / 5.00 | 4.98 / 4.10 / 5.00 |
| M1 | 4.90 / 4.36 / 5.00 | 4.86 / 4.42 / 5.00 | 4.98 / 4.08 / 5.00 |
| M2_40 | 4.40 / 3.74 / 4.90 | 3.84 / 3.48 / 4.62 | 4.62 / 3.78 / 4.88 |
| M2_60 | 4.80 / 4.08 / 4.96 | 4.44 / 4.00 / 4.88 | 4.74 / 3.80 / 4.96 |
| M2_80 | 4.88 / 4.04 / 4.96 | 4.88 / 4.40 / 5.00 | 4.96 / 4.00 / 5.00 |
| M3 | 4.54 / 4.42 / 4.78 | 4.68 / 4.70 / 4.84 | 4.60 / 4.56 / 4.84 |
| M4 | 4.84 / 4.12 / 5.00 | 4.58 / 4.02 / 5.00 | 3.16 / 2.62 / 4.38 |
| M5 | 4.40 / 4.30 / 4.84 | 4.32 / 4.30 / 4.56 | 4.44 / 4.34 / 4.78 |
| M6 | 4.76 / 4.58 / 4.96 | 4.64 / 4.64 / 4.88 | 4.50 / 4.44 / 4.94 |

### A5. Offline input-token saving (no API, counted with the tokenizers): DeepSeek % / GLM-5.3 %

| Method | Hindi qa | Hindi summ | Kannada qa | Kannada summ | Tamil qa | Tamil summ |
|---|---|---|---|---|---|---|
| M0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| M0_rep | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| M1 | 0 / 0 | 0 / 0 | 1 / 0 | 1 / 0 | 0 / 0 | 0 / 0 |
| M2_40 | 53 / 56 | 56 / 58 | 53 / 57 | 57 / 60 | 55 / 58 | 57 / 61 |
| M2_60 | 34 / 37 | 36 / 38 | 36 / 38 | 39 / 41 | 36 / 39 | 38 / 41 |
| M2_80 | 17 / 18 | 17 / 19 | 18 / 19 | 19 / 20 | 18 / 19 | 18 / 20 |
| M3 | 56 / 71 | 57 / 72 | 65 / 84 | 67 / 86 | 60 / 83 | 63 / 84 |
| M4 | 6 / 40 | 7 / 40 | 26 / 67 | 25 / 67 | -16 / 48 | -17 / 49 |
| M5 | 71 / 81 | 73 / 82 | 76 / 89 | 79 / 91 | 74 / 89 | 77 / 90 |
| M6 | – | 1 / 0 | – | 2 / 1 | – | 1 / 0 |

Figures: `figures/pareto.png` (savings vs quality per cell), `figures/gap_parity.png` (token gap).
