"""Paths, environment, models and prices for the icomp layer."""
from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")
os.environ.setdefault("TIKTOKEN_CACHE_DIR", str(ROOT / "models" / "tiktoken"))
os.environ.setdefault("PYTORCH_CUDA_ALLOC_CONF", "expandable_segments:True")

SARVAM_API_KEY = os.environ.get("SARVAM_API_KEY", "")
SARVAM_BASE = os.environ.get("SARVAM_BASE", "https://api.sarvam.ai")
TOK_DIR = ROOT / "models" / "tokenizers"
SAMPLES = ROOT / "data" / "samples"
CACHE_DIR = ROOT / "cache" / "app"
RULES_FILE = Path(__file__).with_name("routing_rules.toml")

DEVICE = os.environ.get("ICOMP_DEVICE", "")            # "" = auto (cuda if available)
GPU_BUDGET_MB = int(os.environ.get("ICOMP_GPU_BUDGET_MB", "3000"))   # capped at runtime by free VRAM - 600 MB
USE_DISK_CACHE = os.environ.get("ICOMP_CACHE", "0") == "1"

# Target models offered by the app. family = which routing-table rows apply.
# extra = request params (thinking off where the model allows it).
MODELS = {
    "deepseekv4.1-flash-1017": dict(label="DeepSeek V4.1 Flash", family="deepseek", price=(25, 105),
                                    extra={"temperature": 0, "reasoning_effort": "none"}, thinks=False),
    "glm5.3-flash": dict(label="GLM-5.3 Flash", family="glm", price=(13.5, 45),
                         extra={"temperature": 0}, thinks=True, tokenizer="glm5.3"),
    "glm5.3": dict(label="GLM-5.3", family="glm", price=(126, 390), extra={"temperature": 0}, thinks=True),
    "sarvam-105b": dict(label="Sarvam-105B", family="indic_efficient", price=(15, 60),
                        extra={"temperature": 0, "reasoning_effort": "none"}, thinks=False),
    "gemma4": dict(label="Gemma 4", family="indic_efficient", price=(35, 90), extra={"temperature": 0}, thinks=False),
}
DEFAULT_MODEL = "deepseekv4.1-flash-1017"
JUDGE_MODEL = "sarvam-105b"
JUDGE_EXTRA = {"temperature": 0, "reasoning_effort": "none"}

# max output tokens per task; models that always think need room for reasoning
MAX_TOKENS = {"qa": 256, "summ": 700, "chat": 1500}
THINKING_EXTRA_TOKENS = 4000

LANGS = {
    "hi": dict(name="Hindi", script="Devanagari", it2="hin_Deva"),
    "kn": dict(name="Kannada", script="Kannada", it2="kan_Knda"),
    "ta": dict(name="Tamil", script="Tamil", it2="tam_Taml"),
}


def price(model: str) -> tuple[float, float]:
    """₹ per 1M tokens (input, output)."""
    return MODELS[model]["price"]


def tokenizer_id(model: str) -> str:
    return MODELS[model].get("tokenizer", model)
