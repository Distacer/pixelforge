"""Хешування паролів (bcrypt) і JWT-токени."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from .config import settings

# Хеш-«пустушка»: перевіряємо пароль навіть для неіснуючого юзера,
# щоб за часом відповіді не можна було вгадати, які ніки зайняті.
_DUMMY_HASH = bcrypt.hashpw(b"dummy-password", bcrypt.gensalt()).decode()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str | None) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), (password_hash or _DUMMY_HASH).encode())
    except ValueError:
        return False


def create_access_token(user_id: int) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + timedelta(minutes=settings.jwt_expire_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> int | None:
    """Повертає id користувача або None, якщо токен невалідний/прострочений."""
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        return int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError, TypeError):
        return None
