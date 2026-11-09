"""Async Sarvam chat client (OpenAI-compatible /v2/chat/completions)."""
from __future__ import annotations

import asyncio
import hashlib
import json
import time

import httpx

from .config import CACHE_DIR, MODELS, SARVAM_API_KEY, SARVAM_BASE, USE_DISK_CACHE, price


class LLMError(RuntimeError):
    pass


class SarvamChat:
    def __init__(self, key: str = SARVAM_API_KEY, base: str = SARVAM_BASE):
        self.key, self.base = key, base
        self._client: httpx.AsyncClient | None = None

    async def client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=httpx.Timeout(180, connect=20),
                                             headers={"api-subscription-key": self.key, "Content-Type": "application/json"})
        return self._client

    async def close(self):
        if self._client is not None:
            await self._client.aclose()

    async def chat(self, model: str, messages: list[dict], max_tokens: int, **extra) -> dict:
        if not self.key:
            raise LLMError("SARVAM_API_KEY is not set in .env")
        payload = {"model": model, "messages": messages, "max_tokens": max_tokens, **extra}
        key = hashlib.sha256(json.dumps(payload, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
        cache_file = CACHE_DIR / f"{key}.json"
        if USE_DISK_CACHE and cache_file.exists():
            data = json.loads(cache_file.read_text())
            return self._parse(model, data, cached=True)
        c = await self.client()
        t0 = time.perf_counter()
        for attempt in range(5):
            try:
                r = await c.post(f"{self.base}/v2/chat/completions", json=payload)
            except httpx.HTTPError as e:
                if attempt == 4:
                    raise LLMError(f"network error: {e}") from e
                await asyncio.sleep(2 ** attempt)
                continue
            if r.status_code == 200:
                data = r.json()
                data["_latency_s"] = time.perf_counter() - t0
                if USE_DISK_CACHE:
                    CACHE_DIR.mkdir(parents=True, exist_ok=True)
                    cache_file.write_text(json.dumps(data, ensure_ascii=False))
                return self._parse(model, data)
            if r.status_code in (402, 403, 401, 400, 404, 422):
                raise LLMError({402: "Sarvam credits exhausted (402)", 403: "Sarvam key rejected (403)",
                                401: "Sarvam key missing/invalid (401)"}.get(r.status_code, f"HTTP {r.status_code}: {r.text[:300]}"))
            await asyncio.sleep(min(2 ** attempt, 20))   # 429 / 5xx
        raise LLMError(f"HTTP {r.status_code} after retries: {r.text[:300]}")

    @staticmethod
    def _parse(model: str, data: dict, cached: bool = False) -> dict:
        ch = (data.get("choices") or [{}])[0]
        msg = ch.get("message") or {}
        u = data.get("usage") or {}
        details = u.get("completion_tokens_details") or {}
        pin, pout = price(model) if model in MODELS else (0, 0)
        pt, ct = u.get("prompt_tokens", 0) or 0, u.get("completion_tokens", 0) or 0
        return dict(content=(msg.get("content") or "").strip(), finish_reason=ch.get("finish_reason"),
                    prompt_tokens=pt, completion_tokens=ct, reasoning_tokens=details.get("reasoning_tokens") or 0,
                    cost_rs=(pt * pin + ct * pout) / 1e6, latency_s=data.get("_latency_s", 0.0), cached=cached)
