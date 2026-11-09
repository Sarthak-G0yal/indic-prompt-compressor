"""Download every dataset, tokenizer and local model the experiment notebooks need.

Usage (from the project root):
    uv run python scripts/download_assets.py            # datasets + tokenizers + local models
    uv run python scripts/download_assets.py --ollama   # also pull the sarvam-translate GGUF into Ollama (optional M3b)
    uv run python scripts/download_assets.py --no-models  # only datasets + tokenizers (small, fast)

Gated repos (accept the terms on the HF page first, then put HF_TOKEN in .env):
    https://huggingface.co/datasets/openlanguagedata/flores_plus
    https://huggingface.co/ai4bharat/indictrans2-indic-en-dist-200M
    https://huggingface.co/ai4bharat/indictrans2-en-indic-dist-200M
"""
from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")
os.environ.setdefault("TIKTOKEN_CACHE_DIR", str(ROOT / "models" / "tiktoken"))

from huggingface_hub import hf_hub_download, snapshot_download  # noqa: E402

RAW = ROOT / "data" / "raw"
TOK_DIR = ROOT / "models" / "tokenizers"

FLORES_CODES = ["eng_Latn", "hin_Deva", "kan_Knda", "tam_Taml"]
INDICQA_LANGS = ["hi", "kn", "ta"]

# Sarvam model id -> HF repo holding the same tokenizer (matched by name; verified against API usage in the notebook)
TOKENIZER_REPOS = {
    "deepseekv4.1-flash-1017": "deepseek-ai/DeepSeek-V4.1-Flash-1017",
    "glm5.3": "zai-org/GLM-5.3",  # byte-identical tokenizer.json to zai-org/GLM-5.3-Flash
    "gemma4": "google/gemma-4-31B-it",
    "sarvam-105b": "sarvamai/sarvam-105b",
}

LOCAL_MODELS = {
    "ai4bharat/indictrans2-indic-en-dist-200M": ["pytorch_model.bin"],
    "ai4bharat/indictrans2-en-indic-dist-200M": ["pytorch_model.bin"],
    "microsoft/llmlingua-2-xlm-roberta-large-meetingbank": [],
    "sentence-transformers/LaBSE": ["*.h5", "*.msgpack", "onnx/*", "pytorch_model.bin", "2_Dense/pytorch_model.bin"],
}

OLLAMA_MODEL = "hf.co/fischerman/sarvam-translate-gguf:Q4_K_S"

failures: list[str] = []


def step(name: str, fn):
    print(f"-> {name} ... ", end="", flush=True)
    try:
        fn()
        print("ok")
    except Exception as e:  # keep going; report at the end
        print("FAILED")
        failures.append(f"{name}: {type(e).__name__}: {str(e)[:300]}")


def get_flores():
    out = RAW / "flores"
    out.mkdir(parents=True, exist_ok=True)
    for code in FLORES_CODES:
        p = hf_hub_download("openlanguagedata/flores_plus", f"devtest/{code}.jsonl", repo_type="dataset")
        shutil.copy(p, out / f"{code}.jsonl")


def get_indicqa():
    out = RAW / "indicqa"
    out.mkdir(parents=True, exist_ok=True)
    for lang in INDICQA_LANGS:
        p = hf_hub_download("ai4bharat/IndicQA", f"data/indicqa.{lang}.json", repo_type="dataset")
        shutil.copy(p, out / f"indicqa.{lang}.json")


def get_tokenizer(model_id: str, repo: str):
    def _f():
        d = TOK_DIR / model_id
        d.mkdir(parents=True, exist_ok=True)
        for fn in ("tokenizer.json", "tokenizer_config.json"):
            p = hf_hub_download(repo, fn)
            shutil.copy(p, d / fn)
    return _f


def get_tiktoken():
    import tiktoken

    tiktoken.get_encoding("o200k_base")


def get_model(repo: str, ignore: list[str]):
    return lambda: snapshot_download(repo, ignore_patterns=ignore or None)


def pull_ollama():
    if shutil.which("ollama") is None:
        raise RuntimeError("ollama not found on PATH")
    subprocess.run(["ollama", "pull", OLLAMA_MODEL], check=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-models", action="store_true", help="skip local model weights")
    ap.add_argument("--ollama", action="store_true", help="also pull the sarvam-translate GGUF via Ollama (ollama serve must be running)")
    args = ap.parse_args()

    if not os.environ.get("HF_TOKEN"):
        print("WARNING: HF_TOKEN not set; gated downloads (FLORES+, IndicTrans2) will fail.\n")

    step("FLORES+ devtest (eng/hin/kan/tam)", get_flores)
    step("IndicQA (hi/kn/ta)", get_indicqa)
    for mid, repo in TOKENIZER_REPOS.items():
        step(f"tokenizer {mid} <- {repo}", get_tokenizer(mid, repo))
    step("tiktoken o200k_base", get_tiktoken)
    if not args.no_models:
        for repo, ignore in LOCAL_MODELS.items():
            step(f"model {repo}", get_model(repo, ignore))
    if args.ollama:
        step(f"ollama pull {OLLAMA_MODEL}", pull_ollama)

    print()
    if failures:
        print("Some downloads failed:")
        for f in failures:
            print("  -", f)
        print("\nFor 401/403 GatedRepoError: open the repo page on huggingface.co, accept the terms, and set HF_TOKEN in .env.")
        sys.exit(1)
    print("All assets downloaded.")


if __name__ == "__main__":
    main()
