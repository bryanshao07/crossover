"""Verification of Google ID tokens (Google Identity Services sign-in).

An ID token arrives from the browser and is therefore attacker-controlled. It is
never merely decoded: the signature is checked against Google's published keys,
and the audience, issuer, and expiry are all asserted before any claim is
trusted. Callers get a narrow ``GoogleIdentity`` rather than raw claims so no
unvalidated field can leak into the rest of the app.
"""

from dataclasses import dataclass
from typing import Optional

import jwt
from jwt import PyJWKClient

_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs"
# Google emits both spellings of the issuer; both are legitimate.
_ISSUERS = {"https://accounts.google.com", "accounts.google.com"}

# Module scope: PyJWKClient caches Google's signing keys internally, so keys are
# fetched once per process rather than on every sign-in.
_jwks_client = PyJWKClient(_JWKS_URL)


class InvalidGoogleToken(Exception):
    """The credential is missing, malformed, unverifiable, or unacceptable."""


@dataclass(frozen=True)
class GoogleIdentity:
    sub: str
    email: str
    picture: Optional[str]


def verify_google_id_token(credential: str, client_id: str) -> GoogleIdentity:
    if not credential:
        raise InvalidGoogleToken("Missing credential")

    try:
        signing_key = _jwks_client.get_signing_key_from_jwt(credential)
        claims = jwt.decode(
            credential,
            signing_key.key,
            algorithms=["RS256"],
            audience=client_id,
            options={"require": ["exp", "aud", "iss", "sub"]},
        )
    except Exception as exc:  # PyJWT raises a wide family; all mean "reject"
        raise InvalidGoogleToken(str(exc)) from exc

    # Checked manually rather than via decode(issuer=...), which accepts only a
    # single string and cannot express the two legitimate spellings.
    if claims.get("iss") not in _ISSUERS:
        raise InvalidGoogleToken("Unexpected issuer")

    # The linking-safety gate. A Workspace admin can mint accounts bearing
    # arbitrary unverified addresses; without this, such a token could claim an
    # existing CrossOver account by email.
    if claims.get("email_verified") is not True:
        raise InvalidGoogleToken("Email not verified by Google")

    sub = claims.get("sub")
    email = (claims.get("email") or "").strip().lower()
    if not sub or not email:
        raise InvalidGoogleToken("Token missing subject or email")

    return GoogleIdentity(sub=sub, email=email, picture=claims.get("picture"))
