"""Private, durable, bounded cover storage. No dependence on a server's local disk."""
import asyncio
import hashlib
import io
import logging
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse, urljoin
from weakref import WeakValueDictionary

import httpx
from bson import Binary
from PIL import Image, ImageOps, ImageStat, UnidentifiedImageError

from database import db
from models import now_iso

logger = logging.getLogger("bookshelf.covers")
MAX_UPLOAD = 8 * 1024 * 1024
MAX_STORED = 150 * 1024
HOSTS = {"books.google.com", "books.google.de", "books.googleusercontent.com",
         "covers.openlibrary.org", "portal.dnb.de", "d-nb.info", "services.dnb.de",
         "images-na.ssl-images-amazon.com", "images-eu.ssl-images-amazon.com", "m.media-amazon.com"}
_locks = WeakValueDictionary()
_downloads = asyncio.Semaphore(6)


def cover_path(book: dict) -> str:
    return f"/api/covers/{book['id']}?v={book.get('cover_revision') or 'original'}"


def safe_url(url: str) -> bool:
    try:
        p = urlparse(url)
        return p.scheme == "https" and p.hostname in HOSTS and p.port in (None, 443) and not p.username and not p.password
    except (ValueError, TypeError):
        return False


def compress_image(data: bytes, custom: bool = False) -> bytes:
    if not data or len(data) > MAX_UPLOAD:
        raise ValueError("Bild ist zu groß (maximal 8 MB)")
    try:
        with Image.open(io.BytesIO(data)) as source:
            if source.width * source.height > 24_000_000:
                raise ValueError("Bild ist zu groß (maximal 24 Megapixel)")
            if source.width < 20 or source.height < 20:
                raise ValueError("Kein gültiges Coverbild")
            image = ImageOps.exif_transpose(source).convert("RGB")
            image.thumbnail((400, 600), Image.Resampling.LANCZOS)
            # Blank catalogue responses are not covers. User artwork is always respected.
            if not custom and max(ImageStat.Stat(image).stddev) < 3:
                raise ValueError("Leeres Katalogbild")
            for quality in (86, 76, 65, 50, 35):
                out = io.BytesIO()
                image.save(out, "JPEG", quality=quality, optimize=True)
                if out.tell() <= MAX_STORED:
                    return out.getvalue()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise ValueError("Bitte ein gültiges JPG-, PNG- oder WebP-Bild auswählen") from exc
    raise ValueError("Bild konnte nicht verkleinert werden")


async def download_image(client: httpx.AsyncClient, url: str):
    """Validate every redirect, stream with an enforced byte budget, decode off-loop."""
    if not safe_url(url):
        return None
    cached = await db.cover_previews.find_one({"url_hash": hashlib.sha256(url.encode()).hexdigest()}, {"_id": 0, "data": 1})
    if cached and cached.get("data"):
        return bytes(cached["data"])
    try:
        for _ in range(4):
            if not safe_url(url):
                return None
            async with client.stream("GET", url, follow_redirects=False, timeout=5,
                                     headers={"User-Agent": "BookShelf/3.0", "Referer": ""}) as res:
                if res.is_redirect:
                    url = urljoin(url, res.headers.get("location", ""))
                    continue
                if res.status_code != 200 or not res.headers.get("content-type", "").startswith("image/"):
                    return None
                data = bytearray()
                async for chunk in res.aiter_bytes():
                    data.extend(chunk)
                    if len(data) > MAX_UPLOAD:
                        return None
                return await asyncio.to_thread(compress_image, bytes(data))
    except (httpx.HTTPError, ValueError):
        return None
    return None


async def store_cover(book: dict, data: bytes, custom: bool = False) -> dict:
    revision = hashlib.sha256(data).hexdigest()[:24]
    key = {"user_id": book["user_id"], "book_id": book["id"], "revision": revision}
    await db.covers.update_one(key, {"$setOnInsert": {**key, "data": Binary(data), "created_at": now_iso()}}, upsert=True)
    fields = {"cover_revision": revision, "cover_url": f"/api/covers/{book['id']}?v={revision}",
              "cover_custom": custom, "cover_checked": True, "updated_at": now_iso()}
    selector = {"id": book["id"], "user_id": book["user_id"]}
    if not custom:
        selector.update({"cover_custom": {"$ne": True}, "cover_revision": book.get("cover_revision")})
    await db.books.update_one(selector, {"$set": fields})
    # Return current reference, never an outdated auto result after a concurrent upload.
    current = await db.books.find_one({"id": book["id"], "user_id": book["user_id"]}, {"_id": 0})
    return current or book


async def ensure_cover(book: dict, discover: bool = True):
    """Migrate lazily once; failed sources back off, custom covers are never replaced."""
    key = book["id"]
    lock = _locks.setdefault(key, asyncio.Lock())
    async with lock:
        book = await db.books.find_one({"id": key, "user_id": book["user_id"]}, {"_id": 0})
        if not book:
            return None
        if book.get("cover_revision"):
            saved = await db.covers.find_one({"book_id": key, "user_id": book["user_id"], "revision": book["cover_revision"]}, {"_id": 0})
            if saved:
                return saved
        if book.get("cover_custom"):
            return None
        retry = book.get("cover_retry_after")
        if retry and retry > now_iso():
            return None
        async with _downloads, httpx.AsyncClient(timeout=5) as client:
            url = book.get("cover_url") or ""
            data = await download_image(client, url) if safe_url(url) else None
            if not data and discover:
                from sources import clean_isbn, find_cover
                isbn = clean_isbn(book.get("isbn"))
                candidates = [f"https://portal.dnb.de/opac/mvb/cover?isbn={isbn}",
                              f"https://covers.openlibrary.org/b/isbn/{isbn}-M.jpg?default=false"] if isbn else []
                for candidate in candidates:
                    if candidate != url:
                        data = await download_image(client, candidate)
                        if data:
                            break
                if not data:
                    try:
                        found = await asyncio.wait_for(find_cover(client, book["title"], book.get("authors") or [], None, book.get("google_id")), 7)
                        if found:
                            data = await download_image(client, found)
                    except asyncio.TimeoutError:
                        pass
            if data:
                current = await store_cover(book, data)
                return await db.covers.find_one({"book_id": key, "user_id": book["user_id"], "revision": current.get("cover_revision")}, {"_id": 0})
            retry_after = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
            await db.books.update_one({"id": key, "user_id": book["user_id"], "cover_custom": {"$ne": True}},
                                      {"$set": {"cover_retry_after": retry_after, "cover_checked": True}})
            return None


async def prepare_cover(book: dict):
    try:
        await ensure_cover(book)
    except Exception:
        logger.exception("Cover konnte nicht gespeichert werden: %s", book.get("id"))