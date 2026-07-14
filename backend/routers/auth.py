from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import create_access_token, get_current_user, hash_password, verify_password
from config import settings
from db import get_db
from db_models import User

router = APIRouter(prefix="/auth", tags=["auth"])

_COOKIE_NAME = "access_token"
_COOKIE_MAX_AGE = 60 * 60 * 24  # 24 hours


class AuthRequest(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    id: int
    email: str


def _cookie_kwargs() -> dict:
    # Cross-origin deploys (frontend and backend on different domains) require
    # SameSite=None, which browsers only honor alongside Secure.
    is_production = settings.environment == "production"
    return {
        "httponly": True,
        "samesite": "none" if is_production else "lax",
        "secure": is_production,
    }


def _set_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=_COOKIE_NAME,
        value=token,
        max_age=_COOKIE_MAX_AGE,
        **_cookie_kwargs(),
    )


@router.post("/signup", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def signup(body: AuthRequest, db: Session = Depends(get_db)) -> UserResponse:
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
    user = User(email=body.email, hashed_password=hash_password(body.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return UserResponse(id=user.id, email=user.email)


@router.post("/login", response_model=UserResponse)
def login(body: AuthRequest, response: Response, db: Session = Depends(get_db)) -> UserResponse:
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    _set_auth_cookie(response, create_access_token(user.id))
    return UserResponse(id=user.id, email=user.email)


@router.post("/logout")
def logout(response: Response) -> dict:
    response.delete_cookie(_COOKIE_NAME, **_cookie_kwargs())
    return {"detail": "Logged out"}


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)) -> UserResponse:
    return UserResponse(id=current_user.id, email=current_user.email)
