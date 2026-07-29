from scripts.build_rag import card_prompt


def test_card_prompt_includes_stats_and_name():
    p = card_prompt("Amen Thompson", "basketball", "SF",
                    {"PTS": 14.1, "AST": 3.8, "Empty": None})
    assert "Amen Thompson" in p
    assert "PTS=14.1" in p
    assert "AST=3.8" in p
    assert "Empty" not in p           # None values dropped
    assert "3 sentence" in p.lower() or "three sentence" in p.lower()
