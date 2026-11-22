"""Точка входу FastAPI.

Запуск у режимі розробки (з папки backend/):
    uvicorn app.main:app --reload
Документація API: http://localhost:8000/api/docs
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import __version__
from .config import settings
from .database import init_db
from .routers import artworks, auth, gallery, users


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    init_db()
    yield


app = FastAPI(
    title=settings.app_name,
    version=__version__,
    description="REST API піксель-арт студії Pixelforge: акаунти, роботи, публічна галерея.",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url=None,
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(artworks.router)
app.include_router(gallery.router)


@app.get("/api/health", tags=["meta"])
def health() -> dict[str, str]:
    return {"status": "ok", "version": __version__}
