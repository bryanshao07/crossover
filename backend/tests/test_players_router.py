# backend/tests/test_players_router.py
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_players_returns_full_index():
    r = client.get("/players")
    assert r.status_code == 200
    assert len(r.json()) == 585
    assert set(r.json()[0]) == {"name", "sport", "position", "dna"}


def test_player_detail_has_player_and_matches():
    r = client.get("/player/Amen Thompson")
    assert r.status_code == 200
    body = r.json()
    assert body["player"]["name"] == "Amen Thompson"
    assert len(body["matches"]) == 10
    assert all(m["sport"] == "soccer" for m in body["matches"])


def test_player_detail_unknown_404():
    assert client.get("/player/Nobody XYZ").status_code == 404


def test_search_filters_by_sport_and_query():
    r = client.get("/search", params={"q": "a", "sport": "soccer"})
    assert r.status_code == 200
    assert all(p["sport"] == "soccer" for p in r.json())
    assert all("a" in p["name"].lower() for p in r.json())


def test_search_filters_by_position():
    r = client.get("/search", params={"position": "PG"})
    assert all(p["position"] == "PG" for p in r.json())
