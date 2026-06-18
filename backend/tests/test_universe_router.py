from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_universe_returns_all_points_with_coords():
    r = client.get("/universe")
    assert r.status_code == 200
    body = r.json()
    assert len(body) == 585
    p = body[0]
    assert {"name", "sport", "position", "x", "y", "z", "dna"} <= set(p)
    assert all(isinstance(p[k], (int, float)) for k in ("x", "y", "z"))
