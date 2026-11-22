"""Спільні FastAPI-залежності: сесія БД і поточний користувач."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from .database import get_db
from .models import User
from .security import decode_access_token

# tokenUrl потрібен, щоб у Swagger (/api/docs) працювала кнопка Authorize
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token", auto_error=False)

DbSession = Annotated[Session, Depends(get_db)]


def get_optional_user(
    db: DbSession, token: Annotated[str | None, Depends(oauth2_scheme)]
) -> User | None:
    if not token:
        return None
    user_id = decode_access_token(token)
    if user_id is None:
        return None
    return db.get(User, user_id)


def get_current_user(user: Annotated[User | None, Depends(get_optional_user)]) -> User:
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Потрібно увійти в акаунт",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


OptionalUser = Annotated[User | None, Depends(get_optional_user)]
CurrentUser = Annotated[User, Depends(get_current_user)]
