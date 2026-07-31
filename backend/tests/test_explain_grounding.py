from models import Player
from services import gemini


def _player(name, **stats):
    base = dict(
        name=name, sport="basketball", position="SF", dna="Elite Versatility",
        scoring=0.5, playmaking=0.5, defensive_impact=0.5, efficiency=0.5,
        versatility=0.5, physical_dominance=0.5, durability=0.5,
    )
    base.update(stats)
    return Player(**base)


def test_prompt_includes_card_text():
    prompt = gemini.build_prompt(
        _player("A"), _player("B"), 0.9,
        "Relentless transition creator.", "Rim-running vertical threat.",
        None, None,
    )
    assert "Relentless transition creator." in prompt
    assert "Rim-running vertical threat." in prompt


def test_prompt_omits_missing_cards():
    prompt = gemini.build_prompt(_player("A"), _player("B"), 0.9, None, None, None, None)
    assert "Scouting note" not in prompt


def test_prompt_includes_real_stats_and_bold_instruction():
    a = _player("A", pts_per_game=27.4, ast_per_game=8.3, trb_per_game=7.1)
    pct_a = {"Player": "A", "Pos": "SF",
             "AST_pct": 0.93, "PTS_pct": 0.82, "BLK_pct": 0.75, "STL_pct": 0.20}
    prompt = gemini.build_prompt(a, _player("B"), 0.9, None, None, pct_a, None)
    # absolute counting stats surfaced
    assert "27.4 PPG" in prompt
    assert "8.3 APG" in prompt
    # only the top-3 percentiles, rendered as "top X%" (0.93 -> top 7%);
    # the weakest (STL, 0.20 -> top 80%) is dropped
    assert "AST top 7%" in prompt
    assert "PTS top 18%" in prompt
    assert "STL top 80%" not in prompt
    # the model is told to bold every metric
    assert "**double asterisks**" in prompt


def test_parse_bullets_preserves_leading_bold():
    # A bullet that opens with a bolded metric must keep its ** intact.
    parsed = gemini._parse_bullets("- **27.4 PPG** anchors the scoring\n- **12 goals** up top")
    assert parsed[0] == "**27.4 PPG** anchors the scoring"
    assert parsed[1] == "**12 goals** up top"


def test_explain_fallback_without_model(monkeypatch):
    monkeypatch.setattr(gemini, "_model", None, raising=False)
    bullets = gemini.explain(_player("A"), _player("B"), 0.9, "card a", "card b", None, None)
    assert 1 <= len(bullets) <= 6
