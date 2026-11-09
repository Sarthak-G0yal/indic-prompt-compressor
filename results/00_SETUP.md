# Experiment 01 setup: what was tested and how

## 1 Data and tasks
| | Source | Per language | What the model gets |
|---|---|---|---|
| **QA** | IndicQA (ai4bharat), Wikipedia paragraphs with questions and short gold answers | 50 items (frozen sample, seed 42) | a paragraph and a question; it must reply with a short answer |
| **Summarisation** | IndicQA paragraphs (no reference summaries) | 50 items | a paragraph; it must write a 2–3 sentence summary |
| **Gap measurement** | FLORES+ devtest, ~1,000 parallel sentences in en/hi/kn/ta | — | no model call; only token counts |

Prompts used for every method (only the text inside changes):
- **QA system prompt:** "Answer the question using only the given context. Give a short answer of a few words, taken from the context where possible. Output only the answer." followed by the language rule.
- **Summary system prompt:** "Summarise the given text in 2-3 sentences. Output only the summary." followed by the language rule.
- **Language rule:** "Respond only in Hindi/Kannada/Tamil, using the … script", or "Respond only in English" for the English-route methods.

## 2 The methods (M0 … M6)
Each method changes **what text is sent to the LLM** and/or **which language the LLM answers in**.
The user always gets the final answer back in their own language.

| ID | Name | What is sent to the LLM | LLM answers in | Post-processing (local, free) | Tool |
|---|---|---|---|---|---|
| **M0** | Baseline | the original Indic paragraph and question, unchanged | Indic | — | — |
| **M0_rep** | Baseline, repeated | exactly the same request as M0, sent a second time | Indic | — | — |
| **M1** | Clean-up | the paragraph after Unicode NFC normalisation, removing zero-width characters, Wikipedia citation marks like `[12]`, extra spaces and exact duplicate sentences | Indic | — | regex |
| **M2_xx** | Prune in the original script | the M1 paragraph with less-important tokens deleted. `xx` = **% of tokens kept** (M2_80 keeps 80%, M2_40 keeps 40%). The question is never pruned; sentence punctuation (`। . ? \n`) is always kept | Indic | — | LLMLingua-2 (XLM-RoBERTa-large token classifier, multilingual), run locally on the GPU |
| **M3** | Via English | the paragraph and question **translated to English** sentence by sentence | English | English answer translated back to Indic | IndicTrans2 dist-200M, indic→en and en→indic, local GPU, beam 2 |
| **M4** | Romanise | the paragraph and question written in **Roman letters** (ITRANS), plus a note "(The text below is Hindi written in Roman letters.)" | Indic script | — | `indic_transliteration` |
| **M5** | Via English + prune | like M3, but the English paragraph is then pruned with LLMLingua-2 to keep 60%. The question is kept whole | English | translated back to Indic | IndicTrans2 + LLMLingua-2 |
| **M6** | Answer in English (summaries only) | the M1 Indic paragraph, unchanged | English | English summary translated back to Indic | IndicTrans2 en→indic |

Why each method exists:
- **M0 / M0_rep** are the reference and the noise check. If two identical requests already differ by X%, then a method's quality drop smaller than X% is not real.
- **M1** is the "free, lossless" baseline. It only helps on messy real-world text; Wikipedia text is already clean, so ~0% here.
- **M2** attacks *input length* without leaving the language. It is cheap, but it can delete meaning-carrying pieces of agglutinative Kannada/Tamil words.
- **M3** attacks the *tokenizer gap* itself. English costs 2.8–3.7× fewer tokens on DeepSeek (4–9× on GLM). It also shortens the *output*, because English answers are shorter. The risk is translation errors.
- **M4** tests whether the gap comes from the script (Unicode bytes) rather than the language. It helps only tokenizers that are bad at Indic scripts.
- **M5** stacks the two input-side ideas (translate, then prune) for the maximum saving.
- **M6** is an output-only saving for long answers. Input stays native, so the model reads the original exactly, but it writes the summary in cheaper English.

**Added in Run 4 (notebook v2), to fix the Tamil via-English failure and the M5 quality loss:**

| ID | What changes | Why |
|---|---|---|
| **M3_b5** | Same as M3, but IndicTrans2 uses beam search 5 (instead of 2) in both directions | Fewer translation errors (Tamil "cancer → psoriasis") |
| **M5_80** | Same as M5, but LLMLingua-2 keeps 80% of the English (instead of 60%) | M5 dropped facts; a gentler cut should land between M3 and M5 |
| **M3h** (QA only) | Hybrid: beam-5 English context, plus the 2 original-script sentences most similar to the question (picked with LaBSE), plus the original question. The LLM answers directly in the source language and is told to copy names and numbers from the original sentences | Names and numbers survive even if the translation garbles them, and there is no back-translation step to mangle the answer |


Optional variants defined in the notebook but **not run** in this experiment:
- **M3b**: via English using sarvam-translate (GGUF in Ollama) instead of IndicTrans2.
- **M4b**: romanise using Sarvam's `/transliterate` API.

## 3 How cost and quality are measured
- **Tokens / cost:** taken from the API `usage` field (prompt and completion tokens), priced at DeepSeek V4.1 Flash rates (₹25 in / ₹105 out per 1M tokens).
  - *Cost saving* = 1 − cost(method) / cost(M0), summed over the 50 items of a cell.
  - *GLM-5.3 projected* = the same prompts counted with the GLM-5.3 tokenizer offline and priced at ₹126 / ₹390.
- **Quality:** `sarvam-105b` judges every answer against the **original Indic paragraph**. It never sees which method produced the answer.
  - QA: verdict correct / partial / wrong → 1 / 0.5 / 0, compared with the gold answer.
  - Summaries: faithfulness + coverage + fluency, each scored 1–5, then divided by 15.
- **Retained** = mean judge score(method) / mean judge score(M0) for the same 50 items.
  - The **CI** is a 95% paired bootstrap over items (2,000 resamples).
  - A method **passes** if retained ≥ 0.95 (τ). "Strict pass" means the CI lower bound is ≥ 0.95.
- **Supporting metrics:**
  - token-F1 against the gold (QA);
  - LaBSE similarity to the M0 answer;
  - local overhead in seconds (translation/pruning time on the RTX 3050 Ti; all local steps are ₹0).

## Token gap (FLORES+ devtest, ~1,000 parallel sentences)
Parity = tokens(language) / tokens(English) for the same content; fertility = tokens per word.

| Tokenizer | variant | en | hi | kn | ta (parity) | fertility hi / kn / ta |
|---|---|---|---|---|---|---|
| deepseekv4.1-flash-1017 | native | 1.00 | 2.79 | 3.69 | 3.07 | 2.95 / 6.19 / 4.95 |
| deepseekv4.1-flash-1017 | M1 | – | 2.79 | 3.63 | 3.07 | 2.94 / 6.10 / 4.94 |
| deepseekv4.1-flash-1017 | M4 ITRANS | – | 2.53 | 2.70 | 3.64 | 2.67 / 4.54 / 5.86 |
| glm5.3 | native | 1.00 | 4.31 | 8.85 | 7.64 | 4.57 / 14.95 / 12.39 |
| glm5.3 | M1 | – | 4.32 | 8.82 | 7.64 | 4.58 / 14.89 / 12.38 |
| glm5.3 | M4 ITRANS | – | 2.52 | 2.69 | 3.89 | 2.68 / 4.54 / 6.31 |
| gemma4 | native | 1.00 | 1.31 | 1.92 | 1.47 | 1.39 / 3.24 / 2.37 |
| gemma4 | M1 | – | 1.31 | 1.90 | 1.46 | 1.38 / 3.19 / 2.37 |
| gemma4 | M4 ITRANS | – | 2.38 | 2.53 | 3.38 | 2.52 / 4.26 / 5.47 |
| sarvam-105b | native | 1.00 | 1.31 | 1.51 | 1.47 | 1.39 / 2.54 / 2.37 |
| sarvam-105b | M1 | – | 1.31 | 1.47 | 1.46 | 1.38 / 2.48 / 2.37 |
| sarvam-105b | M4 ITRANS | – | 2.38 | 2.53 | 3.38 | 2.52 / 4.26 / 5.47 |
| gpt-4o (o200k) | native | 1.00 | 1.57 | 1.97 | 1.98 | 1.65 / 3.29 / 3.17 |
| gpt-4o (o200k) | M1 | – | 1.57 | 1.95 | 1.98 | 1.65 / 3.25 / 3.17 |
| gpt-4o (o200k) | M4 ITRANS | – | 2.39 | 2.50 | 3.42 | 2.50 / 4.18 / 5.48 |
