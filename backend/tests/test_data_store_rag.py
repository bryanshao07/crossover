import json

import numpy as np
import data_store as ds
from config import settings


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


def test_set_embeddings_rejects_ragged_without_crashing_load():
    # A ragged embeddings dict makes np.asarray(dtype=float) raise ValueError.
    # load() must swallow that and leave embeddings empty. Simulate the load()
    # except path directly:
    raised = False
    try:
        ds._set_embeddings({"A": [1.0, 2.0], "B": [1.0]})  # ragged -> ValueError
    except ValueError:
        raised = True
    assert raised  # confirms the risk is real
    # and the load() path handles it: emulate the except branch
    ds._set_embeddings({})
    assert ds.embedding_matrix() is None
    assert ds.embedding_names() == []


def _write_minimal_exports(export_dir):
    """Write the minimal set of export files load() needs, so load() can run
    end-to-end against a throwaway exports_dir in a hermetic test."""
    (export_dir / "player_index.json").write_text(json.dumps([
        {"player": "Test Player", "sport": "basketball", "position": "PG", "dna": "Test DNA"}
    ]))
    (export_dir / "player_vectors.json").write_text(json.dumps({
        "Test Player": {"scoring": 0.5, "sport": "basketball"}
    }))
    (export_dir / "umap_players.json").write_text(json.dumps([
        {"player": "Test Player", "sport": "basketball", "position": "PG",
         "x": 0.0, "y": 0.0, "z": 0.0, "dominant_attr": None, "dna": "Test DNA"}
    ]))
    (export_dir / "quality_scores.json").write_text(json.dumps([
        {"player": "Test Player", "quality": 0.5}
    ]))
    (export_dir / "nba_pct.json").write_text(json.dumps([
        {"Player": "Test Player", "Pos": "PG", "PTS_pct": 0.5}
    ]))
    (export_dir / "soccer_pct.json").write_text(json.dumps([]))
    (export_dir / "sim_matrix.csv").write_text("Player,Test Player\nTest Player,1.0\n")
    (export_dir / "nba-stats.csv").write_text("Player\nTest Player\n")
    (export_dir / "soccer-stats.csv").write_text("Player\nTest Player\n")
    (export_dir / "nba_id_map.json").write_text("{}")
    (export_dir / "pl_id_map.json").write_text("{}")


def test_load_survives_malformed_rag_artifacts(tmp_path, monkeypatch):
    """End-to-end: load() must not crash the whole API when style_cards.json is
    truncated JSON and style_embeddings.json is well-formed-but-ragged JSON --
    both realistic outcomes of a non-atomic build script checkpointing mid-run.
    """
    _write_minimal_exports(tmp_path)
    # Truncated / corrupt JSON -> json.JSONDecodeError
    (tmp_path / "style_cards.json").write_text('{"Test Player": "Explosive scorer')
    # Well-formed JSON but ragged rows -> np.asarray(dtype=float) ValueError
    (tmp_path / "style_embeddings.json").write_text(
        json.dumps({"A": [1.0, 2.0], "B": [1.0]})
    )

    monkeypatch.setattr(settings, "exports_dir", str(tmp_path))
    # Reset every module-level global load() writes to, so this test can't
    # leak fixture data into (or clobber real data used by) other tests --
    # monkeypatch restores each to its pre-test value on teardown regardless
    # of what load() assigns to it in between.
    for attr, empty in [
        ("_index", []), ("_index_by_name", {}), ("_vectors", {}), ("_umap", []),
        ("_quality", {}), ("_pct", {}), ("_sim", None), ("_nba_stats", {}),
        ("_soccer_stats", {}), ("_nba_id_map", {}), ("_pl_id_map", {}),
        ("_cards", {}), ("_emb_names", []), ("_emb_matrix", None),
        ("_loaded", False),
    ]:
        monkeypatch.setattr(ds, attr, empty, raising=False)

    ds.load()  # must not raise

    assert ds._loaded is True
    assert ds.style_card("Test Player") is None  # malformed cards -> {}
    assert ds.embedding_matrix() is None
    assert ds.embedding_names() == []
    # everything else still loaded normally
    assert ds.get_player("Test Player") is not None
