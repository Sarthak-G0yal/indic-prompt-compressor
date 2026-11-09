"""Rule-based router: routing table (from the experiments) + guard rules. No ML."""
from __future__ import annotations

import tomllib
from dataclasses import dataclass, field

from . import tokens
from .config import LANGS, MODELS, RULES_FILE
from .methods import METHOD_INFO, PRUNING, VALID_FOR, Request
from .text import stats

NO_PRUNE = {"M5": "M3", "M5_80": "M3", "M2_80": "M1", "M2_60": "M1", "M2_40": "M1"}
PROFILES = ("balanced", "safe")


def load_rules(path=RULES_FILE) -> dict:
    with open(path, "rb") as f:
        return tomllib.load(f)


RULES = load_rules()


@dataclass
class Decision:
    method: str
    reasons: list[str] = field(default_factory=list)
    evidence: dict | None = None      # measured numbers for the table row that was used
    status: str = "measured"          # measured | projected | guard | override | not validated

    def to_dict(self):
        return dict(method=self.method, description=METHOD_INFO[self.method], reasons=self.reasons,
                    evidence=self.evidence, status=self.status)


def table_row(family: str, lang: str, task: str, profile: str, rules: dict = RULES):
    fam = rules["families"].get(family)
    status = "measured"
    if fam and "copy_from" in fam:
        status, family = fam["status"], fam["copy_from"]
    elif fam:
        return dict(method=fam["method"]), fam["status"]
    try:
        return rules[family][lang][task][profile], status
    except KeyError:
        return None, "no rule"


def route(req: Request, model: str, profile: str = "balanced", override: str | None = None, rules: dict = RULES) -> Decision:
    s = rules["settings"]
    text = req.prompt if req.task == "chat" else f"{req.context}\n{req.question}"

    if override and override != "auto":
        if req.task not in VALID_FOR.get(override, set()):
            raise ValueError(f"{override} is not available for task {req.task}")
        return Decision(override, [f"Method chosen by the user: {override}"], status="override")

    if req.lang not in LANGS:
        return Decision("M1", [f"Language '{req.lang}' is not Hindi/Kannada/Tamil: only clean-up"], status="guard")

    st = stats(text)
    if st["looks_like_code"] or st["latin_ratio"] > s["latin_ratio_max"]:
        return Decision("M1", [f"Text has code or a lot of Latin script ({st['latin_ratio']:.0%} of letters): "
                               "translating or pruning could break it, so only clean-up"], status="guard")

    n_tok = tokens.count(model, text)
    if n_tok < s["min_tokens"]:
        return Decision("M1", [f"Short prompt ({n_tok} tokens < {s['min_tokens']}): compression would save too little "
                               "to be worth the extra latency, so only clean-up"], status="guard")

    if req.task == "chat":
        if n_tok >= s["chat_long_tokens"] and MODELS[model]["family"] != "indic_efficient":
            return Decision("M3_b5", [f"Free-form prompt of {n_tok} tokens: route via English with careful (beam-5) translation, "
                                      "the method that passed τ on every summarisation cell",
                                      "Free-form chat was not part of the experiment: quality is not validated"],
                            status="not validated")
        return Decision("M1", [f"Free-form prompt of {n_tok} tokens (< {s['chat_long_tokens']}) or Indic-efficient model: only clean-up"],
                        status="guard")

    row, status = table_row(MODELS[model]["family"], req.lang, req.task, profile, rules)
    if row is None:
        return Decision("M1", [f"No rule for {model} / {req.lang} / {req.task}: only clean-up"], status="guard")
    method = row["method"]
    reasons = [f"Rule table ({profile}): {LANGS[req.lang]['name']} {req.task.upper()} on {MODELS[model]['label']} → {method}"]
    if "saving" in row:
        reasons.append(f"Measured in Run 4 on DeepSeek: {row['saving']:.0f}% ₹ saving, quality {row['retained']:.1%} of the "
                       f"original (95% CI lower bound {row['ci_lo']:.1%})")
    if status == "projected":
        reasons.append(f"For {MODELS[model]['label']} only the tokenizer saving is known (projected {row['glm_saving']:.0f}%); "
                       "answer quality on this model is not yet measured")
    elif status != "measured":
        reasons.append(status)

    if method in PRUNING and st["digit_ratio"] > s["digit_ratio_max"]:
        new = NO_PRUNE[method]
        reasons.append(f"Many digits ({st['digit_ratio']:.1%} of characters): pruning can drop numbers "
                       f"(seen in Run 4: 52.52% → 32%), so {method} → {new}")
        method, status = new, "guard"
    return Decision(method, reasons, evidence=row if "saving" in row else None, status=status)
