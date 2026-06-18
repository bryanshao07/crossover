from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_explain_returns_bullets_without_api_key(monkeypatch):
    # ensure fallback path: no key configured during tests
    from services import gemini
    monkeypatch.setattr(gemini, "_model", None, raising=False)
    detail = client.get("/player/Amen Thompson").json()
    b = detail["matches"][0]["name"]
    r = client.get(f"/explain/Amen Thompson/{b}")
    assert r.status_code == 200
    bullets = r.json()["bullets"]
    assert 1 <= len(bullets) <= 6
    assert all(isinstance(x, str) and x for x in bullets)


def test_explain_unknown_404():
    assert client.get("/explain/Amen Thompson/Nobody XYZ").status_code == 404
    assert client.get("/explain/Nobody XYZ/Amen Thompson").status_code == 404
