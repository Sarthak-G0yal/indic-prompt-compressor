"""FastAPI backend + the one-page frontend.   Run:  uv run uvicorn icomp.server:app --port 8000"""
from __future__ import annotations

import json
import random
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Body, FastAPI, HTTPException
from fastapi.responses import FileResponse

from . import local_models
from .config import DEFAULT_MODEL, LANGS, MODELS, SAMPLES, SARVAM_API_KEY
from .llm import LLMError
from .methods import METHOD_INFO, VALID_FOR
from .pipeline import Compressor
from .router import PROFILES, RULES

STATIC = Path(__file__).with_name("static")
comp = Compressor()


@asynccontextmanager
async def lifespan(_app):
    yield
    await comp.llm.close()


app = FastAPI(title="Indic Prompt Compressor", lifespan=lifespan)


@app.get("/")
def index():
    return FileResponse(STATIC / "index.html")


@app.get("/api/health")
def health():
    return {"ok": True, "sarvam_key": bool(SARVAM_API_KEY), "local_models": local_models.status()}


@app.get("/api/options")
def options():
    return {
        "models": [{"id": k, "label": v["label"], "family": v["family"], "price": v["price"]} for k, v in MODELS.items()],
        "default_model": DEFAULT_MODEL,
        "methods": [{"id": k, "description": v, "tasks": sorted(VALID_FOR[k])} for k, v in METHOD_INFO.items()],
        "profiles": list(PROFILES), "langs": {k: v["name"] for k, v in LANGS.items()},
        "tasks": {"qa": "Question answering (context + question)", "summ": "Summarise a text", "chat": "Free-form prompt (not validated)"},
        "settings": RULES["settings"],
    }


@app.get("/api/examples")
def examples(lang: str = "hi", task: str = "qa"):
    t = "summ" if task == "summ" else "qa"
    f = SAMPLES / f"{t}_{lang}.jsonl"
    if not f.exists():
        raise HTTPException(404, f"no samples in {f} (run notebook 01, section B)")
    rows = [json.loads(l) for l in f.read_text(encoding="utf-8").splitlines() if l.strip()]
    r = random.choice(rows)
    return {"lang": lang, "task": t, "context": r["context"], "question": r.get("question") or "",
            "gold": r.get("answers") or [], "item_id": r["item_id"]}


async def _guard(coro):
    try:
        return await coro
    except ValueError as e:
        raise HTTPException(400, str(e))
    except LLMError as e:
        raise HTTPException(502, str(e))


@app.post("/api/preview")
async def preview(body: dict = Body(...)):
    return await _guard(comp.preview(body))


@app.post("/api/run")
async def run(body: dict = Body(...)):
    return await _guard(comp.run(body))
