# backend/tests/test_google_auth_endpoint.py
"""Endpoint behavior for Google sign-in. Requires Postgres on localhost:5432.

Token verification itself is stubbed here (it is covered in
tests/test_google_oauth_verify.py); these tests cover user resolution,
linking, and the no-enumeration posture.
"""
import pytest
from fastapi.testclient import TestClient

import rate_limit
import routers.auth as auth_router
from auth import hash_password
from config import settings
from db import SessionLocal
from db_models import User
from main import app
from services.google_oauth import GoogleIdentity, GoogleOAuthUnavailable, InvalidGoogleToken

client = TestClient(app)

EMAIL = "google-test@example.com"
SUB = "google-sub-12345"


@pytest.fixture(autouse=True)
def _clean_state(monkeypatch):
    rate_limit._reset_all()
    rate_limit.limiter.reset()
    monkeypatch.setattr(settings, "google_client_id", "test-client-id")
    db = SessionLocal()
    db.query(User).filter(User.email == EMAIL).delete()
    db.commit()
    db.close()
    yield
    db = SessionLocal()
    db.query(User).filter(User.email == EMAIL).delete()
    db.commit()
    db.close()
    rate_limit._reset_all()
    rate_limit.limiter.reset()


def _stub_verify(monkeypatch, identity=None, raises=None):
    def fake(credential, client_id):
        if raises is not None:
            raise raises
        return identity

    monkeypatch.setattr(auth_router, "verify_google_id_token", fake)


def test_creates_new_user_with_sub_and_avatar(monkeypatch):
    _stub_verify(monkeypatch, GoogleIdentity(sub=SUB, email=EMAIL, picture="https://pic"))
    r = client.post("/auth/google", json={"credential": "tok"})
    assert r.status_code == 200
    assert r.json()["email"] == EMAIL
    assert r.json()["avatar_url"] == "https://pic"
    assert r.cookies.get("access_token")

    db = SessionLocal()
    user = db.query(User).filter(User.email == EMAIL).first()
    assert user.google_sub == SUB
    assert user.hashed_password is None
    db.close()


def test_links_to_existing_password_account_by_email(monkeypatch):
    db = SessionLocal()
    existing = User(email=EMAIL, hashed_password=hash_password("a-good-password"))
    db.add(existing)
    db.commit()
    existing_id = existing.id
    existing_hash = existing.hashed_password
    db.close()

    _stub_verify(monkeypatch, GoogleIdentity(sub=SUB, email=EMAIL, picture="https://pic"))
    r = client.post("/auth/google", json={"credential": "tok"})
    assert r.status_code == 200
    # Same account — favorites and saved comparisons must survive linking.
    assert r.json()["id"] == existing_id

    db = SessionLocal()
    user = db.get(User, existing_id)
    assert user.google_sub == SUB
    # Password login must keep working after linking.
    assert user.hashed_password == existing_hash
    db.close()

    assert client.post(
        "/auth/login", json={"email": EMAIL, "password": "a-good-password"}
    ).status_code == 200


def test_linking_does_not_overwrite_a_chosen_avatar(monkeypatch):
    db = SessionLocal()
    db.add(User(email=EMAIL, hashed_password=hash_password("a-good-password"),
                avatar_url="/static/avatars/mine.png"))
    db.commit()
    db.close()

    _stub_verify(monkeypatch, GoogleIdentity(sub=SUB, email=EMAIL, picture="https://pic"))
    r = client.post("/auth/google", json={"credential": "tok"})
    assert r.json()["avatar_url"] == "/static/avatars/mine.png"


def test_matches_by_sub_when_email_changed(monkeypatch):
    db = SessionLocal()
    db.add(User(email=EMAIL, hashed_password=None, google_sub=SUB))
    db.commit()
    db.close()

    _stub_verify(
        monkeypatch, GoogleIdentity(sub=SUB, email="new-address@example.com", picture=None)
    )
    r = client.post("/auth/google", json={"credential": "tok"})
    assert r.status_code == 200
    # Matched on the durable subject id, not the changed email.
    assert r.json()["email"] == EMAIL


def test_rejects_invalid_token(monkeypatch):
    _stub_verify(monkeypatch, raises=InvalidGoogleToken("bad"))
    r = client.post("/auth/google", json={"credential": "tok"})
    assert r.status_code == 401
    # Must not echo the internal reason back to the caller.
    assert "bad" not in r.json()["detail"].lower()


def test_returns_503_when_not_configured(monkeypatch):
    monkeypatch.setattr(settings, "google_client_id", None)
    r = client.post("/auth/google", json={"credential": "tok"})
    assert r.status_code == 503


def test_returns_503_when_google_unavailable_distinct_from_401(monkeypatch):
    # A JWKS outage is not the user's fault and must not look like a rejected
    # (forged/expired) credential. If this ever returned 401, a Google-side
    # blip would be indistinguishable from mass credential forgery.
    _stub_verify(monkeypatch, raises=GoogleOAuthUnavailable("Could not reach Google's key service"))
    r = client.post("/auth/google", json={"credential": "tok"})
    assert r.status_code == 503
    assert r.status_code != 401
    # Must not echo the internal reason back to the caller.
    assert "key service" not in r.json()["detail"].lower()


def test_password_login_on_passwordless_account_is_generic_401():
    db = SessionLocal()
    db.add(User(email=EMAIL, hashed_password=None, google_sub=SUB))
    db.commit()
    db.close()

    r = client.post("/auth/login", json={"email": EMAIL, "password": "any-password"})
    # 401 not 500: verify_password must never see a None hash.
    assert r.status_code == 401
    detail = r.json()["detail"].lower()
    # No enumeration: must not reveal the account exists or uses Google.
    assert "google" not in detail
