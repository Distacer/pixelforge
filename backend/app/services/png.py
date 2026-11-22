"""Мінімальна робота з PNG без Pillow: перевірка сигнатури, розмір із заголовка IHDR.

Структура початку PNG-файлу:
    8 байт   сигнатура  89 50 4E 47 0D 0A 1A 0A
    4 байти  довжина першого чанку (13)
    4 байти  тип чанку "IHDR"
    4 байти  ширина  (big-endian)
    4 байти  висота  (big-endian)
"""

from __future__ import annotations

import base64
import binascii
import struct

PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


class InvalidPng(ValueError):
    pass


def read_png_size(data: bytes) -> tuple[int, int]:
    if len(data) < 24 or not data.startswith(PNG_SIGNATURE) or data[12:16] != b"IHDR":
        raise InvalidPng("Файл не є коректним PNG")
    width, height = struct.unpack(">II", data[16:24])
    if width == 0 or height == 0:
        raise InvalidPng("PNG має нульовий розмір")
    return width, height


def decode_png_base64(value: str) -> bytes:
    """Приймає чистий base64 або data URL і повертає байти PNG."""
    if value.startswith("data:"):
        header, _, value = value.partition(",")
        if "image/png" not in header:
            raise InvalidPng("Очікувався data:image/png")
    try:
        raw = base64.b64decode(value, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise InvalidPng("Некоректний base64") from exc
    read_png_size(raw)  # валідація
    return raw
