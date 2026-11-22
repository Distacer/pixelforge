"""Роботи: CRUD, завантаження PNG, прев'ю, лайки."""

from __future__ import annotations

import json
from typing import Annotated

from fastapi import (
    APIRouter,
    File,
    Form,
    HTTPException,
    Query,
    Request,
    Response,
    UploadFile,
    status,
)

from ..config import settings
from ..deps import CurrentUser, DbSession, OptionalUser
from ..models import Artwork, Like
from ..schemas import (
    ArtworkCreate,
    ArtworkDetail,
    ArtworkOut,
    ArtworkPage,
    ArtworkUpdate,
    DuplicateIn,
    LikeState,
)
from ..services.artworks import (
    SortMode,
    as_utc,
    get_owned_artwork,
    get_visible_artwork,
    like_state,
    list_artworks,
    to_detail,
    to_out,
)
from ..services.png import InvalidPng, decode_png_base64, read_png_size

router = APIRouter(prefix="/api/artworks", tags=["artworks"])


def _dump_doc(data: dict) -> str:
    raw = json.dumps(data, separators=(",", ":"), ensure_ascii=False)
    if len(raw.encode("utf-8")) > settings.max_doc_bytes:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Документ завеликий")
    return raw


def _decode_preview(value: str) -> bytes:
    try:
        png = decode_png_base64(value)
    except InvalidPng as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc
    if len(png) > settings.max_upload_bytes:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Прев'ю завелике")
    return png


# ---------- Мої роботи ----------


@router.get("/mine", response_model=ArtworkPage)
def my_artworks(
    db: DbSession,
    user: CurrentUser,
    sort: SortMode = "updated",
    q: Annotated[str | None, Query(max_length=80)] = None,
    limit: Annotated[int, Query(ge=1, le=60)] = 24,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> ArtworkPage:
    items, total = list_artworks(
        db,
        filters=[Artwork.owner_id == user.id],
        viewer_id=user.id,
        sort=sort,
        q=q,
        limit=limit,
        offset=offset,
    )
    return ArtworkPage(items=items, total=total, limit=limit, offset=offset)


@router.post("", response_model=ArtworkDetail, status_code=status.HTTP_201_CREATED)
def create_artwork(body: ArtworkCreate, db: DbSession, user: CurrentUser) -> ArtworkDetail:
    """Зберігає піксель-арт з редактора."""
    artwork = Artwork(
        owner_id=user.id,
        title=body.title,
        kind="pixel",
        width=body.width,
        height=body.height,
        frame_count=body.frame_count,
        data=_dump_doc(body.data),
        preview_png=_decode_preview(body.preview_png),
        is_public=body.is_public,
    )
    db.add(artwork)
    db.commit()
    db.refresh(artwork)
    return to_detail(db, artwork, user.id)


@router.post("/upload", response_model=ArtworkOut, status_code=status.HTTP_201_CREATED)
async def upload_png(
    db: DbSession,
    user: CurrentUser,
    file: Annotated[UploadFile, File(description="PNG-файл")],
    title: Annotated[str, Form(min_length=1, max_length=80)],
    is_public: Annotated[bool, Form()] = False,
) -> ArtworkOut:
    """Завантажує готовий PNG як роботу типу "image" (без редагування)."""
    raw = await file.read(settings.max_upload_bytes + 1)
    if len(raw) > settings.max_upload_bytes:
        limit_mb = settings.max_upload_bytes / 1024 / 1024
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, f"Файл більший за {limit_mb:.0f} МБ"
        )
    try:
        width, height = read_png_size(raw)
    except InvalidPng as exc:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, str(exc)) from exc
    if max(width, height) > settings.max_image_side:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"Максимальна сторона зображення — {settings.max_image_side} px",
        )

    clean_title = title.strip() or "Без назви"
    artwork = Artwork(
        owner_id=user.id,
        title=clean_title,
        kind="image",
        width=width,
        height=height,
        frame_count=1,
        data=None,
        preview_png=raw,
        is_public=is_public,
    )
    db.add(artwork)
    db.commit()
    db.refresh(artwork)
    return to_out(artwork, user.username, 0, False)


# ---------- Одна робота ----------


@router.get("/{artwork_id}", response_model=ArtworkDetail)
def get_artwork(artwork_id: int, db: DbSession, viewer: OptionalUser) -> ArtworkDetail:
    artwork = get_visible_artwork(db, artwork_id, viewer)
    return to_detail(db, artwork, viewer.id if viewer else None)


@router.patch("/{artwork_id}", response_model=ArtworkDetail)
def update_artwork(
    artwork_id: int, body: ArtworkUpdate, db: DbSession, user: CurrentUser
) -> ArtworkDetail:
    artwork = get_owned_artwork(db, artwork_id, user)
    changes = body.model_dump(exclude_unset=True)

    if artwork.kind == "image" and ({"data", "width", "height", "frame_count"} & changes.keys()):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Завантажене зображення не можна редагувати — імпортуйте його в редактор",
        )

    if "data" in changes and changes["data"] is not None:
        artwork.data = _dump_doc(changes.pop("data"))
    if "preview_png" in changes and changes["preview_png"] is not None:
        artwork.preview_png = _decode_preview(changes.pop("preview_png"))
    for field in ("title", "width", "height", "frame_count", "is_public"):
        if changes.get(field) is not None:
            setattr(artwork, field, changes[field])

    db.commit()
    db.refresh(artwork)
    return to_detail(db, artwork, user.id)


@router.delete("/{artwork_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_artwork(artwork_id: int, db: DbSession, user: CurrentUser) -> Response:
    artwork = get_owned_artwork(db, artwork_id, user)
    db.delete(artwork)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{artwork_id}/duplicate", response_model=ArtworkDetail, status_code=status.HTTP_201_CREATED
)
def duplicate_artwork(
    artwork_id: int, db: DbSession, user: CurrentUser, body: DuplicateIn | None = None
) -> ArtworkDetail:
    """Копія власної роботи або «ремікс» чужої публічної — копія завжди приватна."""
    source = get_visible_artwork(db, artwork_id, user)
    copy = Artwork(
        owner_id=user.id,
        title=(body.title if body and body.title else f"{source.title} (копія)")[:80],
        kind=source.kind,
        width=source.width,
        height=source.height,
        frame_count=source.frame_count,
        data=source.data,
        preview_png=source.preview_png,
        is_public=False,
    )
    db.add(copy)
    db.commit()
    db.refresh(copy)
    return to_detail(db, copy, user.id)


@router.get(
    "/{artwork_id}/preview.png",
    response_class=Response,
    responses={200: {"content": {"image/png": {}}}},
)
def artwork_preview(
    artwork_id: int, request: Request, db: DbSession, viewer: OptionalUser
) -> Response:
    artwork = get_visible_artwork(db, artwork_id, viewer)
    etag = f'"{artwork.id}-{int(as_utc(artwork.updated_at).timestamp())}"'
    cache = "public, max-age=86400" if artwork.is_public else "private, no-cache"
    if request.headers.get("if-none-match") == etag:
        return Response(status_code=status.HTTP_304_NOT_MODIFIED, headers={"ETag": etag})
    return Response(
        content=artwork.preview_png,
        media_type="image/png",
        headers={"ETag": etag, "Cache-Control": cache},
    )


# ---------- Лайки ----------


@router.post("/{artwork_id}/like", response_model=LikeState)
def like(artwork_id: int, db: DbSession, user: CurrentUser) -> LikeState:
    artwork = get_visible_artwork(db, artwork_id, user)
    if db.get(Like, (user.id, artwork.id)) is None:
        db.add(Like(user_id=user.id, artwork_id=artwork.id))
        db.commit()
    return like_state(db, artwork.id, user.id)


@router.delete("/{artwork_id}/like", response_model=LikeState)
def unlike(artwork_id: int, db: DbSession, user: CurrentUser) -> LikeState:
    artwork = get_visible_artwork(db, artwork_id, user)
    existing = db.get(Like, (user.id, artwork.id))
    if existing is not None:
        db.delete(existing)
        db.commit()
    return like_state(db, artwork.id, user.id)
