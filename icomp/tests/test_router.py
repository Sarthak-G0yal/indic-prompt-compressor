"""Router and text tests: no GPU, no API.   Run: uv run pytest icomp/tests -q"""
from icomp.methods import Request
from icomp.router import RULES, route, table_row
from icomp.text import detect_lang, m1_normalize, stats

HI = ("भारत की राजधानी नई दिल्ली है। यह देश का राजनीतिक और प्रशासनिक केंद्र है। "
      "यहाँ संसद, राष्ट्रपति भवन और कई मंत्रालय स्थित हैं। ") * 6
DS = "deepseekv4.1-flash-1017"


def test_detect_lang():
    assert detect_lang("भारत की राजधानी")[0] == "hi"
    assert detect_lang("ಬೆಂಗಳೂರು ಕರ್ನಾಟಕದ ರಾಜಧಾನಿ")[0] == "kn"
    assert detect_lang("சென்னை தமிழ்நாட்டின் தலைநகரம்")[0] == "ta"
    assert detect_lang("hello world")[0] == "en"


def test_m1_normalize():
    t = m1_normalize("यह   एक वाक्य है।[1]  यह   एक वाक्य है। दूसरा‌ वाक्य।")
    assert t == "यह एक वाक्य है। दूसरा वाक्य।"
    assert "\n" in m1_normalize("पहली पंक्ति।\nदूसरी पंक्ति।")


def test_table_lookup_matches_run4():
    assert table_row("deepseek", "hi", "qa", "balanced")[0]["method"] == "M5"
    assert table_row("deepseek", "ta", "qa", "balanced")[0]["method"] == "M2_80"
    assert table_row("deepseek", "kn", "summ", "safe")[0]["method"] == "M3_b5"
    row, status = table_row("glm", "kn", "qa", "balanced")
    assert row["method"] == "M5_80" and status == "projected"
    assert table_row("indic_efficient", "hi", "qa", "balanced")[0]["method"] == "M1"


def test_route_rules_and_guards():
    long_q = Request("qa", "hi", context=HI, question="भारत की राजधानी क्या है?")
    assert route(long_q, DS).method == "M5"
    assert route(long_q, DS, "safe").method == "M5"
    short = Request("qa", "hi", context="भारत की राजधानी नई दिल्ली है।", question="राजधानी?")
    assert route(short, DS).method == "M1"
    digits = Request("summ", "hi", context=HI + " 12.5% 33.3% 1998 2004 45 67 89 1200 3400 5600 7800 " * 6)
    d = route(digits, DS)
    assert d.method == "M3" and d.status == "guard"       # M5_80 -> M3 because of digits
    code = Request("chat", "hi", prompt="इस कोड को ठीक करो:\n```python\ndef f(x):\n    return x+1\n```")
    assert route(code, DS).method == "M1"
    assert route(long_q, DS, override="M3h").method == "M3h"
    assert route(Request("qa", "en", context="x " * 300, question="y"), DS).method == "M1"


def test_settings_present():
    for k in ("min_tokens", "min_saving", "digit_ratio_max", "latin_ratio_max", "chat_long_tokens", "abstain_fallback"):
        assert k in RULES["settings"]
    assert stats("abc 123")["digit_ratio"] > 0
