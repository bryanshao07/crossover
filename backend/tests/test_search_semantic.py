from fastapi.testclient import TestClient

from main import app
from routers import players as players_router

client = TestClient(app)


def test_semantic_falls_back_to_keyword_when_unavailable(monkeypatch):
    # rag unavailable -> None -> substring path still returns Amen Thompson
    monkeypatch.setattr(players_router.rag, "semantic_search", lambda *a, **k: None)
    r = client.get("/search", params={"q": "Amen", "mode": "semantic"})
    assert r.status_code == 200
    assert any(row["name"] == "Amen Thompson" for row in r.json())


def test_semantic_returns_ranked_rows(monkeypatch):
    import data_store as ds
    real = [p["name"] for p in ds.players()][:2]
    monkeypatch.setattr(players_router.rag, "semantic_search", lambda *a, **k: real)
    r = client.get("/search", params={"q": "playmaker", "mode": "semantic"})
    body = r.json()
    assert [row["name"] for row in body] == real
    assert "scoring" in body[0]  # _with_attributes shape preserved


def test_keyword_mode_unchanged():
    r = client.get("/search", params={"q": "Amen"})
    assert r.status_code == 200
    assert any(row["name"] == "Amen Thompson" for row in r.json())
