"""ORM-моделі: користувачі, роботи, лайки."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    LargeBinary,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # Нік так, як його ввів користувач (для відображення)
    username: Mapped[str] = mapped_column(String(24), nullable=False)
    # Нормалізований нік (casefold) — саме по ньому перевіряється унікальність.
    # Робимо це в Python, бо lower() у SQLite не вміє кирилицю: "Іван" і "іван" були б різними.
    username_key: Mapped[str] = mapped_column(String(48), nullable=False, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    artworks: Mapped[list[Artwork]] = relationship(
        back_populates="owner", cascade="all, delete-orphan", passive_deletes=True
    )


def username_key(username: str) -> str:
    """ "Ivan", "IVAN" та "ivan" — один і той самий акаунт."""
    return username.strip().casefold()


class Artwork(Base):
    __tablename__ = "artworks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    owner_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    title: Mapped[str] = mapped_column(String(80), nullable=False)

    # "pixel" — редагований документ; "image" — завантажений PNG
    kind: Mapped[str] = mapped_column(String(10), nullable=False, default="pixel")

    width: Mapped[int] = mapped_column(Integer, nullable=False)
    height: Mapped[int] = mapped_column(Integer, nullable=False)
    frame_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    # JSON документа редактора (шари, кадри, палітра). Для kind="image" — NULL.
    # deferred=True: не тягнемо великі поля, коли показуємо список
    data: Mapped[str | None] = mapped_column(Text, nullable=True, deferred=True)
    preview_png: Mapped[bytes] = mapped_column(LargeBinary, nullable=False, deferred=True)

    is_public: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    owner: Mapped[User] = relationship(back_populates="artworks")
    likes: Mapped[list[Like]] = relationship(
        back_populates="artwork", cascade="all, delete-orphan", passive_deletes=True
    )


class Like(Base):
    __tablename__ = "likes"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    artwork_id: Mapped[int] = mapped_column(
        ForeignKey("artworks.id", ondelete="CASCADE"), primary_key=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    artwork: Mapped[Artwork] = relationship(back_populates="likes")
