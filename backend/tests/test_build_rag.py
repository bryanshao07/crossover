import pytest

from scripts import build_rag
from scripts.build_rag import _call_with_retry, _is_rate_limit, card_prompt


def test_card_prompt_includes_stats_and_name():
    p = card_prompt("Amen Thompson", "basketball", "SF",
                    {"PTS": 14.1, "AST": 3.8, "Empty": None})
    assert "Amen Thompson" in p
    assert "PTS=14.1" in p
    assert "AST=3.8" in p
    assert "Empty" not in p           # None values dropped
    assert "3 sentence" in p.lower() or "three sentence" in p.lower()


def test_card_prompt_drops_float_nan():
    p = card_prompt("X", "basketball", "PG", {"PTS": 20.1, "Awards": float("nan")})
    assert "PTS=20.1" in p
    assert "nan" not in p            # neither float NaN nor the literal string
    assert "Awards" not in p


def test_is_rate_limit_detects_429_and_quota():
    assert _is_rate_limit(Exception("429 You exceeded your current quota"))
    assert _is_rate_limit(Exception("RESOURCE_EXHAUSTED: rate limit exceeded"))
    assert not _is_rate_limit(Exception("500 internal error"))


def test_call_with_retry_recovers_after_transient_failures(monkeypatch):
    # Don't actually sleep during the test.
    monkeypatch.setattr(build_rag.time, "sleep", lambda s: None)
    calls = {"n": 0}

    def flaky():
        calls["n"] += 1
        if calls["n"] < 3:
            raise Exception("429 quota exceeded")
        return "ok"

    assert _call_with_retry(flaky, "unit") == "ok"
    assert calls["n"] == 3


def test_call_with_retry_reraises_after_max(monkeypatch):
    monkeypatch.setattr(build_rag.time, "sleep", lambda s: None)

    def always_fail():
        raise Exception("429 quota exceeded")

    with pytest.raises(Exception, match="quota"):
        _call_with_retry(always_fail, "unit")
