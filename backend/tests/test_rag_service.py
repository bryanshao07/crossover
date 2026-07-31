import numpy as np
import data_store as ds
from services import rag


def _fixture(monkeypatch):
    # Three orthogonal-ish vectors; query aligns with "A".
    raw = {
        "Scorer A": [1.0, 0.0, 0.0],
        "Passer B": [0.0, 1.0, 0.0],
        "Wall C":   [0.0, 0.0, 1.0],
    }
    monkeypatch.setattr(ds, "_emb_matrix", None, raising=False)
    monkeypatch.setattr(ds, "_emb_names", [], raising=False)
    ds._set_embeddings(raw)
    monkeypatch.setattr(ds, "_index_by_name", {
        "Scorer A": {"name": "Scorer A", "sport": "basketball", "position": "SG", "dna": ""},
        "Passer B": {"name": "Passer B", "sport": "soccer", "position": "MF", "dna": ""},
        "Wall C":   {"name": "Wall C", "sport": "basketball", "position": "C", "dna": ""},
    }, raising=False)


def test_ranks_by_cosine(monkeypatch):
    _fixture(monkeypatch)
    monkeypatch.setattr(rag, "embed_query", lambda t: [0.9, 0.1, 0.0])
    assert rag.semantic_search("elite scorer", None, None, 3)[0] == "Scorer A"


def test_sport_filter(monkeypatch):
    _fixture(monkeypatch)
    monkeypatch.setattr(rag, "embed_query", lambda t: [0.9, 0.1, 0.0])
    res = rag.semantic_search("elite scorer", "soccer", None, 3)
    assert res == ["Passer B"]


def test_none_when_no_embeddings(monkeypatch):
    monkeypatch.setattr(ds, "_emb_matrix", None, raising=False)
    monkeypatch.setattr(ds, "_emb_names", [], raising=False)
    assert rag.semantic_search("anything", None, None, 5) is None


def test_none_when_query_embed_fails(monkeypatch):
    _fixture(monkeypatch)
    monkeypatch.setattr(rag, "embed_query", lambda t: None)
    assert rag.semantic_search("anything", None, None, 5) is None
