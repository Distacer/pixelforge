"""Публічна стрічка робіт."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query

from ..deps import DbSession, OptionalUser
from ..models import Artwork
from ..schemas import ArtworkPage
from ..services.artworks import SortMode, list_artworks

router = APIRouter(prefix="/api/gallery", tags=["gallery"])


@router.get("", response_model=ArtworkPage)
def public_gallery(
    db: DbSession,
    viewer: OptionalUser,
    sort: SortMode = "new",
    q: Annotated[str | None, Query(max_length=80)] = None,
    limit: Annotated[int, Query(ge=1, le=60)] = 24,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> ArtworkPage:
    """Усі публічні роботи. Якщо юзер залогінений — у відповіді є `liked_by_me`."""
    items, total = list_artworks(
        db,
        filters=[Artwork.is_public.is_(True)],
        viewer_id=viewer.id if viewer else None,
        sort=sort,
        q=q,
        limit=limit,
        offset=offset,
    )
    return ArtworkPage(items=items, total=total, limit=limit, offset=offset)
