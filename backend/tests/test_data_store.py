import math
import data_store as ds


def setup_module(_):
    ds.load()


def test_players_normalized_to_name():
    players = ds.players()
    assert len(players) == 585
    row = players[0]
    assert set(row) == {"name", "sport", "position", "dna"}
    assert "player" not in row


def test_vector_has_seven_attrs_in_range():
    v = ds.vector("Amen Thompson")
    for attr in ds.ATTRS:
        assert 0.0 <= v[attr] <= 1.0
    assert v["sport"] == "basketball"


def test_sim_row_self_is_one():
    row = ds.sim_row("Amen Thompson")
    assert math.isclose(row["Amen Thompson"], 1.0, abs_tol=1e-6)


def test_pct_stats_excludes_label_columns():
    stats = ds.pct_stats("Amen Thompson", "basketball")
    assert "Player" not in stats and "Pos" not in stats
    assert all(k.endswith("_pct") for k in stats)


def test_unknown_player_returns_none():
    assert ds.get_player("Nobody XYZ") is None
    assert ds.vector("Nobody XYZ") is None
    assert ds.sim_row("Nobody XYZ") is None
