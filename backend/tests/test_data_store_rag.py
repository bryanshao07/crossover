import numpy as np
import data_store as ds


def test_style_card_accessor(monkeypatch):
    monkeypatch.setattr(ds, "_cards", {"Amen Thompson": "Explosive two-way wing."}, raising=False)
    assert ds.style_card("Amen Thompson") == "Explosive two-way wing."
    assert ds.style_card("Nobody XYZ") is None


def test_embedding_matrix_normalized(monkeypatch):
    mat = np.array([[3.0, 4.0], [0.0, 2.0]])  # norms 5 and 2
    monkeypatch.setattr(ds, "_emb_matrix", None, raising=False)
    monkeypatch.setattr(ds, "_emb_names", [], raising=False)
    ds._set_embeddings({"A": mat[0].tolist(), "B": mat[1].tolist()})
    out = ds.embedding_matrix()
    assert out is not None
    np.testing.assert_allclose(np.linalg.norm(out, axis=1), [1.0, 1.0], rtol=1e-6)
    assert ds.embedding_names() == ["A", "B"]


def test_missing_embeddings_is_graceful(monkeypatch):
    monkeypatch.setattr(ds, "_emb_matrix", None, raising=False)
    monkeypatch.setattr(ds, "_emb_names", [], raising=False)
    assert ds.embedding_matrix() is None
    assert ds.embedding_names() == []
