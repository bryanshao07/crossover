from models import Player, SimilarityMatch, CompareResult


def test_player_round_trip():
    p = Player(
        name="X", sport="basketball", position="PG", dna="d",
        scoring=0.5, playmaking=0.5, defensive_impact=0.5, efficiency=0.5,
        versatility=0.5, physical_dominance=0.5, durability=0.5,
    )
    assert p.model_dump()["name"] == "X"


def test_similarity_match_fields():
    m = SimilarityMatch(name="Y", sport="soccer", position="MF", dna="d",
                        similarity=0.91, quality=0.8)
    assert m.similarity == 0.91


def test_compare_result_holds_stats_dicts():
    c = CompareResult.model_validate({
        "player_a": {"name": "A", "sport": "basketball", "position": "PG", "dna": "d",
                     "scoring": 0.1, "playmaking": 0.1, "defensive_impact": 0.1,
                     "efficiency": 0.1, "versatility": 0.1, "physical_dominance": 0.1,
                     "durability": 0.1},
        "player_b": {"name": "B", "sport": "soccer", "position": "MF", "dna": "d",
                     "scoring": 0.2, "playmaking": 0.2, "defensive_impact": 0.2,
                     "efficiency": 0.2, "versatility": 0.2, "physical_dominance": 0.2,
                     "durability": 0.2},
        "similarity": 0.8, "percentile": 95.0, "context": "top 5%",
        "stats_a": {"PTS_pct": 0.5}, "stats_b": {"Gls_pct": 0.6},
    })
    assert c.percentile == 95.0
