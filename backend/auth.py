from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from fastapi import Cookie, Depends, HTTPException, Request, status
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from config import settings
from db import get_db
from db_models import User

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
_ALGORITHM = "HS256"
_TOKEN_EXPIRE_HOURS = 24

# CSRF defense for cookie-authenticated, state-changing endpoints that a browser
# would otherwise send cross-site without a preflight (multipart uploads, and
# bodyless POST/DELETE). Requiring a custom header forces a CORS preflight for
# cross-origin callers, which the origin allowlist then rejects. Same-origin JS
# (our SPA) sets it freely; a cross-site <form>/<img> cannot.
_CSRF_HEADER = "X-Requested-With"
_CSRF_EXPECTED = "XMLHttpRequest"


def require_csrf_header(request: Request) -> None:
    if request.headers.get(_CSRF_HEADER) != _CSRF_EXPECTED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Missing or invalid CSRF header",
        )


def hash_password(plain: str) -> str:
    return _pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return _pwd_context.verify(plain, hashed)


def create_access_token(user_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=_TOKEN_EXPIRE_HOURS)
    return jwt.encode(
        {"sub": str(user_id), "exp": expire},
        settings.jwt_secret_key,
        algorithm=_ALGORITHM,
    )


def get_current_user(
    access_token: Optional[str] = Cookie(default=None),
    db: Session = Depends(get_db),
) -> User:
    exc = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    if not access_token:
        raise exc
    try:
        payload = jwt.decode(access_token, settings.jwt_secret_key, algorithms=[_ALGORITHM])
        user_id: Optional[str] = payload.get("sub")
        if user_id is None:
            raise exc
    except jwt.PyJWTError:
        raise exc

    user = db.get(User, int(user_id))
    if user is None:
        raise exc
    return user
