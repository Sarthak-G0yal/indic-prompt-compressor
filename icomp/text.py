"""Text utilities: M1 normalisation, splitting, language detection, romanisation, simple text statistics."""
from __future__ import annotations

import re
import unicodedata

_ZW = dict.fromkeys(map(ord, "​‌‍⁠﻿­"), None)
_SENT = re.compile(r"(?<=[.!?।॥])\s+")
_CITE = re.compile(r"\[\s*\d+\s*\]")

# Unicode blocks -> language code
_SCRIPTS = {"hi": (0x0900, 0x097F), "kn": (0x0C80, 0x0CFF), "ta": (0x0B80, 0x0BFF)}


def split_sents(text: str) -> list[str]:
    return [s.strip() for s in _SENT.split(text) if s.strip()]


def m1_normalize(text: str) -> str:
    """Same as the experiment: NFC, zero-width chars, wiki citation marks, whitespace, duplicate sentences.
    Unlike the notebook, line breaks are kept (chat prompts and lists rely on them)."""
    t = unicodedata.normalize("NFC", text or "").translate(_ZW)
    t = _CITE.sub("", t)
    t = re.sub(r"[ \t ]+", " ", t)
    t = re.sub(r" *\n[ \n]*", "\n", t).strip()
    seen, lines = set(), []
    for line in t.split("\n"):
        out = []
        for s in split_sents(line):
            key = re.sub(r"\W+", "", s)
            if key and key in seen:
                continue
            seen.add(key)
            out.append(s)
        if out:
            lines.append(" ".join(out))
    return "\n".join(lines)


def script_counts(text: str) -> dict[str, int]:
    c = {k: 0 for k in _SCRIPTS} | {"latin": 0, "digit": 0, "other": 0}
    for ch in text:
        o = ord(ch)
        if ch.isdigit():
            c["digit"] += 1
        elif ("a" <= ch.lower() <= "z"):
            c["latin"] += 1
        elif ch.isalpha() or unicodedata.category(ch).startswith("M"):
            for k, (lo, hi) in _SCRIPTS.items():
                if lo <= o <= hi:
                    c[k] += 1
                    break
            else:
                c["other"] += 1
    return c


def detect_lang(text: str) -> tuple[str, float]:
    """Return (language code or 'en'/'unknown', share of letters in that script)."""
    c = script_counts(text)
    letters = sum(c[k] for k in _SCRIPTS) + c["latin"] + c["other"]
    if letters == 0:
        return "unknown", 0.0
    best = max(_SCRIPTS, key=lambda k: c[k])
    if c[best] >= c["latin"] and c[best] > 0:
        return best, c[best] / letters
    if c["latin"] / letters > 0.5:
        return "en", c["latin"] / letters
    return "unknown", 0.0


def stats(text: str) -> dict:
    c = script_counts(text)
    n = max(len(text), 1)
    letters = max(sum(v for k, v in c.items() if k != "digit"), 1)
    return dict(chars=len(text), digit_ratio=c["digit"] / n, latin_ratio=c["latin"] / letters,
                looks_like_code=bool(re.search(r"```|[{};]\s*\n|\bdef |\bfunction\b|</?\w+>", text)))


def romanize(text: str, lang: str) -> str:
    from indic_transliteration import sanscript
    from indic_transliteration.sanscript import transliterate
    scheme = {"hi": sanscript.DEVANAGARI, "kn": sanscript.KANNADA, "ta": sanscript.TAMIL}[lang]
    return transliterate(text, scheme, sanscript.ITRANS)


ABSTAIN = re.compile(r"not (mentioned|stated|specified|given|provided)|does not (say|mention|specify|state)|"
                     r"no information|cannot be determined|isn't mentioned|is not mentioned", re.I)
