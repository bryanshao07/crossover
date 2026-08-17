# backend/tests/test_google_oauth_real_crypto.py
"""Companion to test_google_oauth_verify.py: exercise the REAL PyJWT verifier.

test_google_oauth_verify.py stubs `jwt.decode` wholesale, so it can prove
claim-level rules (issuer spelling, email_verified gate, ...) but proves
nothing about what PyJWT itself enforces — a mutation that disables signature
verification, drops the exp requirement, or widens the allowed algorithms
list is invisible to it.

These tests stub only the JWKS network lookup
(`google_oauth._jwks_client.get_signing_key_from_jwt`), returning a key from
an RSA pair generated locally with `cryptography`. The real `jwt.decode` runs
against that key, so every adversarial case here is a genuine cryptographic
check, not a mocked outcome, while still making no network call.
"""
import time

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

from services import google_oauth
from services.google_oauth import InvalidGoogleToken, verify_google_id_token

CLIENT_ID = "test-client-id.apps.googleusercontent.com"

# Module-level keypair: RSA generation costs real CPU time, and every test in
# this file that isn't specifically about key mismatch can share one pair.
_PRIVATE_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
_PUBLIC_KEY = _PRIVATE_KEY.public_key()


def _claims(**overrides):
    claims = {
        "iss": "https://accounts.google.com",
        "aud": CLIENT_ID,
        "sub": "1234567890",
        "email": "bob@example.com",
        "email_verified": True,
        "picture": "https://lh3.googleusercontent.com/a/pic",
        "exp": int(time.time()) + 3600,
    }
    claims.update(overrides)
    return claims


@pytest.fixture
def stub_signing_key(monkeypatch):
    """Point key lookup at a local key; real jwt.decode does the rest."""

    def _install(public_key=_PUBLIC_KEY):
        def fake_signing_key(credential):
            return type("Key", (), {"key": public_key})()

        monkeypatch.setattr(
            google_oauth._jwks_client, "get_signing_key_from_jwt", fake_signing_key
        )

    return _install


def test_accepts_valid_token(stub_signing_key):
    stub_signing_key()
    token = jwt.encode(_claims(), _PRIVATE_KEY, algorithm="RS256")
    identity = verify_google_id_token(token, CLIENT_ID)
    assert identity.sub == "1234567890"
    assert identity.email == "bob@example.com"


def test_rejects_expired_token(stub_signing_key):
    stub_signing_key()
    token = jwt.encode(
        _claims(exp=int(time.time()) - 60), _PRIVATE_KEY, algorithm="RS256"
    )
    with pytest.raises(InvalidGoogleToken):
        verify_google_id_token(token, CLIENT_ID)


def test_rejects_token_with_no_exp_claim(stub_signing_key):
    stub_signing_key()
    claims = _claims()
    del claims["exp"]
    token = jwt.encode(claims, _PRIVATE_KEY, algorithm="RS256")
    with pytest.raises(InvalidGoogleToken):
        verify_google_id_token(token, CLIENT_ID)


def test_rejects_token_signed_with_a_different_key(stub_signing_key):
    # The verifier is given the legitimate public key; the token is signed by
    # an unrelated private key an attacker controls.
    forger_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    stub_signing_key()
    token = jwt.encode(_claims(), forger_key, algorithm="RS256")
    with pytest.raises(InvalidGoogleToken):
        verify_google_id_token(token, CLIENT_ID)


def test_rejects_alg_none_token(stub_signing_key):
    stub_signing_key()
    # The classic unsigned-token forgery. PyJWT allows *encoding* alg=none so
    # we can construct the attack payload; the point of the test is that
    # decode() — pinned to algorithms=["RS256"] — must not accept it back.
    token = jwt.encode(_claims(), key=None, algorithm="none")
    with pytest.raises(InvalidGoogleToken):
        verify_google_id_token(token, CLIENT_ID)


def test_rejects_hs256_signed_token(stub_signing_key):
    # Algorithm-confusion family: a well-formed, internally-consistent HS256
    # token must still be rejected because decode() only allows RS256. (A
    # PEM-shaped secret would trip PyJWT's own encode-time guard against the
    # classic "sign with the RSA public key as an HMAC secret" attack, so an
    # arbitrary secret is used here — the property under test is the
    # algorithms allowlist, not that specific key-confusion trick.)
    stub_signing_key()
    token = jwt.encode(
        _claims(), "x" * 32, algorithm="HS256"
    )
    with pytest.raises(InvalidGoogleToken):
        verify_google_id_token(token, CLIENT_ID)


def test_rejects_foreign_audience(stub_signing_key):
    stub_signing_key()
    token = jwt.encode(
        _claims(aud="someone-else.apps.googleusercontent.com"),
        _PRIVATE_KEY,
        algorithm="RS256",
    )
    with pytest.raises(InvalidGoogleToken):
        verify_google_id_token(token, CLIENT_ID)


def test_rejects_wrong_issuer(stub_signing_key):
    stub_signing_key()
    token = jwt.encode(
        _claims(iss="https://evil.example.com"), _PRIVATE_KEY, algorithm="RS256"
    )
    with pytest.raises(InvalidGoogleToken):
        verify_google_id_token(token, CLIENT_ID)


def test_rejects_email_verified_as_string_true(stub_signing_key):
    # Claim-type confusion: a truthy non-bool must not satisfy `is True`.
    stub_signing_key()
    token = jwt.encode(
        _claims(email_verified="true"), _PRIVATE_KEY, algorithm="RS256"
    )
    with pytest.raises(InvalidGoogleToken):
        verify_google_id_token(token, CLIENT_ID)


def test_rejects_email_verified_as_int_one(stub_signing_key):
    stub_signing_key()
    token = jwt.encode(_claims(email_verified=1), _PRIVATE_KEY, algorithm="RS256")
    with pytest.raises(InvalidGoogleToken):
        verify_google_id_token(token, CLIENT_ID)
