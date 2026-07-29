from scripts.build_rag import card_prompt


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
