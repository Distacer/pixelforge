"""Підключення до SQLite через SQLAlchemy 2.0."""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

from sqlalchemy import Engine, create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import settings


class Base(DeclarativeBase):
    """Базовий клас для всіх ORM-моделей."""


def _make_engine(url: str) -> Engine:
    is_sqlite = url.startswith("sqlite")
    connect_args: dict = {}

    if is_sqlite:
        # FastAPI обробляє запити в різних потоках — дозволяємо це SQLite
        connect_args["check_same_thread"] = False
        db_path = url.removeprefix("sqlite:///")
        if db_path and db_path != ":memory:":
            Path(db_path).parent.mkdir(parents=True, exist_ok=True)

    engine = create_engine(url, connect_args=connect_args)

    if is_sqlite:

        @event.listens_for(engine, "connect")
        def _sqlite_pragmas(dbapi_connection, _record) -> None:  # pragma: no cover - тривіально
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")  # каскадне видалення
            cursor.execute("PRAGMA journal_mode=WAL")  # паралельне читання під час запису
            cursor.close()

    return engine


engine = _make_engine(settings.database_url)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    """FastAPI-залежність: одна сесія на запит."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Створює таблиці, якщо їх ще немає."""
    from . import models  # noqa: F401  — реєструє моделі в Base.metadata

    Base.metadata.create_all(bind=engine)
