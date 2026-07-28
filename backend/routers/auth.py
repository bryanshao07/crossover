import secrets
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Request, Response, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

import data_store as ds
from auth import create_access_token, get_current_user, hash_password, verify_password
from config import settings
from db import get_db
from db_models import User
from rate_limit import (
    check_account_limit,
    limiter,
    record_account_attempt,
    reset_account,
)

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


def _account_key(email: str) -> str:
    return email.strip().lower()


class AuthRequest(BaseModel):
    email: str
    password: str


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
def signup(request: Request, body: AuthRequest, db: Session = Depends(get_db)) -> UserResponse:
    account_key = _account_key(body.email)
    check_account_limit(
        account_key, max_attempts=_ACCOUNT_MAX_ATTEMPTS, window_seconds=_ACCOUNT_WINDOW_SECONDS
    )
    record_account_attempt(account_key)
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
    user = User(email=body.email, hashed_password=hash_password(body.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return _user_response(user)


@router.post("/login", response_model=UserResponse)
@limiter.limit("10/minute")
def login(
    request: Request, body: AuthRequest, response: Response, db: Session = Depends(get_db)
) -> UserResponse:
    account_key = _account_key(body.email)
    check_account_limit(
        account_key, max_attempts=_ACCOUNT_MAX_ATTEMPTS, window_seconds=_ACCOUNT_WINDOW_SECONDS
    )
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not verify_password(body.password, user.hashed_password):
        record_account_attempt(account_key)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    reset_account(account_key)
    _set_auth_cookie(response, create_access_token(user.id))
    return _user_response(user)


@router.post("/logout")
def logout(response: Response) -> dict:
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
) -> UserResponse:
    ext = _ALLOWED_AVATAR_TYPES.get(file.content_type)
    if ext is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file type. Use PNG, JPEG, or WebP.",
        )

    contents = file.file.read()
    if len(contents) > _MAX_AVATAR_BYTES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File too large. Max 5MB.")

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
) -> UserResponse:
    current_user.avatar_url = None
    db.commit()
    db.refresh(current_user)
    return _user_response(current_user)
