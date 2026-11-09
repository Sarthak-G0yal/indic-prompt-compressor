"""Local models (IndicTrans2, LLMLingua-2, LaBSE), loaded lazily and shared across requests.

The 4 GB GPU can't hold everything at once (LLMLingua-2 alone is ~2.1 GB in fp32). The pool keeps a VRAM budget:
before a model is moved to the GPU, the least-recently-used GPU models are moved to CPU RAM (fast to move back,
no reload from disk). All GPU work runs under one lock, so concurrent requests don't fight over memory.
"""
from __future__ import annotations

import gc
import threading
import time
from collections import OrderedDict

from .config import DEVICE, GPU_BUDGET_MB, LANGS

HEADROOM_MB = 600   # activations + CUDA workspace
from .text import split_sents

_LOCK = threading.RLock()


def _torch():
    import torch
    return torch


def device() -> str:
    if DEVICE:
        return DEVICE
    return "cuda" if _torch().cuda.is_available() else "cpu"


class _Pool:
    def __init__(self):
        self.models: dict[str, object] = {}
        self.on_gpu: OrderedDict[str, float] = OrderedDict()   # name -> MB, LRU order
        self.est_mb = {"it2_indic-en": 450, "it2_en-indic": 450, "llmlingua": 2200}
        self._budget: float | None = None

    def _free(self):
        gc.collect()
        torch = _torch()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

    def _used_mb(self) -> float:
        return sum(self.on_gpu.values())

    def budget(self) -> float:
        """Env budget, capped by what the GPU had free when the first model was loaded (minus room for activations)."""
        if self._budget is None:
            b = GPU_BUDGET_MB
            torch = _torch()
            if torch.cuda.is_available():
                free, _ = torch.cuda.mem_get_info()
                b = min(b, free / 2**20 - HEADROOM_MB)
            self._budget = max(b, 300)
        return self._budget

    def evict_all_except(self, name: str):
        for victim in [k for k in self.on_gpu if k != name]:
            self.on_gpu.pop(victim)
            self.models[victim].to_device("cpu")
        self._free()

    def acquire(self, name: str, loader):
        """Return the model `name` on the working device, loading or moving it there if needed."""
        dev = device()
        m = self.models.get(name)
        if m is None:
            if dev == "cuda":
                self._make_room(name, self.est_mb.get(name, 500))
            torch = _torch()
            before = torch.cuda.memory_allocated() if dev == "cuda" else 0
            m = loader(dev)
            self.models[name] = m
            if dev == "cuda":
                self.on_gpu[name] = max((torch.cuda.memory_allocated() - before) / 2**20, 1)
                self.est_mb[name] = self.on_gpu[name]
        elif dev == "cuda" and name not in self.on_gpu:
            self._make_room(name, self.est_mb.get(name, 500))
            m.to_device("cuda")
            self.on_gpu[name] = self.est_mb.get(name, 500)
        if name in self.on_gpu:
            self.on_gpu.move_to_end(name)
        return m

    def _make_room(self, name: str, need: float):
        while self.on_gpu and self._used_mb() + need > self.budget():
            victim, _ = self.on_gpu.popitem(last=False)
            if victim == name:
                continue
            self.models[victim].to_device("cpu")
            self._free()

    def status(self) -> dict:
        return {"device": device(), "budget_mb": round(self._budget) if self._budget else None,
                "loaded": {k: ("gpu" if k in self.on_gpu else "cpu") for k in self.models},
                "gpu_mb": {k: round(v) for k, v in self.on_gpu.items()}}


POOL = _Pool()


def _with_oom_retry(name: str, loader, fn):
    """Run fn(model); on CUDA OOM move every other model to CPU and retry once."""
    m = POOL.acquire(name, loader)
    try:
        return fn(m)
    except _torch().cuda.OutOfMemoryError:
        POOL.evict_all_except(name)
        return fn(POOL.acquire(name, loader))


# ------------------------------------------------------------------ IndicTrans2
class IndicTrans2:
    def __init__(self, direction: str, dev: str):
        import torch
        from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
        try:
            from IndicTransToolkit import IndicProcessor
        except ImportError:
            from IndicTransToolkit.processor import IndicProcessor
        name = f"ai4bharat/indictrans2-{direction}-dist-200M"
        self.tok = AutoTokenizer.from_pretrained(name, trust_remote_code=True)
        self.model = AutoModelForSeq2SeqLM.from_pretrained(
            name, trust_remote_code=True, torch_dtype=torch.float16 if dev == "cuda" else torch.float32).to(dev).eval()
        # remote code only understands legacy tuple KV caches (see notebook 01, cell 16)
        type(self.model)._supports_default_dynamic_cache = classmethod(lambda cls: False)
        self.ip = IndicProcessor(inference=True)
        self.dev = dev

    def to_device(self, dev: str):
        import torch
        self.model = self.model.to(dev, dtype=torch.float16 if dev == "cuda" else torch.float32)
        self.dev = dev

    def translate_sents(self, sents: list[str], src: str, tgt: str, beams: int = 2, bs: int = 8) -> list[str]:
        import torch
        uniq = sorted(set(sents), key=len)
        out = {}
        for i in range(0, len(uniq), bs):
            batch = uniq[i:i + bs]
            pre = self.ip.preprocess_batch(batch, src_lang=src, tgt_lang=tgt)
            enc = self.tok(pre, truncation=True, padding="longest", return_tensors="pt",
                           return_attention_mask=True).to(self.dev)
            with torch.inference_mode():
                gen = self.model.generate(**enc, use_cache=True, min_length=0, max_length=256,
                                          num_beams=beams, num_return_sequences=1)
            dec = self.tok.batch_decode(gen, skip_special_tokens=True, clean_up_tokenization_spaces=True)
            for s, t in zip(batch, self.ip.postprocess_batch(dec, lang=tgt)):
                out[s] = t
        return [out[s] for s in sents]


def translate(text: str, src_lang: str, tgt_lang: str, beams: int = 2) -> tuple[str, float, list[tuple[str, str]]]:
    """Translate keeping line structure. src_lang/tgt_lang are 'en' or hi/kn/ta.
    Returns (translation, seconds, [(source sentence, translated sentence), ...])."""
    if not text.strip():
        return text, 0.0, []
    direction = "en-indic" if src_lang == "en" else "indic-en"
    src = "eng_Latn" if src_lang == "en" else LANGS[src_lang]["it2"]
    tgt = "eng_Latn" if tgt_lang == "en" else LANGS[tgt_lang]["it2"]
    t0 = time.perf_counter()
    with _LOCK:
        lines = text.split("\n")
        parts = [split_sents(l) for l in lines]
        flat = [s for p in parts for s in p]
        tr = _with_oom_retry(f"it2_{direction}", lambda dev: IndicTrans2(direction, dev),
                             lambda m: m.translate_sents(flat, src, tgt, beams=beams, bs=4 if beams > 2 else 8)) if flat else []
    it = iter(tr)
    out_lines = [" ".join(next(it) for _ in p) for p in parts]
    return "\n".join(out_lines), time.perf_counter() - t0, list(zip(flat, tr))


# ------------------------------------------------------------------ LLMLingua-2
class _LLMLingua:
    def __init__(self, dev: str):
        from llmlingua import PromptCompressor
        self.c = PromptCompressor(model_name="microsoft/llmlingua-2-xlm-roberta-large-meetingbank",
                                  use_llmlingua2=True, device_map=dev)

    def to_device(self, dev: str):
        self.c.model = self.c.model.to(dev)
        self.c.device = dev


FORCE_TOKENS = ["\n", "?", ".", "।"]


def prune(text: str, rate: float) -> tuple[str, float]:
    """Keep about `rate` of the tokens (LLMLingua-2). Returns (text, seconds)."""
    if not text.strip():
        return text, 0.0
    t0 = time.perf_counter()
    with _LOCK:
        out = _with_oom_retry("llmlingua", _LLMLingua, lambda m: m.c.compress_prompt(
            text, rate=rate, force_tokens=FORCE_TOKENS, drop_consecutive=True)["compressed_prompt"])
    return out, time.perf_counter() - t0


# ------------------------------------------------------------------ LaBSE (CPU: only small inputs, for M3h)
_labse = None


def key_sentences(question: str, context: str, k: int = 2) -> tuple[str, float]:
    """The k context sentences most similar to the question (kept in original order)."""
    global _labse
    import numpy as np
    t0 = time.perf_counter()
    sents = split_sents(context.replace("\n", " ")) or [context]
    with _LOCK:
        if _labse is None:
            from sentence_transformers import SentenceTransformer
            _labse = SentenceTransformer("sentence-transformers/LaBSE", device="cpu")
        e = _labse.encode([question] + sents, normalize_embeddings=True, show_progress_bar=False)
    top = sorted(np.argsort(-(e[1:] @ e[0]))[:k])
    return " ".join(sents[i] for i in top), time.perf_counter() - t0


def status() -> dict:
    s = POOL.status()
    s["labse"] = "cpu" if _labse is not None else "not loaded"
    return s
