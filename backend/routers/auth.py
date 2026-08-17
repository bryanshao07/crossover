import secrets
from pathlib import Path
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Request, Response, UploadFile, status
from pydantic import BaseModel, EmailStr, StringConstraints, field_validator
from sqlalchemy.orm import Session

import data_store as ds
from auth import (
    create_access_token,
    get_current_user,
    hash_password,
    require_csrf_header,
    verify_password,
)
from config import settings
from db import get_db
from db_models import User
from rate_limit import (
    check_account_limit,
    limiter,
    record_account_attempt,
    reset_account,
)
from services.google_oauth import GoogleOAuthUnavailable, InvalidGoogleToken, verify_google_id_token

router = APIRouter(prefix="/auth", tags=["auth"])

_COOKIE_NAME = "access_token"
_COOKIE_MAX_AGE = 60 * 60 * 24  # 24 hours

_ALLOWED_AVATAR_TYPES = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
}
_MAX_AVATAR_BYTES = 5 * 1024 * 1024  # 5MB

# Per-account (per-email) throttle: an attacker rotating IPs still can't hammer
# one account. Per-IP throttling is applied separately via @limiter.limit.
_ACCOUNT_MAX_ATTEMPTS = 5
_ACCOUNT_WINDOW_SECONDS = 15 * 60  # 15 minutes

_MIN_PASSWORD_LEN = 8
_MAX_PASSWORD_LEN = 72  # bcrypt silently truncates input beyond 72 bytes


def _account_key(email: str) -> str:
    return email.strip().lower()


def _sniff_image_ext(data: bytes) -> Optional[str]:
    """Return the image extension implied by the file's magic bytes, or None.

    Trusting the client-supplied Content-Type alone lets an attacker upload
    arbitrary bytes under an image/* label; the content signature is checked too.
    """
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if data.startswith(b"\xff\xd8\xff"):
        return "jpg"
    if len(data) >= 12 and data[0:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    return None


class _EmailBody(BaseModel):
    email: EmailStr

    @field_validator("email")
    @classmethod
    def _normalize_email(cls, v: str) -> str:
        # Store/compare emails in a single canonical form so casing can't create
        # duplicate accounts or bypass the per-account rate limit.
        return v.strip().lower()


class LoginRequest(_EmailBody):
    # No length constraint on login: existing passwords must still verify.
    password: str


class SignupRequest(_EmailBody):
    password: Annotated[
        str, StringConstraints(min_length=_MIN_PASSWORD_LEN, max_length=_MAX_PASSWORD_LEN)
    ]


class GoogleAuthRequest(BaseModel):
    credential: str


class UserResponse(BaseModel):
    id: int
    email: str
    avatar_url: Optional[str] = None


class AvatarFromPlayerRequest(BaseModel):
    player_name: str


def _cookie_kwargs() -> dict:
    # Cross-origin deploys (frontend and backend on different domains) require
    # SameSite=None, which browsers only honor alongside Secure.
    #
    # Fail secure: only an explicit "development" environment (local http) opts out
    # of Secure + SameSite=None. Any other or undeclared value is treated as
    # production, so a misconfigured deploy never silently issues insecure cookies.
    is_secure = settings.environment != "development"
    return {
        "httponly": True,
        "samesite": "none" if is_secure else "lax",
        "secure": is_secure,
    }


def _set_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=_COOKIE_NAME,
        value=token,
        max_age=_COOKIE_MAX_AGE,
        **_cookie_kwargs(),
    )


def _user_response(user: User) -> UserResponse:
    return UserResponse(id=user.id, email=user.email, avatar_url=user.avatar_url)


@router.post("/signup", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
def signup(request: Request, body: SignupRequest, db: Session = Depends(get_db)) -> UserResponse:
    account_key = _account_key(body.email)
    check_account_limit(
        account_key, max_attempts=_ACCOUNT_MAX_ATTEMPTS, window_seconds=_ACCOUNT_WINDOW_SECONDS
    )
    record_account_attempt(account_key)
    if db.query(User).filter(User.email == body.email).first():
        # Generic message + always hash so response wording and timing don't
        # reveal whether the email is already registered.
        hash_password(body.password)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to complete signup with the provided details.",
        )
    user = User(email=body.email, hashed_password=hash_password(body.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return _user_response(user)


@router.post("/login", response_model=UserResponse)
@limiter.limit("10/minute")
def login(
    request: Request, body: LoginRequest, response: Response, db: Session = Depends(get_db)
) -> UserResponse:
    account_key = _account_key(body.email)
    check_account_limit(
        account_key, max_attempts=_ACCOUNT_MAX_ATTEMPTS, window_seconds=_ACCOUNT_WINDOW_SECONDS
    )
    user = db.query(User).filter(User.email == body.email).first()
    # A Google-created account has no password. Fall through to the same generic
    # 401 rather than passing None to verify_password (which would 500).
    if not user or not user.hashed_password or not verify_password(
        body.password, user.hashed_password
    ):
        record_account_attempt(account_key)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    reset_account(account_key)
    _set_auth_cookie(response, create_access_token(user.id))
    return _user_response(user)


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
    except GoogleOAuthUnavailable:
        # Not the user's fault: Google's key service could not be reached. A 401
        # here would make a Google-side outage indistinguishable from mass
        # credential forgery, so this gets its own generic 503 instead.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google sign-in is temporarily unavailable.",
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


@router.post("/logout")
def logout(response: Response, _csrf: None = Depends(require_csrf_header)) -> dict:
    response.delete_cookie(_COOKIE_NAME, **_cookie_kwargs())
    return {"detail": "Logged out"}


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)) -> UserResponse:
    return _user_response(current_user)


@router.post("/avatar/upload", response_model=UserResponse)
def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    _csrf: None = Depends(require_csrf_header),
) -> UserResponse:
    if file.content_type not in _ALLOWED_AVATAR_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file type. Use PNG, JPEG, or WebP.",
        )

    contents = file.file.read()
    if len(contents) > _MAX_AVATAR_BYTES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File too large. Max 5MB.")

    # Trust the actual bytes over the client-declared Content-Type.
    ext = _sniff_image_ext(contents)
    if ext is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File contents are not a valid PNG, JPEG, or WebP image.",
        )

    avatars_dir = Path(settings.uploads_dir) / "avatars"
    avatars_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{current_user.id}_{secrets.token_hex(4)}.{ext}"
    (avatars_dir / filename).write_bytes(contents)

    current_user.avatar_url = f"/static/avatars/{filename}"
    db.commit()
    db.refresh(current_user)
    return _user_response(current_user)


@router.post("/avatar/player", response_model=UserResponse)
def set_avatar_from_player(
    body: AvatarFromPlayerRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserResponse:
    player = ds.get_player(body.player_name)
    if player is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Player not found: {body.player_name}")

    if player["sport"] == "basketball":
        headshot_url = ds.nba_headshot_url(body.player_name)
    else:
        headshot_url = ds.pl_headshot_url(body.player_name)

    if headshot_url is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No photo available for this player")

    current_user.avatar_url = headshot_url
    db.commit()
    db.refresh(current_user)
    return _user_response(current_user)


@router.delete("/avatar", response_model=UserResponse)
def remove_avatar(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    _csrf: None = Depends(require_csrf_header),
) -> UserResponse:
    current_user.avatar_url = None
    db.commit()
    db.refresh(current_user)
    return _user_response(current_user)
