# Run 4: full run v2 (Tamil fixes + gentler M5)

**Date:** 2026-11-08 · **n = 50** per (language × task) · methods of Run 3 + **M3_b5, M5_80, M3h** · same target and judge · files in this folder

Shared setup (data, prompts, methods, metrics): [`../00_SETUP.md`](../00_SETUP.md) · Index of all runs: [`../README.md`](../README.md)

3,600 target calls + 3,600 judge calls. 0 errors, 0 missing verdicts, 0 truncations. v1 files are in `results/01_deepseek_v1/`.

## 1. New methods: cost saving / quality retained [CI lower bound]

| Method | hi QA | hi summ | kn QA | kn summ | ta QA | ta summ |
|---|---|---|---|---|---|---|
| M3 (reference) | 55% / 0.97 [.91] | 54% / 0.97 [.92] | 64% / 0.97 [.88] | 62% / 0.99 [.95] | 60% / **0.93** | 57% / 1.00 [.95] |
| **M3_b5** (beam 5) | 55% / 0.96 [.90] | 54% / **1.00 [.97]** | 64% / 0.97 [.89] | 62% / **1.00 [.97]** | 60% / **0.90** | 57% / 0.99 [.95] |
| **M5_80** (keep 80%) | 62% / 0.97 [.91] | **57% / 0.97** [.93] | **69% / 0.97** [.88] | **64% / 0.98** [.94] | 66% / **0.92** | 60% / 0.99 [.94] |
| M5 (reference, keep 60%) | 70% / 1.00 [.97] | 62% / **0.945** | 75% / **0.91** | 67% / **0.92** | 73% / **0.89** | 64% / 0.97 [.92] |
| **M3h** (hybrid, QA) | 38% / 0.99 [.97] | — | 34% / 0.99 [.91] | — | 41% / **0.947** [.87] | — |
| M2_80 (reference) | 16% / 0.99 [.96] | 11% / 0.97 [.95] | 17% / 1.03 [.98] | 12% / 1.00 [.98] | 17% / 1.01 [1.0] | 11% / 1.00 [.98] |

## 2. What we learned
1. **M5_80 is the new sweet spot for the English route.**
   - It passes τ in 5 of 6 cells at 57–69% saving: about 5 points more than M3, at the same quality.
   - It rescues Kannada QA (M5 0.91 → 0.97) and Hindi/Kannada summaries, where M5 at 60% failed.
   - Tamil QA still fails (0.92).
2. **Beam 5 helps summaries, not QA.**
   - Hindi and Kannada summaries move to ≈ 1.00 with a CI lower bound ≥ 0.95, so they now pass even the strict test. The cost saving is unchanged.
   - QA does not improve. Tamil "cancer" is translated *correctly* by beam 2 in this run, but beam 5 produces "Psoriasis"; the errors just move around.
   - It doubles local translation time (to 1.6–4.2 s per item).
3. **The hybrid (M3h) fixes exactly the translation failures, but introduces new ones.**
   - In Tamil it rescued 4 items: names and terms like Mancherial and R. K. Narayan, and the two "not mentioned in the context" answers.
   - It broke 4 others. In those, the 2 selected sentences didn't contain the answer, so the model answered from the wrong sentence (e.g. "Asaf Jah" instead of "Aurangzeb"), or it gave a correct but shorter answer that the judge marked partial ("Western Ganga" without "dynasty").
   - Net result: Tamil QA 0.947, just under τ and within the noise, at 41% saving. Answers copy the original wording, so token-F1 rises (0.73 → 0.85 hi, 0.67 → 0.73 ta).
   - It saves less (34–41%) because it sends native sentences and answers in native script.
4. **Tamil QA remains the hardest cell.** None of the English-route methods passes clearly. The safe choice is still M2_80 (17%); M3h (41%, 0.947) is the borderline choice.
   - The failures are spread across translation errors, sentence selection and judge strictness. No single fix closes the gap.
5. **"Not mentioned" fallback is too small to matter.** Detecting "not mentioned / does not say" in the English answer and falling back to another method triggers on only 0–2 items per language. For Tamil QA it lifts M3 from 0.93 to 0.947.
6. **The method that M3 gets wrong is often one M3h gets right, and vice versa** (Tamil: 4 fixed, 4 broken; Kannada: 5 / 3). That is a good sign for a per-item router, *if* it can predict translation risk.

## 3. Reproducibility notes (important for the report)
- **DeepSeek at temperature 0 is not deterministic.** In v1, 128 items had an M1 prompt byte-identical to M0, because the clean-up changed nothing. 59 of those 128 got differently worded answers.
  - In v2, the cache returns one stored answer for both (the cache key is the prompt), so M0 changed for 58 items.
  - Verdicts stayed the same for 92% of them.
- **IndicTrans2 output changes slightly with batch composition** (fp16 padding). About 6% of M3/M5 prompts changed between runs.
- **Net effect:** methods whose configuration didn't change moved by **at most ±2 points** in retained quality between v1 and v2. Treat differences under ~3 points as noise. With n = 50, the CIs are ±5–9 points anyway.

## 4. Current best policy per cell

| Cell | Best on mean (≥ τ) | Saving | Strict (CI lower bound ≥ τ) | Saving |
|---|---|---|---|---|
| hi QA | M5 | 70% | M5 | 70% |
| hi summ | M5_80 | 57% | M3_b5 | 54% |
| kn QA | M5_80 | 69% | M2_80 | 17% |
| kn summ | M5_80 | 64% | M3_b5 | 62% |
| ta QA | M2_80 (M3h at 0.947 borderline) | 17% (41%) | M2_80 | 17% |
| ta summ | M5 | 64% | M3_b5 | 57% |
| **Total ₹ saving** | | **58% DeepSeek · 73% GLM-5.3 projected** | | **51% · 64%** |

With M3h for Tamil QA and M5_80 for Kannada QA: **58% DeepSeek / 78% GLM projected**, all cells ≥ 0.947.

## 5. Next steps
1. **Stop tuning methods on DeepSeek.** The remaining differences are inside the noise. Freeze the menu: M2_80, M3_b5, M5_80, M5, M3h, M6.
2. **Router (M7), QA first.** The complementary failures (M3 vs M3h) mean a per-item choice can beat the per-cell table.
   Use a *local, free* translation-risk feature:
   - round-trip similarity (back-translate the English context and compare it with the original using LaBSE);
   - digit/named-entity density;
   - length;
   - language.
   Compare logistic regression vs Laya, with item-level cross-validation.
3. **Hindi spot-check** (user), still pending: it is needed before the judge's "partial" verdicts on back-translated answers can be trusted.
4. **Cross-model test on `glm5.3-flash`, then `glm5.3`**, with the frozen menu plus M4. This is where the saving is largest (projected 64–78%).
5. Optional: M3h with 3 key sentences, chosen by aligning English sentences, to cut its sentence-selection misses.

---
## Appendix: complete tables (Run 4, full v2 n = 50)

Generated from `01_deepseek/summary.csv` and `01_deepseek/results.jsonl`. Savings are % vs M0 on the same items; retained = judge mean vs M0, with a 95% paired-bootstrap CI; ✓ = passes τ = 0.95.

Run size: 3600 target answers, 3600 judge verdicts, 0 API errors, finish reasons {'stop': 3600}.

### A1. All metrics per cell

**Hindi · QA** (n = 50)

| Method | in tok | out tok | in save % | out save % | ₹ save % | GLM-5.3 proj % | judge | retained [95% CI] | pass mean / CI | F1 | sim to M0 | local s |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| M0 | 1079 | 11 | 0.0 | 0.0 | 0.0 | 0.0 | 0.990 | 1.000 [1.00–1.00] | ✓ / ✓ | 0.899 | 1.000 | 0.00 |
| M0_rep | 1079 | 11 | 0.0 | 0.0 | 0.0 | 0.0 | 0.990 | 1.000 [1.00–1.00] | ✓ / ✓ | 0.899 | 1.000 | 0.00 |
| M1 | 1077 | 11 | 0.2 | 0.0 | 0.2 | 0.1 | 0.990 | 1.000 [1.00–1.00] | ✓ / ✓ | 0.899 | 1.000 | 0.00 |
| M2_40 | 510 | 10 | 52.7 | 7.4 | 50.9 | 54.9 | 0.850 | 0.859 [0.76–0.94] | ✗ / ✗ | 0.755 | 0.822 | 0.16 |
| M2_60 | 712 | 10 | 34.0 | 4.2 | 32.8 | 36.1 | 0.960 | 0.970 [0.93–1.00] | ✓ / ✗ | 0.872 | 0.934 | 0.14 |
| M2_80 | 901 | 10 | 16.5 | 1.5 | 15.9 | 17.5 | 0.980 | 0.990 [0.96–1.00] | ✓ / ✓ | 0.878 | 0.950 | 0.14 |
| M3 | 480 | 5 | 55.6 | 49.1 | 55.3 | 71.1 | 0.960 | 0.970 [0.91–1.02] | ✓ / ✗ | 0.728 | 0.885 | 1.57 |
| M3_b5 | 482 | 5 | 55.4 | 48.9 | 55.1 | 70.9 | 0.950 | 0.960 [0.90–1.01] | ✓ / ✗ | 0.726 | 0.881 | 2.96 |
| M3h | 653 | 11 | 39.4 | -5.7 | 37.7 | 54.1 | 0.980 | 0.990 [0.97–1.00] | ✓ / ✓ | 0.845 | 0.933 | 3.01 |
| M4 | 1014 | 11 | 6.0 | -1.3 | 5.7 | 38.6 | 1.000 | 1.010 [1.00–1.03] | ✓ / ✓ | 0.777 | 0.935 | 0.00 |
| M5 | 316 | 5 | 70.7 | 50.0 | 69.9 | 80.7 | 0.990 | 1.000 [0.97–1.03] | ✓ / ✓ | 0.735 | 0.880 | 1.69 |
| M5_80 | 403 | 5 | 62.6 | 49.1 | 62.1 | 75.5 | 0.960 | 0.970 [0.91–1.02] | ✓ / ✗ | 0.724 | 0.885 | 1.69 |

**Hindi · summarisation** (n = 50)

| Method | in tok | out tok | in save % | out save % | ₹ save % | GLM-5.3 proj % | judge | retained [95% CI] | pass mean / CI | F1 | sim to M0 | local s |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| M0 | 1217 | 213 | 0.0 | 0.0 | 0.0 | 0.0 | 0.951 | 1.000 [1.00–1.00] | ✓ / ✓ | – | 1.000 | 0.00 |
| M0_rep | 1217 | 206 | 0.0 | 3.2 | 1.3 | 1.1 | 0.939 | 0.987 [0.97–1.00] | ✓ / ✓ | – | 0.948 | 0.00 |
| M1 | 1215 | 213 | 0.2 | -0.1 | 0.1 | 0.1 | 0.951 | 1.000 [0.99–1.01] | ✓ / ✓ | – | 0.987 | 0.00 |
| M2_40 | 542 | 203 | 55.5 | 4.4 | 33.9 | 39.6 | 0.869 | 0.914 [0.88–0.95] | ✗ / ✗ | – | 0.853 | 0.23 |
| M2_60 | 781 | 203 | 35.8 | 4.5 | 22.6 | 26.6 | 0.923 | 0.971 [0.95–0.99] | ✓ / ✗ | – | 0.867 | 0.23 |
| M2_80 | 1008 | 206 | 17.2 | 3.1 | 11.2 | 13.3 | 0.925 | 0.973 [0.95–1.00] | ✓ / ✗ | – | 0.894 | 0.23 |
| M3 | 529 | 104 | 56.5 | 51.1 | 54.3 | 70.7 | 0.920 | 0.968 [0.92–1.01] | ✓ / ✗ | – | 0.846 | 2.15 |
| M3_b5 | 530 | 107 | 56.4 | 49.6 | 53.5 | 70.3 | 0.952 | 1.001 [0.97–1.03] | ✓ / ✓ | – | 0.850 | 4.17 |
| M4 | 1134 | 219 | 6.8 | -2.9 | 2.7 | 24.9 | 0.931 | 0.979 [0.95–1.00] | ✓ / ✓ | – | 0.861 | 0.00 |
| M5 | 332 | 110 | 72.7 | 48.5 | 62.5 | 76.9 | 0.899 | 0.945 [0.90–0.99] | ✗ / ✗ | – | 0.837 | 2.37 |
| M5_80 | 437 | 110 | 64.1 | 48.3 | 57.4 | 73.2 | 0.921 | 0.969 [0.93–1.01] | ✓ / ✗ | – | 0.849 | 2.42 |
| M6 | 1207 | 113 | 0.8 | 46.8 | 20.3 | 23.8 | 0.953 | 1.003 [0.97–1.03] | ✓ / ✓ | – | 0.846 | 0.40 |

**Kannada · QA** (n = 50)

| Method | in tok | out tok | in save % | out save % | ₹ save % | GLM-5.3 proj % | judge | retained [95% CI] | pass mean / CI | F1 | sim to M0 | local s |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| M0 | 760 | 15 | 0.0 | 0.0 | 0.0 | 0.0 | 0.930 | 1.000 [1.00–1.00] | ✓ / ✓ | 0.789 | 1.000 | 0.00 |
| M0_rep | 760 | 16 | 0.0 | -4.7 | -0.4 | -0.2 | 0.930 | 1.000 [1.00–1.00] | ✓ / ✓ | 0.769 | 0.966 | 0.00 |
| M1 | 750 | 15 | 1.3 | 2.8 | 1.5 | 0.4 | 0.930 | 1.000 [1.00–1.00] | ✓ / ✓ | 0.792 | 0.991 | 0.00 |
| M2_40 | 360 | 13 | 52.7 | 15.7 | 49.8 | 54.6 | 0.790 | 0.849 [0.73–0.97] | ✗ / ✗ | 0.643 | 0.738 | 0.11 |
| M2_60 | 489 | 14 | 35.6 | 5.4 | 33.3 | 36.3 | 0.840 | 0.903 [0.81–1.01] | ✗ / ✗ | 0.704 | 0.815 | 0.11 |
| M2_80 | 623 | 14 | 18.0 | 7.9 | 17.2 | 18.2 | 0.960 | 1.032 [0.98–1.11] | ✓ / ✓ | 0.814 | 0.923 | 0.11 |
| M3 | 269 | 6 | 64.6 | 63.3 | 64.5 | 84.4 | 0.900 | 0.968 [0.88–1.07] | ✓ / ✗ | 0.633 | 0.835 | 0.83 |
| M3_b5 | 271 | 6 | 64.4 | 62.1 | 64.2 | 84.3 | 0.900 | 0.968 [0.89–1.05] | ✓ / ✗ | 0.632 | 0.831 | 1.61 |
| M3h | 474 | 16 | 37.6 | -3.4 | 34.4 | 54.3 | 0.920 | 0.989 [0.91–1.07] | ✓ / ✗ | 0.743 | 0.871 | 1.62 |
| M4 | 567 | 14 | 25.3 | 9.1 | 24.1 | 64.0 | 0.920 | 0.989 [0.92–1.06] | ✓ / ✗ | 0.653 | 0.861 | 0.00 |
| M5 | 186 | 6 | 75.5 | 63.2 | 74.5 | 89.0 | 0.850 | 0.914 [0.83–1.00] | ✗ / ✗ | 0.606 | 0.792 | 0.94 |
| M5_80 | 231 | 5 | 69.7 | 65.6 | 69.3 | 86.6 | 0.900 | 0.968 [0.88–1.07] | ✓ / ✗ | 0.637 | 0.839 | 0.93 |

**Kannada · summarisation** (n = 50)

| Method | in tok | out tok | in save % | out save % | ₹ save % | GLM-5.3 proj % | judge | retained [95% CI] | pass mean / CI | F1 | sim to M0 | local s |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| M0 | 770 | 227 | 0.0 | 0.0 | 0.0 | 0.0 | 0.955 | 1.000 [1.00–1.00] | ✓ / ✓ | – | 1.000 | 0.00 |
| M0_rep | 770 | 219 | 0.0 | 3.6 | 2.0 | 2.0 | 0.948 | 0.993 [0.98–1.01] | ✓ / ✓ | – | 0.953 | 0.00 |
| M1 | 761 | 220 | 1.2 | 2.9 | 2.2 | 1.5 | 0.952 | 0.997 [0.98–1.01] | ✓ / ✓ | – | 0.949 | 0.00 |
| M2_40 | 332 | 200 | 56.8 | 11.9 | 32.0 | 37.3 | 0.796 | 0.834 [0.78–0.88] | ✗ / ✗ | – | 0.814 | 0.15 |
| M2_60 | 475 | 206 | 38.3 | 9.3 | 22.2 | 25.5 | 0.888 | 0.930 [0.89–0.96] | ✗ / ✗ | – | 0.856 | 0.15 |
| M2_80 | 621 | 214 | 19.3 | 5.7 | 11.8 | 13.0 | 0.952 | 0.997 [0.98–1.01] | ✓ / ✓ | – | 0.898 | 0.15 |
| M3 | 255 | 94 | 66.9 | 58.5 | 62.2 | 84.0 | 0.947 | 0.992 [0.95–1.03] | ✓ / ✗ | – | 0.824 | 1.20 |
| M3_b5 | 256 | 96 | 66.8 | 57.8 | 61.8 | 83.8 | 0.959 | 1.004 [0.97–1.04] | ✓ / ✓ | – | 0.834 | 2.36 |
| M4 | 575 | 237 | 25.3 | -4.5 | 8.8 | 32.6 | 0.907 | 0.950 [0.92–0.98] | ✗ / ✗ | – | 0.861 | 0.00 |
| M5 | 167 | 96 | 78.3 | 57.9 | 67.0 | 86.5 | 0.879 | 0.920 [0.86–0.98] | ✗ / ✗ | – | 0.833 | 1.34 |
| M5_80 | 214 | 97 | 72.2 | 57.3 | 63.9 | 84.9 | 0.932 | 0.976 [0.94–1.02] | ✓ / ✗ | – | 0.824 | 1.36 |
| M6 | 754 | 102 | 2.1 | 54.9 | 31.3 | 39.7 | 0.944 | 0.989 [0.95–1.02] | ✓ / ✗ | – | 0.829 | 0.38 |

**Tamil · QA** (n = 50)

| Method | in tok | out tok | in save % | out save % | ₹ save % | GLM-5.3 proj % | judge | retained [95% CI] | pass mean / CI | F1 | sim to M0 | local s |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| M0 | 975 | 11 | 0.0 | 0.0 | 0.0 | 0.0 | 0.940 | 1.000 [1.00–1.00] | ✓ / ✓ | 0.763 | 1.000 | 0.00 |
| M0_rep | 975 | 11 | 0.0 | -0.2 | -0.0 | -0.0 | 0.940 | 1.000 [1.00–1.00] | ✓ / ✓ | 0.763 | 0.982 | 0.00 |
| M1 | 973 | 10 | 0.2 | 4.7 | 0.4 | 0.3 | 0.910 | 0.968 [0.91–1.00] | ✓ / ✗ | 0.755 | 0.959 | 0.00 |
| M2_40 | 446 | 9 | 54.3 | 17.8 | 52.6 | 57.3 | 0.800 | 0.851 [0.75–0.94] | ✗ / ✗ | 0.638 | 0.774 | 0.19 |
| M2_60 | 622 | 10 | 36.2 | 11.6 | 35.1 | 38.4 | 0.860 | 0.915 [0.83–0.98] | ✗ / ✗ | 0.729 | 0.871 | 0.19 |
| M2_80 | 802 | 11 | 17.8 | 2.9 | 17.1 | 18.7 | 0.950 | 1.011 [1.00–1.03] | ✓ / ✓ | 0.784 | 0.938 | 0.19 |
| M3 | 389 | 5 | 60.2 | 54.7 | 59.9 | 83.3 | 0.870 | 0.926 [0.86–0.98] | ✗ / ✗ | 0.668 | 0.857 | 1.23 |
| M3_b5 | 389 | 5 | 60.1 | 55.1 | 59.9 | 83.3 | 0.850 | 0.904 [0.82–0.97] | ✗ / ✗ | 0.650 | 0.829 | 2.38 |
| M3h | 559 | 11 | 42.7 | 2.0 | 40.8 | 64.4 | 0.890 | 0.947 [0.87–1.01] | ✗ / ✗ | 0.734 | 0.881 | 2.41 |
| M4 | 1135 | 10 | -16.3 | 5.8 | -15.3 | 47.3 | 0.680 | 0.723 [0.60–0.84] | ✗ / ✗ | 0.574 | 0.706 | 0.00 |
| M5 | 258 | 5 | 73.5 | 54.7 | 72.7 | 88.7 | 0.840 | 0.894 [0.81–0.97] | ✗ / ✗ | 0.615 | 0.800 | 1.39 |
| M5_80 | 327 | 5 | 66.4 | 58.2 | 66.1 | 85.9 | 0.860 | 0.915 [0.84–0.98] | ✗ / ✗ | 0.645 | 0.825 | 1.39 |

**Tamil · summarisation** (n = 50)

| Method | in tok | out tok | in save % | out save % | ₹ save % | GLM-5.3 proj % | judge | retained [95% CI] | pass mean / CI | F1 | sim to M0 | local s |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| M0 | 1227 | 202 | 0.0 | 0.0 | 0.0 | 0.0 | 0.932 | 1.000 [1.00–1.00] | ✓ / ✓ | – | 1.000 | 0.00 |
| M0_rep | 1227 | 194 | 0.0 | 3.8 | 1.5 | 1.4 | 0.939 | 1.007 [0.99–1.03] | ✓ / ✓ | – | 0.943 | 0.00 |
| M1 | 1225 | 207 | 0.2 | -2.3 | -0.8 | -0.7 | 0.937 | 1.006 [1.00–1.01] | ✓ / ✓ | – | 0.968 | 0.00 |
| M2_40 | 528 | 184 | 57.0 | 8.8 | 37.3 | 43.6 | 0.885 | 0.950 [0.91–0.99] | ✗ / ✗ | – | 0.805 | 0.26 |
| M2_60 | 761 | 185 | 38.0 | 8.2 | 25.8 | 30.1 | 0.900 | 0.966 [0.94–0.99] | ✓ / ✗ | – | 0.833 | 0.26 |
| M2_80 | 1001 | 200 | 18.4 | 0.9 | 11.3 | 13.4 | 0.931 | 0.999 [0.98–1.02] | ✓ / ✓ | – | 0.878 | 0.26 |
| M3 | 459 | 102 | 62.6 | 49.7 | 57.4 | 82.6 | 0.928 | 0.996 [0.95–1.04] | ✓ / ✗ | – | 0.806 | 1.99 |
| M3_b5 | 460 | 103 | 62.5 | 49.0 | 57.0 | 82.5 | 0.927 | 0.994 [0.95–1.03] | ✓ / ✓ | – | 0.811 | 3.85 |
| M4 | 1435 | 189 | -16.9 | 6.5 | -7.3 | 34.6 | 0.677 | 0.727 [0.67–0.78] | ✗ / ✗ | – | 0.742 | 0.00 |
| M5 | 289 | 107 | 76.5 | 47.0 | 64.4 | 86.0 | 0.907 | 0.973 [0.92–1.02] | ✓ / ✗ | – | 0.804 | 2.21 |
| M5_80 | 380 | 108 | 69.0 | 46.6 | 59.9 | 84.0 | 0.925 | 0.993 [0.94–1.04] | ✓ / ✗ | – | 0.788 | 2.21 |
| M6 | 1220 | 118 | 0.6 | 41.7 | 17.4 | 25.7 | 0.920 | 0.987 [0.94–1.03] | ✓ / ✗ | – | 0.806 | 0.49 |

### A2. QA verdict counts (correct / partial / wrong)

| Method | Hindi | Kannada | Tamil |
|---|---|---|---|
| M0 | 49 / 1 / 0 | 45 / 3 / 2 | 46 / 2 / 2 |
| M0_rep | 49 / 1 / 0 | 45 / 3 / 2 | 46 / 2 / 2 |
| M1 | 49 / 1 / 0 | 45 / 3 / 2 | 44 / 3 / 3 |
| M2_40 | 39 / 7 / 4 | 34 / 11 / 5 | 39 / 2 / 9 |
| M2_60 | 46 / 4 / 0 | 37 / 10 / 3 | 42 / 2 / 6 |
| M2_80 | 48 / 2 / 0 | 46 / 4 / 0 | 47 / 1 / 2 |
| M3 | 47 / 2 / 1 | 42 / 6 / 2 | 43 / 1 / 6 |
| M3_b5 | 46 / 3 / 1 | 42 / 6 / 2 | 42 / 1 / 7 |
| M3h | 48 / 2 / 0 | 44 / 4 / 2 | 43 / 3 / 4 |
| M4 | 50 / 0 / 0 | 44 / 4 / 2 | 32 / 4 / 14 |
| M5 | 49 / 1 / 0 | 39 / 7 / 4 | 41 / 2 / 7 |
| M5_80 | 47 / 2 / 1 | 42 / 6 / 2 | 42 / 2 / 6 |

### A3. Judge vs token-F1 (gold anchoring; native-script answers only; F1 ≥ 0.5 counts as correct)

| Language | n | agreement | Cohen's κ | judge says correct | F1 says correct |
|---|---|---|---|---|---|
| Hindi | 350 | 0.92 | 0.21 | 0.99 | 0.91 |
| Kannada | 350 | 0.87 | 0.38 | 0.95 | 0.83 |
| Tamil | 350 | 0.82 | 0.41 | 0.89 | 0.75 |

### A4. Summary judge sub-scores (1–5): faithfulness / coverage / fluency

| Method | Hindi | Kannada | Tamil |
|---|---|---|---|
| M0 | 4.92 / 4.34 / 5.00 | 4.90 / 4.42 / 5.00 | 4.98 / 4.00 / 5.00 |
| M0_rep | 4.84 / 4.26 / 4.98 | 4.84 / 4.38 / 5.00 | 4.98 / 4.10 / 5.00 |
| M1 | 4.90 / 4.36 / 5.00 | 4.86 / 4.42 / 5.00 | 4.98 / 4.08 / 5.00 |
| M2_40 | 4.40 / 3.74 / 4.90 | 3.84 / 3.48 / 4.62 | 4.62 / 3.78 / 4.88 |
| M2_60 | 4.80 / 4.08 / 4.96 | 4.44 / 4.00 / 4.88 | 4.74 / 3.80 / 4.96 |
| M2_80 | 4.88 / 4.04 / 4.96 | 4.88 / 4.40 / 5.00 | 4.96 / 4.00 / 5.00 |
| M3 | 4.58 / 4.44 / 4.78 | 4.68 / 4.68 / 4.84 | 4.52 / 4.52 / 4.88 |
| M3_b5 | 4.74 / 4.58 / 4.96 | 4.76 / 4.80 / 4.82 | 4.58 / 4.52 / 4.80 |
| M4 | 4.84 / 4.12 / 5.00 | 4.58 / 4.02 / 5.00 | 3.16 / 2.62 / 4.38 |
| M5 | 4.38 / 4.30 / 4.80 | 4.32 / 4.30 / 4.56 | 4.50 / 4.42 / 4.68 |
| M5_80 | 4.50 / 4.42 / 4.90 | 4.58 / 4.60 / 4.80 | 4.56 / 4.50 / 4.82 |
| M6 | 4.76 / 4.58 / 4.96 | 4.64 / 4.64 / 4.88 | 4.48 / 4.42 / 4.90 |

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
| M3_b5 | 56 / 71 | 57 / 72 | 65 / 84 | 67 / 85 | 60 / 83 | 63 / 84 |
| M3h | 40 / 56 | – | 38 / 58 | – | 43 / 66 | – |
| M4 | 6 / 40 | 7 / 40 | 26 / 67 | 25 / 67 | -16 / 48 | -17 / 49 |
| M5 | 71 / 81 | 73 / 82 | 76 / 89 | 79 / 91 | 74 / 89 | 77 / 90 |
| M5_80 | 63 / 76 | 64 / 77 | 70 / 87 | 73 / 88 | 67 / 86 | 69 / 87 |
| M6 | – | 1 / 0 | – | 2 / 1 | – | 1 / 0 |

Figures: `figures/pareto.png` (savings vs quality per cell), `figures/gap_parity.png` (token gap).
