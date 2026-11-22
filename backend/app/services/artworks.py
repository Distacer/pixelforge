"""Запити до робіт, що використовуються кількома роутерами."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal

from fastapi import HTTPException, status
from sqlalchemy import ColumnElement, false, func, select
from sqlalchemy.orm import Session

from ..models import Artwork, Like, User
from ..schemas import ArtworkDetail, ArtworkOut, LikeState

SortMode = Literal["new", "popular", "updated"]


def as_utc(value: datetime) -> datetime:
    # SQLite повертає naive datetime — вважаємо його UTC
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def preview_url(artwork: Artwork) -> str:
    version = int(as_utc(artwork.updated_at).timestamp())
    return f"/api/artworks/{artwork.id}/preview.png?v={version}"


def _like_count():
    return (
        select(func.count(Like.user_id))
        .where(Like.artwork_id == Artwork.id)
        .correlate(Artwork)
        .scalar_subquery()
    )


def _liked_by(user_id: int | None):
    if user_id is None:
        return false()
    return (
        select(Like.user_id)
        .where(Like.artwork_id == Artwork.id, Like.user_id == user_id)
        .correlate(Artwork)
        .exists()
    )


def to_out(artwork: Artwork, owner: str, like_count: int, liked: bool) -> ArtworkOut:
    return ArtworkOut(
        id=artwork.id,
        title=artwork.title,
        kind=artwork.kind,  # type: ignore[arg-type]
        width=artwork.width,
        height=artwork.height,
        frame_count=artwork.frame_count,
        is_public=artwork.is_public,
        owner=owner,
        like_count=int(like_count or 0),
        liked_by_me=bool(liked),
        preview_url=preview_url(artwork),
        created_at=as_utc(artwork.created_at),
        updated_at=as_utc(artwork.updated_at),
    )


def list_artworks(
    db: Session,
    *,
    filters: list[ColumnElement[bool]],
    viewer_id: int | None,
    sort: SortMode = "new",
    q: str | None = None,
    limit: int = 24,
    offset: int = 0,
) -> tuple[list[ArtworkOut], int]:
    conditions = list(filters)
    if q:
        conditions.append(Artwork.title.ilike(f"%{q.strip()}%"))

    like_count = _like_count().label("like_count")
    liked = _liked_by(viewer_id).label("liked_by_me")

    stmt = (
        select(Artwork, User.username, like_count, liked)
        .join(User, Artwork.owner_id == User.id)
        .where(*conditions)
    )

    if sort == "popular":
        stmt = stmt.order_by(like_count.desc(), Artwork.created_at.desc())
    elif sort == "updated":
        stmt = stmt.order_by(Artwork.updated_at.desc())
    else:
        stmt = stmt.order_by(Artwork.created_at.desc(), Artwork.id.desc())

    total = db.scalar(
        select(func.count(Artwork.id)).join(User, Artwork.owner_id == User.id).where(*conditions)
    )
    rows = db.execute(stmt.limit(limit).offset(offset)).all()
    items = [to_out(a, owner, count, is_liked) for a, owner, count, is_liked in rows]
    return items, int(total or 0)


def like_state(db: Session, artwork_id: int, viewer_id: int | None) -> LikeState:
    count = db.scalar(select(func.count(Like.user_id)).where(Like.artwork_id == artwork_id)) or 0
    liked = False
    if viewer_id is not None:
        liked = db.get(Like, (viewer_id, artwork_id)) is not None
    return LikeState(like_count=int(count), liked_by_me=liked)


def to_detail(db: Session, artwork: Artwork, viewer_id: int | None) -> ArtworkDetail:
    import json

    state = like_state(db, artwork.id, viewer_id)
    base = to_out(artwork, artwork.owner.username, state.like_count, state.liked_by_me)
    data = json.loads(artwork.data) if artwork.data else None
    return ArtworkDetail(**base.model_dump(), data=data)


def get_visible_artwork(db: Session, artwork_id: int, viewer: User | None) -> Artwork:
    """Робота, яку може бачити користувач: публічна або власна. Інакше — 404."""
    artwork = db.get(Artwork, artwork_id)
    if artwork is None or not (artwork.is_public or (viewer and artwork.owner_id == viewer.id)):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Роботу не знайдено")
    return artwork


def get_owned_artwork(db: Session, artwork_id: int, viewer: User) -> Artwork:
    artwork = get_visible_artwork(db, artwork_id, viewer)
    if artwork.owner_id != viewer.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Це не ваша робота")
    return artwork
