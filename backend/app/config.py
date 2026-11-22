"""Налаштування застосунку. Усе читається зі змінних оточення (див. .env.example)."""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DEFAULT_SECRET = "dev-secret-change-me"

log = logging.getLogger("pixelforge")


def _csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    app_name: str = "Pixelforge API"

    # SQLite-файл за замовчуванням лежить у backend/data/pixelforge.db
    database_url: str = os.getenv(
        "DATABASE_URL", f"sqlite:///{(BASE_DIR / 'data' / 'pixelforge.db').as_posix()}"
    )

    # JWT
    jwt_secret: str = os.getenv("JWT_SECRET", DEFAULT_SECRET)
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = int(os.getenv("JWT_EXPIRE_MINUTES", str(60 * 24 * 7)))

    # Звідки фронтенд може робити запити в режимі розробки
    cors_origins: list[str] = field(
        default_factory=lambda: _csv(
            os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
        )
    )

    # Обмеження на файли
    max_upload_bytes: int = int(os.getenv("MAX_UPLOAD_BYTES", str(2 * 1024 * 1024)))
    max_image_side: int = int(os.getenv("MAX_IMAGE_SIDE", "2048"))
    max_doc_bytes: int = int(os.getenv("MAX_DOC_BYTES", str(3 * 1024 * 1024)))


settings = Settings()

if settings.jwt_secret == DEFAULT_SECRET:
    log.warning("JWT_SECRET не задано — використовується dev-ключ. Не робіть так у продакшені.")
