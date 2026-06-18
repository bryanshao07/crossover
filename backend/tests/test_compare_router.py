# backend/tests/test_compare_router.py
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_compare_known_pair_structure():
    # pick player_b as the top soccer match of player_a to guarantee existence
    detail = client.get("/player/Amen Thompson").json()
    b = detail["matches"][0]["name"]
    r = client.get(f"/compare/Amen Thompson/{b}")
    assert r.status_code == 200
    body = r.json()
    assert body["player_a"]["name"] == "Amen Thompson"
    assert body["player_b"]["name"] == b
    assert 0.0 < body["similarity"] <= 1.0
    assert 0.0 <= body["percentile"] <= 100.0
    assert isinstance(body["context"], str) and body["context"]
    assert body["stats_a"] and body["stats_b"]


def test_compare_unknown_404():
    assert client.get("/compare/Amen Thompson/Nobody XYZ").status_code == 404
    assert client.get("/compare/Nobody XYZ/Amen Thompson").status_code == 404
