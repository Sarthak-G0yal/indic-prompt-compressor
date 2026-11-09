"""Compression methods: each one turns a request into LLM messages plus how to post-process the answer.

Prompts for QA and summarisation are exactly the ones used in Experiment 01, so the measured savings/quality apply.
'chat' (free-form prompt) is an extension that was not part of the experiment.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from . import local_models as lm
from .config import LANGS
from .text import m1_normalize, romanize

TASKS = ("qa", "summ", "chat")

METHOD_INFO = {
    "M0": "Original prompt, unchanged",
    "M1": "Clean-up only (Unicode, invisible characters, citation marks, spaces, repeated sentences)",
    "M2_80": "Prune the original-script text, keep 80% of tokens (LLMLingua-2)",
    "M2_60": "Prune the original-script text, keep 60% of tokens",
    "M2_40": "Prune the original-script text, keep 40% of tokens",
    "M3": "Translate to English (IndicTrans2), answer in English, translate the answer back",
    "M3_b5": "Like M3 with beam-5 translation (more careful, ~2x slower)",
    "M3h": "QA hybrid: English context + 2 key original sentences + original question; answer in the original language",
    "M4": "Romanise (ITRANS); answer in the original script",
    "M5": "Translate to English, then prune the English to 60%",
    "M5_80": "Translate to English, then prune the English to 80%",
    "M6": "Original input, but the answer is written in English and translated back (long outputs)",
}
PRUNE_RATE = {"M2_80": 0.8, "M2_60": 0.6, "M2_40": 0.4, "M5": 0.6, "M5_80": 0.8}
ENGLISH_ROUTE = {"M3", "M3_b5", "M5", "M5_80"}
PRUNING = {"M2_80", "M2_60", "M2_40", "M5", "M5_80"}
VALID_FOR = {m: set(TASKS) for m in METHOD_INFO} | {"M3h": {"qa"}, "M6": {"summ", "chat"}}


@dataclass
class Request:
    task: str                 # qa | summ | chat
    lang: str                 # hi | kn | ta
    context: str = ""         # qa / summ: the passage
    question: str = ""        # qa: the question
    prompt: str = ""          # chat: the whole prompt


@dataclass
class Prepared:
    method: str
    messages: list[dict]
    answer_lang: str                      # "native" or "en"
    back_beams: int = 2
    shown: dict = field(default_factory=dict)   # what was sent, for the UI
    local_s: float = 0.0


_OTHER = dict(name="the original", script="original")


def _rule(lang: str, english: bool) -> str:
    if english:
        return "Respond only in English."
    if lang not in LANGS:
        return "Respond in the same language as the input."
    L = LANGS[lang]
    return f"Respond only in {L['name']}, using the {L['script']} script."


def _messages(req: Request, ctx: str, q: str, english_answer: bool, roman: bool = False, hybrid_key: str = "") -> list[dict]:
    L = LANGS.get(req.lang, _OTHER)
    rule = _rule(req.lang, english_answer)
    note = f"(The text below is {L['name']} written in Roman letters.)\n" if roman else ""
    if req.task == "qa":
        system = ("Answer the question using only the given context. Give a short answer of a few words, "
                  "taken from the context where possible. Output only the answer. " + rule)
        if hybrid_key:
            system += " Copy names and numbers exactly as they appear in the original sentences."
            user = (f"Context (English translation):\n{ctx}\n\n"
                    f"Key sentences from the original {L['name']} text:\n{hybrid_key}\n\nQuestion: {q}")
        else:
            user = f"{note}Context:\n{ctx}\n\nQuestion: {q}"
    elif req.task == "summ":
        system = "Summarise the given text in 2-3 sentences. Output only the summary. " + rule
        user = f"{note}Text:\n{ctx}"
    else:   # chat: the prompt is the user message
        system = rule
        user = f"{note}{ctx}"
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]


def prepare(req: Request, method: str) -> Prepared:
    if method not in METHOD_INFO:
        raise ValueError(f"unknown method {method}")
    if req.task not in VALID_FOR[method]:
        raise ValueError(f"{method} is not available for task {req.task}")
    raw_ctx = req.prompt if req.task == "chat" else req.context
    raw_q = req.question if req.task == "qa" else ""
    secs = 0.0
    if method == "M0":
        return Prepared(method, _messages(req, raw_ctx, raw_q, False), "native", shown={"context": raw_ctx, "question": raw_q})

    ctx, q = m1_normalize(raw_ctx), m1_normalize(raw_q)
    if method == "M1":
        return Prepared(method, _messages(req, ctx, q, False), "native", shown={"context": ctx, "question": q})

    if method.startswith("M2_"):
        ctx_p, s = prune(ctx, PRUNE_RATE[method])
        return Prepared(method, _messages(req, ctx_p, q, False), "native", shown={"context": ctx_p, "question": q}, local_s=s)

    if method == "M4":
        ctx_r, q_r = romanize(ctx, req.lang), romanize(q, req.lang)
        return Prepared(method, _messages(req, ctx_r, q_r, False, roman=True), "native", shown={"context": ctx_r, "question": q_r})

    if method == "M6":
        return Prepared(method, _messages(req, ctx, q, True), "en", shown={"context": ctx, "question": q})

    beams = 5 if method in ("M3_b5", "M3h") else 2
    ctx_en, s1, _ = lm.translate(ctx, req.lang, "en", beams=beams)
    q_en, s2, _ = lm.translate(q, req.lang, "en", beams=beams) if q and method != "M3h" else ("", 0.0, [])
    secs = s1 + s2

    if method == "M3h":
        key, s3 = lm.key_sentences(q, ctx, k=2)
        return Prepared(method, _messages(req, ctx_en, q, False, hybrid_key=key), "native",
                        shown={"context": ctx_en, "key_sentences": key, "question": q}, local_s=secs + s3)

    if method in ("M5", "M5_80"):
        ctx_en, s3 = prune(ctx_en, PRUNE_RATE[method])
        secs += s3
    return Prepared(method, _messages(req, ctx_en, q_en, True), "en", back_beams=beams,
                    shown={"context": ctx_en, "question": q_en}, local_s=secs)


def prune(text: str, rate: float):
    return lm.prune(text, rate)


def back_translate(answer_en: str, lang: str, beams: int) -> tuple[str, float]:
    out, s, _ = lm.translate(answer_en, "en", lang, beams=beams)
    return out, s
