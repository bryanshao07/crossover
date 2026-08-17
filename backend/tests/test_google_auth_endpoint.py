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
from db import SessionLocal, get_db
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


def _delete_user(email):
    db = SessionLocal()
    db.query(User).filter(User.email == email).delete()
    db.commit()
    db.close()


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


def test_email_match_with_different_google_identity_is_rejected(monkeypatch):
    # This address already belongs to a DIFFERENT Google identity (e.g. a
    # Workspace account was deleted and recreated, keeping the email but
    # getting a new sub). Rebinding would let identity A silently evict
    # identity B from B's own account, and B could evict A right back on B's
    # next sign-in — two identities fighting over one account indefinitely.
    db = SessionLocal()
    db.add(User(email=EMAIL, hashed_password=None, google_sub="existing-sub-B"))
    db.commit()
    db.close()

    _stub_verify(
        monkeypatch, GoogleIdentity(sub="new-sub-A", email=EMAIL, picture="https://pic")
    )
    r = client.post("/auth/google", json={"credential": "tok"})
    assert r.status_code == 401
    # No enumeration: the generic invalid-token message, not a distinct one.
    assert "already" not in r.json()["detail"].lower()

    db = SessionLocal()
    user = db.query(User).filter(User.email == EMAIL).first()
    # Not rebound: identity B still owns the account.
    assert user.google_sub == "existing-sub-B"
    db.close()


def test_concurrent_first_time_signup_recovers_without_500(monkeypatch):
    # Simulates two simultaneous first-time sign-ins for the same identity: a
    # double-clicked button or a GIS callback retry. Both requests miss the
    # SELECTs above (neither user exists yet) and both try to INSERT; only one
    # wins the unique constraint. This test lets a second, independent session
    # genuinely commit the "winning" row mid-request, so the primary session's
    # own commit hits a real IntegrityError from Postgres — not a fabricated one.
    real_db = SessionLocal()
    original_commit = real_db.commit
    state = {"raised": False}

    def flaky_commit():
        if not state["raised"]:
            state["raised"] = True
            winner = SessionLocal()
            winner.add(User(email=EMAIL, hashed_password=None, google_sub=SUB))
            winner.commit()
            winner.close()
        return original_commit()

    real_db.commit = flaky_commit

    def override_get_db():
        yield real_db

    app.dependency_overrides[get_db] = override_get_db
    try:
        _stub_verify(monkeypatch, GoogleIdentity(sub=SUB, email=EMAIL, picture="https://pic"))
        r = client.post("/auth/google", json={"credential": "tok"})
    finally:
        app.dependency_overrides.pop(get_db, None)
        real_db.close()

    # The loser must recover to a normal 200, not surface the constraint
    # violation as a 500.
    assert r.status_code == 200
    assert r.json()["email"] == EMAIL

    db = SessionLocal()
    assert db.query(User).filter(User.email == EMAIL).count() == 1
    db.close()


def test_concurrent_signup_with_conflicting_email_and_different_sub_is_rejected(monkeypatch):
    # NB1 regression: the winning row of the race belongs to a DIFFERENT
    # Google identity (e.g. identity B already claimed this email moments
    # earlier). Recovering by falling back to email with no ownership check
    # would sign identity A straight into identity B's account — the exact
    # cross-identity takeover the non-race email-link path rejects, reached
    # here through the race window instead. Shaped exactly like
    # test_concurrent_first_time_signup_recovers_without_500 above, except the
    # winning row carries a different sub than the token.
    real_db = SessionLocal()
    original_commit = real_db.commit
    state = {"raised": False}

    def flaky_commit():
        if not state["raised"]:
            state["raised"] = True
            winner = SessionLocal()
            # The race's winner belongs to a different Google identity than
            # the one in this request's token.
            winner.add(User(email=EMAIL, hashed_password=None, google_sub="victim-sub-B"))
            winner.commit()
            winner.close()
        return original_commit()

    real_db.commit = flaky_commit

    def override_get_db():
        yield real_db

    app.dependency_overrides[get_db] = override_get_db
    try:
        # Token belongs to a different ("attacker") identity than the row the
        # race committed.
        _stub_verify(
            monkeypatch, GoogleIdentity(sub="attacker-sub-A", email=EMAIL, picture="https://pic")
        )
        r = client.post("/auth/google", json={"credential": "tok"})
    finally:
        app.dependency_overrides.pop(get_db, None)
        real_db.close()

    assert r.status_code == 401
    # No session must be issued for the rejected takeover attempt.
    assert r.cookies.get("access_token") is None

    db = SessionLocal()
    user = db.query(User).filter(User.email == EMAIL).first()
    # Not hijacked: the victim identity still owns the account.
    assert user.google_sub == "victim-sub-B"
    db.close()


def test_concurrent_signup_links_a_password_account_created_by_the_race(monkeypatch):
    # NB2 regression: the winning row of the race is a plain password signup
    # for the same address (no Google identity attached yet) — the same
    # situation the non-race email-match path links. The recovery path must
    # link it too, rather than signing the caller in while silently leaving
    # google_sub unset (which would skip the link and repeat this same race
    # path on every future Google sign-in for this user).
    real_db = SessionLocal()
    original_commit = real_db.commit
    state = {"raised": False}

    def flaky_commit():
        if not state["raised"]:
            state["raised"] = True
            winner = SessionLocal()
            winner.add(User(email=EMAIL, hashed_password=hash_password("a-good-password")))
            winner.commit()
            winner.close()
        return original_commit()

    real_db.commit = flaky_commit

    def override_get_db():
        yield real_db

    app.dependency_overrides[get_db] = override_get_db
    try:
        _stub_verify(monkeypatch, GoogleIdentity(sub=SUB, email=EMAIL, picture="https://pic"))
        r = client.post("/auth/google", json={"credential": "tok"})
    finally:
        app.dependency_overrides.pop(get_db, None)
        real_db.close()

    assert r.status_code == 200
    assert r.cookies.get("access_token")

    db = SessionLocal()
    user = db.query(User).filter(User.email == EMAIL).first()
    # Linked, not left dangling: the race-created password account now has the
    # Google identity attached, exactly as the non-race path would do.
    assert user.google_sub == SUB
    # The password from the race-winning signup must survive the link.
    assert user.hashed_password is not None
    db.close()


def test_sub_match_wins_over_a_different_users_email(monkeypatch):
    # User A already owns SUB (and address EMAIL). User B owns a different,
    # unrelated address that happens to match the incoming token's email claim.
    # Sub is the durable identifier and must be checked first: resolving by
    # email first would sign the caller into B's account instead of A's.
    other_email = "other-account@example.com"
    _delete_user(other_email)
    db = SessionLocal()
    db.add(User(email=EMAIL, hashed_password=None, google_sub=SUB))
    other = User(email=other_email, hashed_password=hash_password("their-password"))
    db.add(other)
    db.commit()
    other_id = other.id
    other_hash = other.hashed_password
    db.close()

    try:
        # Token carries A's sub but B's email.
        _stub_verify(monkeypatch, GoogleIdentity(sub=SUB, email=other_email, picture=None))
        r = client.post("/auth/google", json={"credential": "tok"})
        assert r.status_code == 200

        db = SessionLocal()
        user_a = db.query(User).filter(User.google_sub == SUB).first()
        assert r.json()["id"] == user_a.id
        assert r.json()["email"] == EMAIL

        # B's row must be completely untouched — no rebind, no field changes.
        user_b = db.get(User, other_id)
        assert user_b.google_sub is None
        assert user_b.hashed_password == other_hash
        assert user_b.avatar_url is None
        db.close()
    finally:
        _delete_user(other_email)


def test_verifier_receives_the_posted_credential_and_configured_audience(monkeypatch):
    # The audience check inside verify_google_id_token is the ONLY thing that
    # stops a token minted for a different Google app from being replayed
    # against CrossOver. Pin both arguments the route passes through.
    received = {}

    def fake(credential, client_id):
        received["credential"] = credential
        received["client_id"] = client_id
        return GoogleIdentity(sub=SUB, email=EMAIL, picture="https://pic")

    monkeypatch.setattr(auth_router, "verify_google_id_token", fake)

    sent_credential = "the-exact-jwt-the-client-posted"
    r = client.post("/auth/google", json={"credential": sent_credential})
    assert r.status_code == 200
    assert received["credential"] == sent_credential
    assert received["client_id"] == settings.google_client_id


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
    assert r.status_code == 401
    detail = r.json()["detail"].lower()
    # No enumeration: must not reveal the account exists or uses Google.
    assert "google" not in detail


def test_password_login_on_passwordless_account_never_calls_verify_password(monkeypatch):
    # Asserts the short-circuit itself, not just the outward status code: the
    # installed passlib (1.7.4) happens to return False rather than raise for a
    # None hash, so a status-code-only assertion passes even with the guard
    # removed. Failing loudly if verify_password is reached at all is what
    # actually pins the guard's behavior.
    db = SessionLocal()
    db.add(User(email=EMAIL, hashed_password=None, google_sub=SUB))
    db.commit()
    db.close()

    def boom(*args, **kwargs):
        raise AssertionError("verify_password must not be called for a passwordless account")

    monkeypatch.setattr(auth_router, "verify_password", boom)

    r = client.post("/auth/login", json={"email": EMAIL, "password": "any-password"})
    assert r.status_code == 401
