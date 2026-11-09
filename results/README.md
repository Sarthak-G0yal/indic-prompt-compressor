# Results index: Indic Prompt Compressor, Experiment 01 (DeepSeek V4.1 Flash)

All runs use the notebook `notebooks/01_deepseek_experiment.ipynb`, target `deepseekv4.1-flash-1017` (thinking off), and judge `sarvam-105b`.
**Setup** (data, exact prompts, what every method M0–M6 / M3_b5 / M5_80 / M3h does, how cost and quality are measured, and the FLORES token gap): [`00_SETUP.md`](00_SETUP.md)

## Runs (one write-up per run)

| # | Date | Write-up | Data folder | n per cell | Methods | Status |
|---|---|---|---|---|---|---|
| 1 | 2026-11-07 | [`RUN1_smoke_broken_judge.md`](01_deepseek_smoke/RUN1_smoke_broken_judge.md) | (overwritten by Run 2) | 5 | M0, M0_rep, M1, M2 (keep 60%), M3, M4, M5, M6 | quality **invalid**: the judge thought too long and returned empty output for 26% of answers |
| 2 | 2026-11-07 | [`RUN2_smoke_judge_fixed.md`](01_deepseek_smoke/RUN2_smoke_judge_fixed.md) | `01_deepseek_smoke/` | 5 | + M2 sweep 40/60/80 | valid but directional (1 QA item = 20 points) |
| 3 | 2026-11-08 | [`RUN3_full_v1.md`](01_deepseek_v1/RUN3_full_v1.md) | `01_deepseek_v1/` | 50 | same as Run 2 | valid |
| 4 | 2026-11-08 | [`RUN4_full_v2.md`](01_deepseek/RUN4_full_v2.md) | `01_deepseek/` | 50 | + M3_b5, M5_80, M3h | **latest** |

Each run folder holds `summary.csv` (one row per language × task × method), `results.jsonl` (every answer with its judge verdict and cost),
`target_outputs.jsonl`, `gap_flores.csv`, `offline_upper_bound.csv`, `figures/` and the Hindi spot-check sheet.
Every write-up ends with an appendix of complete tables generated from its own folder.

## Headline (latest run, Run 4)
- **Token gap vs English:** GLM-5.3 hi 4.3× · kn 8.9× · ta 7.6×; DeepSeek 2.8× · 3.7× · 3.1×; Sarvam/Gemma 1.3–1.9×.
- **Best method per cell (quality ≥ 95% of the original):**

  | | QA | Summary |
  |---|---|---|
  | Hindi | M5, 70% saving | M5_80, 57% |
  | Kannada | M5_80, 69% | M5_80, 64% |
  | Tamil | M2_80, 17% (M3h 41% at 0.947, borderline) | M5, 64% |

- **Overall ₹ saving at τ = 95%:** 58% on DeepSeek, **73% projected on GLM-5.3** (78% with M3h for Tamil QA). Under the strict test (CI lower bound ≥ 95%): 51% / 64%.
- **Negative results:** romanisation (M4) on DeepSeek; heavy pruning (M2_40) everywhere; Kannada/Tamil tolerate pruning less than Hindi.
- **Noise:** a rerun with an unchanged configuration moves retained quality by ≤ ±2 points. DeepSeek at temperature 0 is not deterministic.

## How the main numbers moved across runs (₹ saving / quality retained)

| M3 | Hindi QA | Hindi summ | Kannada QA | Kannada summ | Tamil QA | Tamil summ |
|---|---|---|---|---|---|---|
| Run 2 (smoke, n=5) | 56% / 1.00 | 57% / 1.01 | 66% / 1.00 | 59% / 1.01 | 59% / 0.89 | 60% / 0.96 |
| Run 3 (full v1, n=50) | 55% / 0.97 | 54% / 0.96 | 64% / 0.98 | 62% / 0.99 | 60% / 0.90 | 57% / 0.99 |
| Run 4 (full v2, n=50) | 55% / 0.97 | 54% / 0.97 | 64% / 0.97 | 62% / 0.99 | 60% / 0.93 | 57% / 1.00 |

| M5 | Hindi QA | Hindi summ | Kannada QA | Kannada summ | Tamil QA | Tamil summ |
|---|---|---|---|---|---|---|
| Run 2 (smoke, n=5) | 70% / 1.00 | 66% / 1.01 | 75% / 0.90 | 63% / 0.89 | 73% / 0.89 | 66% / 0.93 |
| Run 3 (full v1, n=50) | 70% / 1.00 | 62% / 0.94 | 75% / 0.92 | 67% / 0.92 | 73% / 0.91 | 64% / 0.96 |
| Run 4 (full v2, n=50) | 70% / 1.00 | 62% / 0.95 | 75% / 0.91 | 67% / 0.92 | 73% / 0.89 | 64% / 0.97 |

| M2_80 | Hindi QA | Hindi summ | Kannada QA | Kannada summ | Tamil QA | Tamil summ |
|---|---|---|---|---|---|---|
| Run 2 (smoke, n=5) | 16% / 1.00 | 13% / 0.97 | 17% / 1.00 | 3% / 1.00 | 18% / 1.00 | 14% / 1.00 |
| Run 3 (full v1, n=50) | 16% / 0.99 | 10% / 0.97 | 17% / 1.04 | 12% / 1.00 | 17% / 1.01 | 11% / 0.99 |
| Run 4 (full v2, n=50) | 16% / 0.99 | 11% / 0.97 | 17% / 1.03 | 12% / 1.00 | 17% / 1.01 | 11% / 1.00 |

| M6 | Hindi QA | Hindi summ | Kannada QA | Kannada summ | Tamil QA | Tamil summ |
|---|---|---|---|---|---|---|
| Run 2 (smoke, n=5) | – | 20% / 1.00 | – | 29% / 1.04 | – | 17% / 0.96 |
| Run 3 (full v1, n=50) | – | 19% / 1.00 | – | 31% / 0.99 | – | 18% / 0.98 |
| Run 4 (full v2, n=50) | – | 20% / 1.00 | – | 31% / 0.99 | – | 17% / 0.99 |

Run 1 is not in these tables: its quality numbers are invalid, and its per-item files were overwritten.

## Still open
- Hindi spot-check by the user (`01_deepseek/hindi_spotcheck.csv`, then notebook cell 45).
- Per-item router (M7), judge perturbation suite and second judge (gemma4), cross-model test on `glm5.3-flash` and `glm5.3`.
