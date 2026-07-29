from models import Player
from services import gemini


def _player(name):
    return Player(
        name=name, sport="basketball", position="SF", dna="Elite Versatility",
        scoring=0.5, playmaking=0.5, defensive_impact=0.5, efficiency=0.5,
        versatility=0.5, physical_dominance=0.5, durability=0.5,
    )


def test_prompt_includes_card_text():
    prompt = gemini.build_prompt(
        _player("A"), _player("B"), 0.9,
        "Relentless transition creator.", "Rim-running vertical threat.",
    )
    assert "Relentless transition creator." in prompt
    assert "Rim-running vertical threat." in prompt


def test_prompt_omits_missing_cards():
    prompt = gemini.build_prompt(_player("A"), _player("B"), 0.9, None, None)
    assert "Scouting note" not in prompt


def test_explain_fallback_without_model(monkeypatch):
    monkeypatch.setattr(gemini, "_model", None, raising=False)
    bullets = gemini.explain(_player("A"), _player("B"), 0.9, "card a", "card b")
    assert 1 <= len(bullets) <= 6
