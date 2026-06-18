# backend/tests/test_app_smoke.py
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["players"] == 585


def test_all_endpoints_reachable():
    assert client.get("/players").status_code == 200
    assert client.get("/universe").status_code == 200
    name = client.get("/players").json()[0]["name"]
    assert client.get(f"/player/{name}").status_code == 200
