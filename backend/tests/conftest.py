"""Спільні фікстури. Кожен тест отримує чисту базу в тимчасовому файлі."""

from __future__ import annotations

import base64
import os
import struct
import tempfile
import zlib
from pathlib import Path

import pytest

_TMP = Path(tempfile.mkdtemp(prefix="pixelforge-test-"))
os.environ["DATABASE_URL"] = f"sqlite:///{(_TMP / 'test.db').as_posix()}"
os.environ["JWT_SECRET"] = "test-secret"

from fastapi.testclient import TestClient  # noqa: E402

from app.database import Base, engine  # noqa: E402
from app.main import app  # noqa: E402


def make_png(width: int = 2, height: int = 2) -> bytes:
    """Генерує валідний RGBA PNG без Pillow."""

    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    row = b"\x00" + b"\xff\x00\x00\xff" * width
    idat = zlib.compress(row * height)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")


def png_b64(width: int = 2, height: int = 2) -> str:
    return "data:image/png;base64," + base64.b64encode(make_png(width, height)).decode()


@pytest.fixture()
def client():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture()
def register(client):
    def _register(username: str = "ivan", password: str = "secret123") -> dict[str, str]:
        res = client.post("/api/auth/register", json={"username": username, "password": password})
        assert res.status_code == 201, res.text
        return {"Authorization": f"Bearer {res.json()['access_token']}"}

    return _register


def pixel_payload(title: str = "Котик", is_public: bool = False) -> dict:
    return {
        "title": title,
        "width": 2,
        "height": 2,
        "frame_count": 1,
        "is_public": is_public,
        "data": {"version": 1, "width": 2, "height": 2, "layers": [], "frames": []},
        "preview_png": png_b64(),
    }
