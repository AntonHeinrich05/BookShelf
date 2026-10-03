import asyncio
import hashlib
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, Response, UploadFile
import httpx
from bson import Binary
from auth_utils import get_current_user
from cover_store import MAX_UPLOAD, compress_image, download_image, ensure_cover, safe_url, store_cover
from database import db
from models import User
from routers.books import get_owned_book, with_time

router = APIRouter(tags=["covers"])
preview_downloads = asyncio.Semaphore(6)


@router.get("/cover-preview")
async def cover_preview(url: str = Query(max_length=4096), user: User = Depends(get_current_user)):
    if not safe_url(url):
        raise HTTPException(400, "Diese Coverquelle wird nicht unterstützt")
    key = hashlib.sha256(url.encode()).hexdigest()
    cached = await db.cover_previews.find_one({"url_hash": key}, {"_id": 0})
    if cached and not cached.get("data"):
        raise HTTPException(404, "Kein Cover verfügbar")
    data = bytes(cached["data"]) if cached else None
    if not data:
        async with preview_downloads, httpx.AsyncClient(timeout=5) as client:
            data = await download_image(client, url)
        await db.cover_previews.update_one({"url_hash": key}, {"$set": {"data": Binary(data) if data else None, "created_at": datetime.now(timezone.utc)}}, upsert=True)
    if not data:
        raise HTTPException(404, "Kein Cover verfügbar", headers={"Cache-Control": "no-store"})
    return Response(data, media_type="image/jpeg", headers={"Cache-Control": "private, max-age=604800", "X-Content-Type-Options": "nosniff"})


@router.get("/covers/{book_id}")
async def get_cover(book_id: str, request: Request, user: User = Depends(get_current_user)):
    book = await get_owned_book(book_id, user.user_id)
    cover = await ensure_cover(book)
    if not cover:
        raise HTTPException(404, "Kein Cover verfügbar", headers={"Cache-Control": "no-store"})
    etag = f'"{cover["revision"]}"'
    headers = {"Cache-Control": "private, max-age=31536000, immutable" if request.query_params.get("v") == cover["revision"] else "private, max-age=3600",
               "ETag": etag, "Vary": "Authorization, Cookie", "X-Content-Type-Options": "nosniff"}
    if request.headers.get("if-none-match") == etag:
        return Response(status_code=304, headers=headers)
    return Response(content=bytes(cover["data"]), media_type="image/jpeg", headers=headers)


@router.post("/books/{book_id}/cover")
async def upload_cover(book_id: str, file: UploadFile = File(...), user: User = Depends(get_current_user)):
    book = await get_owned_book(book_id, user.user_id)
    data = await file.read(MAX_UPLOAD + 1)
    if len(data) > MAX_UPLOAD:
        raise HTTPException(413, "Bild ist zu groß (maximal 8 MB)")
    try:
        image = await asyncio.to_thread(compress_image, data, True)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    return with_time(await store_cover(book, image, custom=True))