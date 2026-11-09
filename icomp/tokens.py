"""Offline token counting with each target model's own tokenizer."""
from __future__ import annotations

from functools import lru_cache

from tokenizers import Tokenizer

from .config import TOK_DIR, tokenizer_id


@lru_cache(maxsize=None)
def _tok(tid: str):
    f = TOK_DIR / tid / "tokenizer.json"
    if f.exists():
        return Tokenizer.from_file(str(f))
    import tiktoken  # fallback: GPT-4o tokenizer, marked as approximate by the caller
    return tiktoken.get_encoding("o200k_base")


def has_tokenizer(model: str) -> bool:
    return (TOK_DIR / tokenizer_id(model) / "tokenizer.json").exists()


def count(model: str, text: str) -> int:
    t = _tok(tokenizer_id(model))
    if isinstance(t, Tokenizer):
        return len(t.encode(text or "", add_special_tokens=False).ids)
    return len(t.encode(text or ""))


def count_messages(model: str, messages: list[dict]) -> int:
    """Content tokens only (chat-template overhead is the same for every method, so it cancels out in savings)."""
    return sum(count(model, m["content"]) for m in messages)
