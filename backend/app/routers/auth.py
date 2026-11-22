"""Реєстрація, вхід, перевірка ніку."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from ..deps import DbSession
from ..models import User, username_key
from ..schemas import (
    USERNAME_PATTERN,
    LoginIn,
    RegisterIn,
    TokenOut,
    UsernameAvailability,
    UserOut,
)
from ..security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Ніки, що конфліктують з URL-адресами (/api/users/me тощо)
RESERVED = {"me", "admin", "api", "root", "null", "undefined"}


def _find_user(db: DbSession, username: str) -> User | None:
    return db.scalar(select(User).where(User.username_key == username_key(username)))


def _token_response(user: User) -> TokenOut:
    return TokenOut(access_token=create_access_token(user.id), user=UserOut.model_validate(user))


@router.post("/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
def register(body: RegisterIn, db: DbSession) -> TokenOut:
    """Створює акаунт і одразу повертає токен."""
    if username_key(body.username) in RESERVED or _find_user(db, body.username):
        raise HTTPException(status.HTTP_409_CONFLICT, "Цей нік уже зайнятий")

    user = User(
        username=body.username.strip(),
        username_key=username_key(body.username),
        password_hash=hash_password(body.password),
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:  # два одночасні запити з однаковим ніком
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Цей нік уже зайнятий") from None
    db.refresh(user)
    return _token_response(user)


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, db: DbSession) -> TokenOut:
    user = _find_user(db, body.username)
    if not verify_password(body.password, user.password_hash if user else None) or user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Неправильний нік або пароль")
    return _token_response(user)


@router.post("/token", include_in_schema=True, summary="Вхід через форму (для Swagger)")
def token_form(form: Annotated[OAuth2PasswordRequestForm, Depends()], db: DbSession) -> dict:
    """Те саме, що /login, але приймає form-data — так працює кнопка Authorize у /api/docs."""
    user = _find_user(db, form.username)
    if not verify_password(form.password, user.password_hash if user else None) or user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Неправильний нік або пароль")
    return {"access_token": create_access_token(user.id), "token_type": "bearer"}


@router.get("/check-username", response_model=UsernameAvailability)
def check_username(
    db: DbSession,
    username: Annotated[str, Query(min_length=3, max_length=24, pattern=USERNAME_PATTERN)],
) -> UsernameAvailability:
    """Жива перевірка в формі реєстрації."""
    available = username_key(username) not in RESERVED and _find_user(db, username) is None
    return UsernameAvailability(username=username, available=available)
