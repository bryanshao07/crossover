# backend/tests/test_auth_validation.py
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

import rate_limit
from auth import hash_password
from db import SessionLocal
from db_models import User
from main import app
from routers.auth import LoginRequest, SignupRequest

client = TestClient(app)


@pytest.fixture(autouse=True)
def _clean_limiter_state():
    rate_limit._reset_all()
    rate_limit.limiter.reset()
    yield
    rate_limit._reset_all()
    rate_limit.limiter.reset()


# --- model-level validation (no DB) ---

def test_signup_normalizes_email_case_and_whitespace():
    body = SignupRequest(email="  Bob@Example.COM ", password="a-good-password")
    assert body.email == "bob@example.com"


def test_login_normalizes_email():
    assert LoginRequest(email="USER@X.COM", password="x").email == "user@x.com"


def test_signup_rejects_short_password():
    with pytest.raises(ValidationError):
        SignupRequest(email="a@b.com", password="short")


def test_signup_rejects_overlong_password():
    with pytest.raises(ValidationError):
        SignupRequest(email="a@b.com", password="x" * 73)


def test_signup_rejects_invalid_email():
    with pytest.raises(ValidationError):
        SignupRequest(email="not-an-email", password="a-good-password")


def test_login_allows_any_password_length():
    # existing accounts may have short passwords; login must not reject them
    assert LoginRequest(email="a@b.com", password="short").password == "short"


# --- endpoint-level validation ---

def test_signup_endpoint_rejects_short_password_422():
    r = client.post("/auth/signup", json={"email": "x@y.com", "password": "short"})
    assert r.status_code == 422


def test_signup_endpoint_rejects_bad_email_422():
    r = client.post("/auth/signup", json={"email": "nope", "password": "a-good-password"})
    assert r.status_code == 422


def test_signup_existing_email_returns_generic_message():
    email = "enum-probe@example.com"
    db = SessionLocal()
    try:
        db.query(User).filter(User.email == email).delete()
        db.add(User(email=email, hashed_password=hash_password("a-good-password")))
        db.commit()

        r = client.post("/auth/signup", json={"email": email, "password": "another-good-pw"})
        assert r.status_code == 400
        detail = r.json()["detail"].lower()
        # must not confirm the account exists
        assert "registered" not in detail
        assert "already" not in detail
        assert "exist" not in detail
    finally:
        db.query(User).filter(User.email == email).delete()
        db.commit()
        db.close()
