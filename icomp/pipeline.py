"""The compressor layer: route → prepare → call the LLM → post-process → report."""
from __future__ import annotations

import asyncio
import json
import re
import time

from . import tokens
from .config import JUDGE_EXTRA, JUDGE_MODEL, LANGS, MAX_TOKENS, MODELS, THINKING_EXTRA_TOKENS, price
from .llm import SarvamChat
from .methods import ENGLISH_ROUTE, METHOD_INFO, Prepared, Request, back_translate, prepare
from .router import RULES, Decision, route
from .text import ABSTAIN, detect_lang

_THINK = re.compile(r"<think>.*?</think>", re.S)


def build_request(d: dict) -> Request:
    task = d.get("task", "qa")
    if task not in ("qa", "summ", "chat"):
        raise ValueError("task must be qa, summ or chat")
    text = d.get("prompt", "") if task == "chat" else f"{d.get('context', '')} {d.get('question', '')}"
    if not text.strip():
        raise ValueError("empty input")
    lang = d.get("lang") or "auto"
    if lang == "auto":
        lang, _ = detect_lang(text)
    return Request(task=task, lang=lang, context=d.get("context", ""), question=d.get("question", ""), prompt=d.get("prompt", ""))


def _rs(model: str, pt: float, ct: float) -> float:
    pin, pout = price(model)
    return (pt * pin + ct * pout) / 1e6


class Compressor:
    def __init__(self):
        self.llm = SarvamChat()

    # ---------------------------------------------------------------- shared steps
    async def _decide_and_prepare(self, req: Request, model: str, profile: str, override: str | None):
        decision = route(req, model, profile, override)
        prep = await asyncio.to_thread(prepare, req, decision.method)
        base = prepare(req, "M0")
        tok_base = tokens.count_messages(model, base.messages)
        tok_prep = tokens.count_messages(model, prep.messages)
        min_saving = RULES["settings"]["min_saving"]
        if (decision.status not in ("override",) and prep.method not in ("M0", "M1", "M6")
                and tok_base and 1 - tok_prep / tok_base < min_saving):
            decision.reasons.append(f"{prep.method} saved only {1 - tok_prep / tok_base:.0%} input tokens on this prompt "
                                    f"(< {min_saving:.0%}): switched to clean-up only")
            decision.method, decision.status = "M1", "guard"
            prep = prepare(req, "M1")
            tok_prep = tokens.count_messages(model, prep.messages)
        return decision, prep, base, tok_base, tok_prep

    async def _call(self, model: str, req: Request, prep: Prepared) -> dict:
        mt = MAX_TOKENS[req.task] + (THINKING_EXTRA_TOKENS if MODELS[model]["thinks"] else 0)
        res = await self.llm.chat(model, prep.messages, mt, **MODELS[model]["extra"])
        res["content"] = _THINK.sub("", res["content"]).strip()
        res["final"], res["back_s"] = res["content"], 0.0
        if prep.answer_lang == "en" and res["content"]:
            res["final"], res["back_s"] = await asyncio.to_thread(back_translate, res["content"], req.lang, prep.back_beams)
        return res

    # ---------------------------------------------------------------- public API
    async def preview(self, d: dict) -> dict:
        """Free: routing decision + compressed prompt + offline token estimate. No LLM call."""
        model, profile = d.get("model") or next(iter(MODELS)), d.get("profile", "balanced")
        req = build_request(d)
        t0 = time.perf_counter()
        decision, prep, base, tb, tp = await self._decide_and_prepare(req, model, profile, d.get("method"))
        return dict(lang=req.lang, task=req.task, model=model, decision=decision.to_dict(),
                    sent=prep.shown, messages=prep.messages, answer_lang=prep.answer_lang,
                    tokens=dict(original_input=tb, compressed_input=tp, input_saving=1 - tp / tb if tb else 0.0,
                                tokenizer_exact=tokens.has_tokenizer(model)),
                    local_s=round(time.perf_counter() - t0, 2))

    async def run(self, d: dict) -> dict:
        model, profile = d.get("model") or next(iter(MODELS)), d.get("profile", "balanced")
        compare, judge = bool(d.get("compare")), bool(d.get("judge"))
        req = build_request(d)
        t0 = time.perf_counter()
        decision, prep, base, tb, tp = await self._decide_and_prepare(req, model, profile, d.get("method"))
        t_prep = time.perf_counter() - t0

        jobs = [self._call(model, req, prep)]
        if compare and prep.method != "M0":
            jobs.append(self._call(model, req, base))
        outs = await asyncio.gather(*jobs)
        res, orig = outs[0], (outs[1] if len(outs) > 1 else None)

        extra_cost, fallback = 0.0, None
        if (req.task == "qa" and prep.method in ENGLISH_ROUTE and RULES["settings"]["abstain_fallback"]
                and ABSTAIN.search(res["content"] or "")):
            fb = orig or await self._call(model, req, base)
            fallback = dict(reason=f"The English answer was '{res['content'][:80]}': re-sent the original prompt",
                            first_answer=res["final"], first_cost_rs=res["cost_rs"])
            extra_cost = res["cost_rs"]
            res = dict(fb)

        # baseline: real (compare mode) or estimated from the original prompt's token count
        sent_in = tokens.count_messages(model, prep.messages)
        overhead = max(res["prompt_tokens"] - sent_in, 0) if not fallback else 0
        if orig:
            base_in, base_out, base_cost, base_kind = orig["prompt_tokens"], orig["completion_tokens"], orig["cost_rs"], "measured"
        else:
            base_in = tb + overhead if not fallback else res["prompt_tokens"]
            base_out = (tokens.count(model, res["final"]) + res.get("reasoning_tokens", 0)) if not fallback else res["completion_tokens"]
            base_cost, base_kind = _rs(model, base_in, base_out), "estimated"
        cost = res["cost_rs"] + extra_cost
        report = dict(
            lang=req.lang, lang_name=LANGS.get(req.lang, {}).get("name", req.lang), task=req.task, model=model,
            model_label=MODELS[model]["label"], profile=profile,
            decision=decision.to_dict(), fallback=fallback,
            sent=prep.shown, answer=res["final"], answer_raw=res["content"] if prep.answer_lang == "en" else None,
            usage=dict(prompt_tokens=res["prompt_tokens"], completion_tokens=res["completion_tokens"],
                       reasoning_tokens=res.get("reasoning_tokens", 0), cost_rs=cost, finish_reason=res["finish_reason"]),
            baseline=dict(kind=base_kind, prompt_tokens=base_in, completion_tokens=base_out, cost_rs=base_cost),
            savings=dict(tokens=(base_in + base_out) - (res["prompt_tokens"] + res["completion_tokens"]),
                         tokens_pct=1 - (res["prompt_tokens"] + res["completion_tokens"]) / max(base_in + base_out, 1),
                         input_pct=1 - res["prompt_tokens"] / max(base_in, 1),
                         rs=base_cost - cost, rs_pct=1 - cost / base_cost if base_cost else 0.0),
            expected_quality=decision.evidence and dict(retained=decision.evidence["retained"], ci_lo=decision.evidence["ci_lo"],
                                                        source="Run 4, DeepSeek, n = 50"),
            timing=dict(prepare_s=round(t_prep, 2), llm_s=round(res.get("latency_s", 0), 2), back_translate_s=round(res.get("back_s", 0), 2),
                        total_s=round(time.perf_counter() - t0, 2)),
        )
        if orig:
            report["original"] = dict(answer=orig["final"], prompt_tokens=orig["prompt_tokens"],
                                      completion_tokens=orig["completion_tokens"], cost_rs=orig["cost_rs"])
            if judge:
                report["judge"] = await self.judge(req, res["final"], orig["final"])
        return report

    # ---------------------------------------------------------------- optional judge (compare mode)
    async def judge(self, req: Request, answer: str, original_answer: str) -> dict:
        async def one(ans):
            msgs = _judge_messages(req, ans)
            r = await self.llm.chat(JUDGE_MODEL, msgs, 800, **JUDGE_EXTRA)
            m = re.search(r"\{.*\}", r["content"], re.S)
            try:
                j = json.loads(m.group(0)) if m else None
            except json.JSONDecodeError:
                j = None
            return dict(verdict=j, score=_score(req.task, j), cost_rs=r["cost_rs"])
        a, b = await asyncio.gather(one(answer), one(original_answer))
        ret = a["score"] / b["score"] if a["score"] is not None and b["score"] else None
        return dict(model=JUDGE_MODEL, compressed=a, original=b, retained=ret)


def _judge_messages(req: Request, answer: str) -> list[dict]:
    L = LANGS[req.lang]["name"]
    if req.task == "qa":
        p = (f"You are grading an answer to a reading-comprehension question written in {L}.\n\nContext:\n{req.context}\n\n"
             f"Question: {req.question}\n\nCandidate answer: {answer}\n\n"
             "Judge meaning, not exact wording. 'correct' = the context supports the answer and it answers the question; "
             "'partial' = right information mixed with wrong or missing key parts; 'wrong' = incorrect, unrelated, empty, "
             f"or not in {L}.\nReply with JSON only: {{\"verdict\": \"correct\" | \"partial\" | \"wrong\", \"reason\": \"<one short sentence>\"}}")
    elif req.task == "summ":
        p = (f"You are grading a summary of a {L} text.\n\nText:\n{req.context}\n\nSummary:\n{answer}\n\n"
             "Rate 1-5 for each: faithfulness (no facts absent from or contradicting the text), coverage (main points included), "
             f"fluency (natural, grammatical {L}).\nReply with JSON only: {{\"faithfulness\": int, \"coverage\": int, \"fluency\": int, "
             "\"reason\": \"<one short sentence>\"}}")
    else:
        p = (f"You are grading a reply to a {L} request.\n\nRequest:\n{req.prompt}\n\nReply:\n{answer}\n\n"
             f"Rate 1-5 for each: correctness, helpfulness, fluency (natural, grammatical {L}).\n"
             "Reply with JSON only: {\"correctness\": int, \"helpfulness\": int, \"fluency\": int, \"reason\": \"<one short sentence>\"}")
    return [{"role": "user", "content": p}]


def _score(task: str, j: dict | None):
    if not j:
        return None
    try:
        if task == "qa":
            return {"correct": 1.0, "partial": 0.5, "wrong": 0.0}.get(str(j.get("verdict", "")).lower())
        keys = ("faithfulness", "coverage", "fluency") if task == "summ" else ("correctness", "helpfulness", "fluency")
        return sum(int(j[k]) for k in keys) / 15
    except (KeyError, TypeError, ValueError):
        return None


def method_catalog() -> dict:
    return METHOD_INFO
