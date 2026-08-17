"""Verification of Google ID tokens (Google Identity Services sign-in).

An ID token arrives from the browser and is therefore attacker-controlled. It is
never merely decoded: the signature is checked against Google's published keys,
and the audience, issuer, and expiry are all asserted before any claim is
trusted. Callers get a narrow ``GoogleIdentity`` rather than raw claims so no
unvalidated field can leak into the rest of the app.
"""

import logging
from dataclasses import dataclass
from typing import Optional

import jwt
from jwt import PyJWKClient

logger = logging.getLogger(__name__)

_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs"
# Google emits both spellings of the issuer; both are legitimate.
_ISSUERS = {"https://accounts.google.com", "accounts.google.com"}

# Module scope so the process reuses one client. PyJWKClient still refetches
# Google's key set over the network on a schedule (its default JWK-set cache
# has a 5-minute lifespan) — this only avoids re-fetching on every sign-in.
_jwks_client = PyJWKClient(_JWKS_URL)


class InvalidGoogleToken(Exception):
    """The credential is missing, malformed, unverifiable, or unacceptable."""


class GoogleOAuthUnavailable(Exception):
    """Google's key service could not be reached.

    Distinct from ``InvalidGoogleToken``: this means verification could not be
    performed at all (network/outage), not that the credential was rejected.
    Callers should map this to a 503, not the 401 an invalid token gets —
    otherwise a Google-side blip looks identical to forgery for every user.
    """


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
    except jwt.PyJWKClientConnectionError as exc:
        # Checked before the broader PyJWTError catch below, since this class
        # subclasses it — an unreachable JWKS endpoint is an outage, not
        # evidence the credential is forged.
        logger.warning("Google JWKS endpoint unreachable: %s", exc)
        raise GoogleOAuthUnavailable("Could not reach Google's key service") from exc
    except jwt.PyJWTError as exc:
        # Covers signature/claim decode failures and PyJWKClientError (e.g. no
        # key matches the token's `kid`). Only PyJWT's own error family is
        # treated as "reject this credential" — anything else (a TypeError
        # from a caller bug, say) propagates instead of being misreported as
        # an invalid token.
        #
        # PyJWKClient interpolates the token's unverified `kid` header into
        # some of these messages, and that header is attacker-controlled
        # before verification runs. The detail is logged server-side only;
        # the raised message is fixed so nothing token-derived reaches a
        # caller that might put it in an HTTP response.
        logger.info("Rejected Google ID token: %s", exc)
        raise InvalidGoogleToken("Invalid Google credential") from exc

    # Checked manually rather than via decode(issuer=...). PyJWT 2.13's issuer
    # check does accept a container of acceptable values, so either approach
    # works here — this form just keeps the "two spellings" rule visible next
    # to the other post-decode checks below instead of inside the decode call.
    if claims.get("iss") not in _ISSUERS:
        raise InvalidGoogleToken("Unexpected issuer")

    # The linking-safety gate. A Workspace admin can mint accounts bearing
    # arbitrary unverified addresses; without this, such a token could claim an
    # existing CrossOver account by email. Compared with `is not True` rather
    # than truthiness so claim values like "true" or 1 don't slip past it.
    if claims.get("email_verified") is not True:
        raise InvalidGoogleToken("Email not verified by Google")

    sub = claims.get("sub")
    email = (claims.get("email") or "").strip().lower()
    if not sub or not email:
        raise InvalidGoogleToken("Token missing subject or email")

    return GoogleIdentity(sub=sub, email=email, picture=claims.get("picture"))
