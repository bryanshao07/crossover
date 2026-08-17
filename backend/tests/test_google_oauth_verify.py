# backend/tests/test_google_oauth_verify.py
"""Verification is the security boundary for Google sign-in.

These tests never touch the network or the database: the JWKS lookup and the
signature check are stubbed, and each test asserts one claim-level rule.
"""
import jwt
import pytest

from services import google_oauth
from services.google_oauth import InvalidGoogleToken, verify_google_id_token

CLIENT_ID = "test-client-id.apps.googleusercontent.com"

VALID_CLAIMS = {
    "iss": "https://accounts.google.com",
    "aud": CLIENT_ID,
    "sub": "1234567890",
    "email": "Bob@Example.COM",
    "email_verified": True,
    "picture": "https://lh3.googleusercontent.com/a/pic",
}


@pytest.fixture
def stub_decode(monkeypatch):
    """Replace signature verification with a controllable claim source."""

    def _install(claims, raises=None):
        def fake_signing_key(credential):
            return type("Key", (), {"key": "stub-key"})()

        def fake_decode(credential, key, **kwargs):
            if raises is not None:
                raise raises
            # Honor the audience check the real decode would perform.
            expected = kwargs.get("audience")
            if expected is not None and claims.get("aud") != expected:
                raise jwt.InvalidAudienceError("aud mismatch")
            return claims

        monkeypatch.setattr(
            google_oauth._jwks_client, "get_signing_key_from_jwt", fake_signing_key
        )
        monkeypatch.setattr(google_oauth.jwt, "decode", fake_decode)

    return _install


def test_returns_identity_for_valid_token(stub_decode):
    stub_decode(VALID_CLAIMS)
    identity = verify_google_id_token("tok", CLIENT_ID)
    assert identity.sub == "1234567890"
    assert identity.picture == "https://lh3.googleusercontent.com/a/pic"


def test_normalizes_email_case_and_whitespace(stub_decode):
    stub_decode({**VALID_CLAIMS, "email": "  Bob@Example.COM "})
    assert verify_google_id_token("tok", CLIENT_ID).email == "bob@example.com"


def test_rejects_unverified_email(stub_decode):
    # The linking-safety rule: an unverified address must never match an
    # existing CrossOver account.
    stub_decode({**VALID_CLAIMS, "email_verified": False})
    with pytest.raises(InvalidGoogleToken):
        verify_google_id_token("tok", CLIENT_ID)


def test_rejects_missing_email_verified_claim(stub_decode):
    claims = {k: v for k, v in VALID_CLAIMS.items() if k != "email_verified"}
    stub_decode(claims)
    with pytest.raises(InvalidGoogleToken):
        verify_google_id_token("tok", CLIENT_ID)


def test_rejects_foreign_audience(stub_decode):
    # A token minted for a different Google app must not authenticate here.
    stub_decode({**VALID_CLAIMS, "aud": "someone-else.apps.googleusercontent.com"})
    with pytest.raises(InvalidGoogleToken):
        verify_google_id_token("tok", CLIENT_ID)


def test_rejects_wrong_issuer(stub_decode):
    stub_decode({**VALID_CLAIMS, "iss": "https://evil.example.com"})
    with pytest.raises(InvalidGoogleToken):
        verify_google_id_token("tok", CLIENT_ID)


def test_accepts_bare_accounts_google_com_issuer(stub_decode):
    # Google emits this spelling too; rejecting it would break real sign-ins.
    stub_decode({**VALID_CLAIMS, "iss": "accounts.google.com"})
    assert verify_google_id_token("tok", CLIENT_ID).sub == "1234567890"


def test_rejects_expired_token(stub_decode):
    stub_decode(VALID_CLAIMS, raises=jwt.ExpiredSignatureError("expired"))
    with pytest.raises(InvalidGoogleToken):
        verify_google_id_token("tok", CLIENT_ID)


def test_rejects_bad_signature(stub_decode):
    stub_decode(VALID_CLAIMS, raises=jwt.InvalidSignatureError("bad sig"))
    with pytest.raises(InvalidGoogleToken):
        verify_google_id_token("tok", CLIENT_ID)


def test_rejects_token_without_sub(stub_decode):
    claims = {k: v for k, v in VALID_CLAIMS.items() if k != "sub"}
    stub_decode(claims)
    with pytest.raises(InvalidGoogleToken):
        verify_google_id_token("tok", CLIENT_ID)


def test_jwks_url_points_at_google():
    # Every test above replaces `get_signing_key_from_jwt` outright, so none
    # of them ever exercise `_JWKS_URL` — a wrong endpoint would go
    # undetected without pinning the literal value directly.
    assert google_oauth._JWKS_URL == "https://www.googleapis.com/oauth2/v3/certs"


def test_raises_distinct_error_when_jwks_endpoint_unreachable(monkeypatch):
    # A network/outage failure is not evidence of forgery. The route needs a
    # different exception here so it can return 503 instead of the 401 an
    # actually-invalid token gets.
    def fake_signing_key(credential):
        raise jwt.PyJWKClientConnectionError("connection refused")

    monkeypatch.setattr(
        google_oauth._jwks_client, "get_signing_key_from_jwt", fake_signing_key
    )
    with pytest.raises(google_oauth.GoogleOAuthUnavailable):
        verify_google_id_token("tok", CLIENT_ID)


def test_does_not_swallow_unrelated_bugs_as_invalid_token(monkeypatch):
    # A bare `except Exception` would misreport a genuine bug (e.g. a caller
    # passing the wrong type somewhere upstream) as "invalid token". Only
    # PyJWT's own error family should be treated as a rejected credential.
    def fake_signing_key(credential):
        raise TypeError("boom")

    monkeypatch.setattr(
        google_oauth._jwks_client, "get_signing_key_from_jwt", fake_signing_key
    )
    with pytest.raises(TypeError):
        verify_google_id_token("tok", CLIENT_ID)
