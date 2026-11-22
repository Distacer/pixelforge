"""Профілі користувачів."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Response, status
from sqlalchemy import func, select

from ..deps import CurrentUser, DbSession, OptionalUser
from ..models import Artwork, Like, User, username_key
from ..schemas import ArtworkPage, PublicProfileOut, UserOut
from ..services.artworks import SortMode, as_utc, list_artworks

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/me", response_model=UserOut)
def me(user: CurrentUser) -> User:
    return user


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_me(user: CurrentUser, db: DbSession) -> Response:
    """Видаляє акаунт разом з усіма роботами та лайками."""
    db.delete(user)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _get_by_username(db: DbSession, username: str) -> User:
    user = db.scalar(select(User).where(User.username_key == username_key(username)))
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Користувача не знайдено")
    return user


@router.get("/{username}", response_model=PublicProfileOut)
def profile(username: str, db: DbSession) -> PublicProfileOut:
    user = _get_by_username(db, username)
    public_count = db.scalar(
        select(func.count(Artwork.id)).where(Artwork.owner_id == user.id, Artwork.is_public)
    )
    total_likes = db.scalar(
        select(func.count(Like.user_id))
        .join(Artwork, Like.artwork_id == Artwork.id)
        .where(Artwork.owner_id == user.id, Artwork.is_public)
    )
    return PublicProfileOut(
        username=user.username,
        created_at=as_utc(user.created_at),
        public_artworks=int(public_count or 0),
        total_likes=int(total_likes or 0),
    )


@router.get("/{username}/artworks", response_model=ArtworkPage)
def profile_artworks(
    username: str,
    db: DbSession,
    viewer: OptionalUser,
    sort: SortMode = "new",
    limit: Annotated[int, Query(ge=1, le=60)] = 24,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> ArtworkPage:
    user = _get_by_username(db, username)
    items, total = list_artworks(
        db,
        filters=[Artwork.owner_id == user.id, Artwork.is_public.is_(True)],
        viewer_id=viewer.id if viewer else None,
        sort=sort,
        limit=limit,
        offset=offset,
    )
    return ArtworkPage(items=items, total=total, limit=limit, offset=offset)
