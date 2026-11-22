"""Pydantic-схеми запитів і відповідей."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

# Літери (у т.ч. кирилиця), цифри, "_" і "-"
USERNAME_PATTERN = r"^[\w-]{3,24}$"


# ---------- Auth ----------


class RegisterIn(BaseModel):
    username: str = Field(min_length=3, max_length=24, pattern=USERNAME_PATTERN)
    password: str = Field(min_length=6, max_length=72)

    @field_validator("password")
    @classmethod
    def password_fits_bcrypt(cls, value: str) -> str:
        # bcrypt враховує лише перші 72 БАЙТИ — кирилиця займає 2 байти на символ
        if len(value.encode("utf-8")) > 72:
            raise ValueError("Пароль задовгий (максимум 72 байти)")
        return value


class LoginIn(BaseModel):
    username: str = Field(min_length=1, max_length=24)
    password: str = Field(min_length=1, max_length=72)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    created_at: datetime


class TokenOut(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    user: UserOut


class UsernameAvailability(BaseModel):
    username: str
    available: bool


class PublicProfileOut(BaseModel):
    username: str
    created_at: datetime
    public_artworks: int
    total_likes: int


# ---------- Artworks ----------


class ArtworkCreate(BaseModel):
    title: str = Field(min_length=1, max_length=80)
    width: int = Field(ge=1, le=128)
    height: int = Field(ge=1, le=128)
    frame_count: int = Field(default=1, ge=1, le=120)
    data: dict[str, Any]
    preview_png: str = Field(description="PNG-прев'ю як base64 або data:image/png;base64,...")
    is_public: bool = False

    @field_validator("title")
    @classmethod
    def strip_title(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Назва не може бути порожньою")
        return value


class ArtworkUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=80)
    width: int | None = Field(default=None, ge=1, le=128)
    height: int | None = Field(default=None, ge=1, le=128)
    frame_count: int | None = Field(default=None, ge=1, le=120)
    data: dict[str, Any] | None = None
    preview_png: str | None = None
    is_public: bool | None = None

    @field_validator("title")
    @classmethod
    def strip_title(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("Назва не може бути порожньою")
        return value


class DuplicateIn(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=80)


class ArtworkOut(BaseModel):
    id: int
    title: str
    kind: Literal["pixel", "image"]
    width: int
    height: int
    frame_count: int
    is_public: bool
    owner: str
    like_count: int
    liked_by_me: bool
    preview_url: str
    created_at: datetime
    updated_at: datetime


class ArtworkDetail(ArtworkOut):
    data: dict[str, Any] | None = None


class ArtworkPage(BaseModel):
    items: list[ArtworkOut]
    total: int
    limit: int
    offset: int


class LikeState(BaseModel):
    like_count: int
    liked_by_me: bool
