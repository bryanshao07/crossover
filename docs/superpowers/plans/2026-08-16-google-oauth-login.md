# Log In With Google Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user sign in to CrossOver with their Google account, obtaining the same `access_token` cookie that email/password login already issues.

**Architecture:** Google Identity Services renders a button in the SPA; Google hands the browser a signed ID token; the frontend posts it to `POST /auth/google`; the backend verifies the token's signature against Google's JWKS, then finds, links, or creates a user and sets the existing auth cookie. Nothing downstream of the cookie changes.

**Tech Stack:** FastAPI, SQLAlchemy 2.x, Alembic, PyJWT (already installed — `PyJWKClient` does the verification), React + Vite, axios, TanStack Query.

## Global Constraints

- **No new dependency**, Python or npm. Verification uses `PyJWKClient` from the already-pinned `PyJWT`.
- **Google Client ID** is `878594319937-qhtj0hbmg33ld8v8fi95at1o5g8m562c.apps.googleusercontent.com`. It is read from config in both tiers — **never hardcoded in source**. It is not a secret (it ships in the JS bundle); it still lives in `.env`, and `.env.example` gets a placeholder, not the real value.
- **Degrade gracefully when unconfigured**: backend without `GOOGLE_CLIENT_ID` returns 503 from `/auth/google` and every other route still works; frontend without `VITE_GOOGLE_CLIENT_ID` renders no button. Mirrors the existing optional `gemini_api_key`.
- **Never decode a token without verifying it.** Signature (RS256, Google JWKS), `aud` == our client ID, `iss` in `{https://accounts.google.com, accounts.google.com}`, and `exp` are all mandatory.
- **Account linking requires `email_verified is True`** in the token. No exceptions.
- **No account enumeration.** Every auth failure — bad token, unverified email, password login against a passwordless account — returns a generic message that never reveals whether an account exists.
- **Emails are normalized** with `.strip().lower()` before any lookup or insert, matching `_EmailBody._normalize_email`.
- Design system: background `#0a0a0f`, accent `#e8ff47`, border radius 2–4px, Tailwind only, no component library.
- Alembic head at plan time is `a1b2c3d4e5f6`. Re-confirm with `venv/bin/alembic heads` before writing the migration.
- Postgres must be running on `localhost:5432` for DB-backed tests. It was **down** when this plan was written. If a test fails on `connection refused`, that is the environment, not the code — say so plainly rather than reporting a pass.

All backend commands run from `backend/` using `venv/bin/python`. All frontend commands run from `frontend/` after `export PATH="/Users/bryan.shao/.nvm/versions/node/v24.13.1/bin:$PATH"`.

## File Structure

| File | Responsibility |
| --- | --- |
| `backend/services/google_oauth.py` | **New.** Pure token verification. Knows nothing about the DB or FastAPI. One public function + one exception type. |
| `backend/db_models.py` | `User.hashed_password` nullable; new `User.google_sub`. |
| `backend/alembic/versions/b7f2a9c4d1e3_add_google_auth_to_users.py` | **New.** The corresponding schema migration. |
| `backend/config.py` | `google_client_id` setting. |
| `backend/routers/auth.py` | `POST /auth/google` (user resolution + cookie); passwordless guard in `login`. |
| `backend/tests/test_google_oauth_verify.py` | **New.** Unit tests for verification — no DB, no network. |
| `backend/tests/test_google_auth_endpoint.py` | **New.** Endpoint tests — needs Postgres. |
| `frontend/src/api/client.js` | `googleLogin(credential)`. |
| `frontend/src/context/AuthContext.jsx` | `loginWithGoogle(credential)`. |
| `frontend/src/hooks/useGoogleIdentity.js` | **New.** Loads the GSI script, reports ready/error. Isolates all script-tag side effects from the page. |
| `frontend/src/pages/AuthPage.jsx` | Button placement, OR divider, submit handling. |

Verification lives in `services/` rather than inside the router because it is the security boundary and deserves tests that run with no database and no network. The router then holds only user resolution.

---

### Task 1: Schema — nullable password + `google_sub`

**Files:**
- Modify: `backend/db_models.py:24`
- Create: `backend/alembic/versions/b7f2a9c4d1e3_add_google_auth_to_users.py`

**Interfaces:**
- Consumes: nothing.
- Produces: `User.google_sub` (`Optional[str]`, unique, indexed); `User.hashed_password` becomes `Optional[str]`.

- [ ] **Step 1: Confirm the current migration head**

Run: `cd backend && venv/bin/alembic heads`
Expected: `a1b2c3d4e5f6 (head)`. If it differs, use the value you see as `down_revision` in Step 3.

- [ ] **Step 2: Update the model**

In `backend/db_models.py`, replace the `hashed_password` line and add `google_sub` beneath it:

```python
    # NULL for accounts created via Google sign-in, which have no password.
    hashed_password = Column(String, nullable=True)
    # Google's stable per-account subject id. NULL for password-only accounts;
    # unique so one Google account cannot attach to two CrossOver users.
    google_sub = Column(String, unique=True, nullable=True, index=True)
```

- [ ] **Step 3: Write the migration**

Create `backend/alembic/versions/b7f2a9c4d1e3_add_google_auth_to_users.py`:

```python
"""add google auth columns to users

Revision ID: b7f2a9c4d1e3
Revises: a1b2c3d4e5f6
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b7f2a9c4d1e3"
down_revision: Union[str, Sequence[str], None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Google-created accounts have no password at all. A placeholder hash was
    # rejected in design: NULL states the fact and keeps the passwordless
    # branch explicit.
    op.alter_column("users", "hashed_password", existing_type=sa.String(), nullable=True)
    op.add_column("users", sa.Column("google_sub", sa.String(), nullable=True))
    op.create_index(op.f("ix_users_google_sub"), "users", ["google_sub"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_users_google_sub"), table_name="users")
    op.drop_column("users", "google_sub")
    # Rows with a NULL password cannot satisfy NOT NULL; they are Google-only
    # accounts and are removed as part of reverting the feature.
    op.execute("DELETE FROM users WHERE hashed_password IS NULL")
    op.alter_column("users", "hashed_password", existing_type=sa.String(), nullable=False)
```

- [ ] **Step 4: Apply and verify the migration**

Run: `cd backend && venv/bin/alembic upgrade head && venv/bin/alembic heads`
Expected: upgrade succeeds; head is now `b7f2a9c4d1e3 (head)`.

If this fails with `connection refused`, Postgres is not running. Start it, or stop and report the blocker — do not skip to Task 2 claiming success.

- [ ] **Step 5: Verify the round trip**

Run: `cd backend && venv/bin/alembic downgrade -1 && venv/bin/alembic upgrade head`
Expected: both succeed with no error.

- [ ] **Step 6: Commit**

```bash
git add backend/db_models.py backend/alembic/versions/b7f2a9c4d1e3_add_google_auth_to_users.py
git commit -m "feat(auth): allow passwordless users and store google_sub"
```

---

### Task 2: Token verification service

**Files:**
- Create: `backend/services/google_oauth.py`
- Test: `backend/tests/test_google_oauth_verify.py`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces:
  - `class InvalidGoogleToken(Exception)`
  - `verify_google_id_token(credential: str, client_id: str) -> GoogleIdentity`
  - `class GoogleIdentity` — a dataclass with fields `sub: str`, `email: str`, `picture: Optional[str]`. Task 3 consumes exactly these three.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_google_oauth_verify.py`:

```python
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backend && venv/bin/python -m pytest tests/test_google_oauth_verify.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'services.google_oauth'`

- [ ] **Step 3: Write the implementation**

Create `backend/services/google_oauth.py`:

```python
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd backend && venv/bin/python -m pytest tests/test_google_oauth_verify.py -v`
Expected: PASS — 10 passed. These need no database, so they must pass even with Postgres down.

- [ ] **Step 5: Commit**

```bash
git add backend/services/google_oauth.py backend/tests/test_google_oauth_verify.py
git commit -m "feat(auth): verify Google ID tokens against Google JWKS"
```

---

### Task 3: `POST /auth/google` + passwordless login guard

**Files:**
- Modify: `backend/config.py:13-35`, `backend/routers/auth.py`
- Modify: `backend/.env`, `backend/.env.example`
- Test: `backend/tests/test_google_auth_endpoint.py`

**Interfaces:**
- Consumes: `User.google_sub`, nullable `User.hashed_password` (Task 1); `verify_google_id_token`, `InvalidGoogleToken`, `GoogleIdentity` (Task 2).
- Produces: `POST /auth/google` accepting `{"credential": str}` and returning the existing `UserResponse` (`{id, email, avatar_url}`) plus a `Set-Cookie: access_token`. Task 4 calls this.

- [ ] **Step 1: Add the config setting**

In `backend/config.py`, add beneath `gemini_embed_model`:

```python
    # Google Sign-In client id. Public by design (it ships in the JS bundle).
    # Absent = the feature is off: /auth/google returns 503 and the button hides.
    google_client_id: Optional[str] = None
```

Append to `backend/.env` the real value, and to `backend/.env.example` a placeholder:

```bash
# backend/.env
GOOGLE_CLIENT_ID=878594319937-qhtj0hbmg33ld8v8fi95at1o5g8m562c.apps.googleusercontent.com

# backend/.env.example
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

- [ ] **Step 2: Write the failing tests**

Create `backend/tests/test_google_auth_endpoint.py`:

```python
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
from services.google_oauth import GoogleIdentity, InvalidGoogleToken

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
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd backend && venv/bin/python -m pytest tests/test_google_auth_endpoint.py -v`
Expected: FAIL — `ImportError` on `verify_google_id_token` in `routers.auth`, then 404s on `/auth/google`.

- [ ] **Step 4: Implement the endpoint**

In `backend/routers/auth.py`, extend the `services` import area with:

```python
from services.google_oauth import InvalidGoogleToken, verify_google_id_token
```

Add the request model next to `SignupRequest`:

```python
class GoogleAuthRequest(BaseModel):
    credential: str
```

Add the route after `login`:

```python
@router.post("/google", response_model=UserResponse)
@limiter.limit("10/minute")
def google_auth(
    request: Request, body: GoogleAuthRequest, response: Response, db: Session = Depends(get_db)
) -> UserResponse:
    if not settings.google_client_id:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google sign-in is not configured.",
        )

    try:
        identity = verify_google_id_token(body.credential, settings.google_client_id)
    except InvalidGoogleToken:
        # Generic message: the specific reason is useful to an attacker probing
        # tokens and useless to a legitimate user.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not sign in with Google.",
        )

    # Subject id first: it is permanent, whereas a user can change their email.
    user = db.query(User).filter(User.google_sub == identity.sub).first()
    if user is None:
        user = db.query(User).filter(User.email == identity.email).first()
        if user is not None:
            # Link: Google vouched for this address (email_verified was enforced
            # during verification), so it is the same person. The password, if
            # any, is left intact and keeps working.
            user.google_sub = identity.sub
        else:
            user = User(
                email=identity.email,
                hashed_password=None,
                google_sub=identity.sub,
                avatar_url=identity.picture,
            )
            db.add(user)
    db.commit()
    db.refresh(user)

    _set_auth_cookie(response, create_access_token(user.id))
    return _user_response(user)
```

- [ ] **Step 5: Add the passwordless guard to `login`**

In `backend/routers/auth.py`, replace the credential check inside `login`:

```python
    user = db.query(User).filter(User.email == body.email).first()
    # A Google-created account has no password. Fall through to the same generic
    # 401 rather than passing None to verify_password (which would 500).
    if not user or not user.hashed_password or not verify_password(
        body.password, user.hashed_password
    ):
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd backend && venv/bin/python -m pytest tests/test_google_auth_endpoint.py -v`
Expected: PASS — 7 passed. Requires Postgres; on `connection refused`, start the DB rather than moving on.

- [ ] **Step 7: Run the whole backend suite for regressions**

Run: `cd backend && venv/bin/python -m pytest tests/ -q`
Expected: all pass. Pay attention to `test_auth_validation.py` and `test_auth_rate_limit.py` — the `login` change touches their path.

- [ ] **Step 8: Commit**

```bash
git add backend/config.py backend/routers/auth.py backend/.env.example backend/tests/test_google_auth_endpoint.py
git commit -m "feat(auth): add POST /auth/google with email-verified account linking"
```

Note `backend/.env` is not committed — confirm it is gitignored before staging.

---

### Task 4: Frontend request + context wiring

**Files:**
- Modify: `frontend/src/api/client.js:33-36`
- Modify: `frontend/src/context/AuthContext.jsx:16-25`

**Interfaces:**
- Consumes: `POST /auth/google` (Task 3).
- Produces: `api.googleLogin(credential) -> Promise<user>`; `loginWithGoogle(credential)` on the auth context. Task 5 calls `loginWithGoogle`.

- [ ] **Step 1: Add the API method**

In `frontend/src/api/client.js`, directly after the `login` line:

```js
  googleLogin: (credential) =>
    http.post("/auth/google", { credential }).then((r) => r.data),
```

- [ ] **Step 2: Add the context method**

In `frontend/src/context/AuthContext.jsx`, after `login`:

```js
  async function loginWithGoogle(credential) {
    const me = await api.googleLogin(credential);
    queryClient.setQueryData(["auth", "me"], me);
    return me;
  }
```

Then add `loginWithGoogle` to the `value` object alongside `login`.

- [ ] **Step 3: Verify it compiles**

Run: `cd frontend && npx vite build`
Expected: `✓ built`. (The >500 kB chunk warning is pre-existing and expected.)

- [ ] **Step 4: Commit**

```bash
git add frontend/src/api/client.js frontend/src/context/AuthContext.jsx
git commit -m "feat(auth): wire googleLogin through the api client and auth context"
```

---

### Task 5: The Google button on the auth page

**Files:**
- Create: `frontend/src/hooks/useGoogleIdentity.js`
- Modify: `frontend/src/pages/AuthPage.jsx`
- Modify: `frontend/.env`

**Interfaces:**
- Consumes: `loginWithGoogle(credential)` (Task 4).
- Produces: user-visible sign-in. Nothing else depends on it.

- [ ] **Step 1: Add the frontend env variable**

Append to `frontend/.env`:

```bash
VITE_GOOGLE_CLIENT_ID=878594319937-qhtj0hbmg33ld8v8fi95at1o5g8m562c.apps.googleusercontent.com
```

- [ ] **Step 2: Write the script-loading hook**

Create `frontend/src/hooks/useGoogleIdentity.js`:

```js
import { useEffect, useState } from "react";

const SRC = "https://accounts.google.com/gsi/client";
const SCRIPT_ID = "google-gsi-client";

/**
 * Loads Google Identity Services on demand and reports when it's usable.
 *
 * Loaded here rather than in index.html so only the auth page pays for it, and
 * so a blocked or failed script degrades to `ready: false` — leaving the
 * email/password form fully functional — instead of throwing.
 */
export function useGoogleIdentity(enabled) {
  const [ready, setReady] = useState(() => Boolean(window.google?.accounts?.id));

  useEffect(() => {
    if (!enabled || ready) return;

    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      existing.addEventListener("load", () => setReady(true));
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => setReady(true);
    document.head.appendChild(script);
  }, [enabled, ready]);

  return ready;
}
```

- [ ] **Step 3: Render the button in AuthPage**

In `frontend/src/pages/AuthPage.jsx`, add imports:

```js
import { useEffect, useRef, useState } from "react";
import { useGoogleIdentity } from "../hooks/useGoogleIdentity";
```

Add near the top of the module, beside `MIN_PASSWORD_LEN`:

```js
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
```

Inside the component, after the existing `useAuth()` line (which must now also pull `loginWithGoogle`):

```js
  const googleButtonRef = useRef(null);
  const gsiReady = useGoogleIdentity(Boolean(GOOGLE_CLIENT_ID));

  // The GSI callback is registered once, but it closes over state that changes
  // every render. A ref keeps Google calling the *current* handler instead of a
  // stale one captured at initialize() time.
  const handleCredentialRef = useRef();
  handleCredentialRef.current = async ({ credential }) => {
    setError("");
    setSubmitting(true);
    try {
      await loginWithGoogle(credential);
      navigate("/");
    } catch (err) {
      setError(friendlyError(err, "Could not sign in with Google."));
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!gsiReady || !GOOGLE_CLIENT_ID || !googleButtonRef.current) return;
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (response) => handleCredentialRef.current(response),
    });
    window.google.accounts.id.renderButton(googleButtonRef.current, {
      theme: "filled_black",
      shape: "rectangular",
      text: "continue_with",
      // Matches the form width: max-w-md (448px) minus p-8 padding on both sides.
      width: 384,
    });
  }, [gsiReady]);
```

Then place the button and divider immediately above the `<form>` element:

```jsx
        {GOOGLE_CLIENT_ID && (
          <>
            <div ref={googleButtonRef} className="flex justify-center min-h-[40px]" />
            <div className="flex items-center gap-3 my-5">
              <div className="h-px flex-1 bg-white/10" />
              <span className="font-mono text-[10px] text-white/40 uppercase tracking-wider">
                Or
              </span>
              <div className="h-px flex-1 bg-white/10" />
            </div>
          </>
        )}
```

- [ ] **Step 4: Verify it builds and lints**

Run: `cd frontend && npx vite build && npm run lint`
Expected: build succeeds; lint reports no new errors.

- [ ] **Step 5: Manual verification in the browser**

Start the backend (`cd backend && venv/bin/uvicorn main:app --reload`) and frontend (`cd frontend && npm run dev`), then at `http://localhost:5173/auth`:

1. The Google button renders above an "OR" divider on **both** tabs.
2. Signing in with a brand-new Google account lands on `/` authenticated; the nav shows the user.
3. `GET /auth/me` returns that user with the Google profile picture as `avatar_url`.
4. Sign out, sign in again with the same Google account — same account, no duplicate row.
5. Create a password account with some email, sign out, then sign in with Google using **that same email** — you land in the same account with its favorites intact.

Requires the Console origins from the spec to be registered first. If the popup reports `origin_mismatch`, that setup step is incomplete — report it rather than working around it.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/hooks/useGoogleIdentity.js frontend/src/pages/AuthPage.jsx
git commit -m "feat(auth): add Log In With Google button to the auth page"
```

Note `frontend/.env` is gitignored — the deploy needs `VITE_GOOGLE_CLIENT_ID` set on Vercel and `GOOGLE_CLIENT_ID` set on Render separately.

---

## Self-Review

**Spec coverage:** schema §Schema → Task 1; verification §1 → Task 2; linking §2 → Tasks 2 (gate) + 3 (resolution); generic 401 §3 → Task 3 Step 5; config → Task 3 Step 1 + Task 5 Step 1; endpoint → Task 3; frontend → Tasks 4–5; tests → Tasks 2–3. The spec's manual Console setup is owner-side and appears in Task 5 Step 5 as a precondition.

**Type consistency:** `GoogleIdentity(sub, email, picture)` is defined in Task 2 and consumed with exactly those three fields in Task 3's route and test stubs. `verify_google_id_token(credential, client_id)` keeps that two-argument form in both. `api.googleLogin(credential)` → `loginWithGoogle(credential)` matches across Tasks 4 and 5.

**Known environment risk:** Tasks 1, 3, and 5 need Postgres running; it was down when this plan was written. Task 2 deliberately needs neither DB nor network.
