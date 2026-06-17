import data_store as ds
from services import similarity


def setup_module(_):
    ds.load()
    similarity.build_pair_distribution()


def test_top_matches_are_opposite_sport():
    matches = similarity.top_matches("Amen Thompson", limit=10)
    assert len(matches) == 10
    assert all(m.sport == "soccer" for m in matches)
    # sorted descending by similarity
    sims = [m.similarity for m in matches]
    assert sims == sorted(sims, reverse=True)


def test_top_matches_exclude_self_and_same_sport():
    matches = similarity.top_matches("Amen Thompson", limit=585)
    names = {m.name for m in matches}
    assert "Amen Thompson" not in names


def test_percentile_monotonic():
    lo = similarity.percentile_for(0.0)
    hi = similarity.percentile_for(0.999)
    assert 0.0 <= lo <= hi <= 100.0


def test_context_label_is_string():
    assert isinstance(similarity.context_label(96.0), str)
