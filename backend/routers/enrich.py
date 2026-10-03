"""Anreicherung der Bibliothek: fehlende/kaputte Cover finden, Reihen über externe Kataloge erkennen."""
import asyncio
import logging
import re
from typing import Optional

import httpx
from fastapi import APIRouter, Depends

from auth_utils import get_current_user
from database import db
from cover_store import ensure_cover
from genres import canonical
from jobs import create_job, finish_job, update_job
from models import User, now_iso
from routers.taxonomy import load_books, taxonomy_items
from sources import find_cover, find_series, url_is_image

logger = logging.getLogger("bookshelf.enrich")
router = APIRouter(prefix="/enrich", tags=["enrich"])

GOOGLE_CONTENT_RE = re.compile(r"books\.google\.com/books/content")


def needs_cover(book: dict) -> bool:
    url = book.get("cover_url")
    return not url or book.get("cover_checked") is False


async def fix_covers(user_id: str, job_id: Optional[str] = None, only_ids: Optional[set] = None) -> int:
    """Für alle Bücher ohne (oder mit verdächtigem Google-)Cover ein echtes Cover suchen."""
    books = await load_books(user_id)
    todo = [b for b in books if (only_ids is None or b["id"] in only_ids) and not b.get("cover_revision") and not b.get("cover_custom")]
    await update_job(job_id, phase="covers", total=len(todo), done=0)
    fixed = 0
    sem = asyncio.Semaphore(4)
    done = 0
    async with httpx.AsyncClient(timeout=15) as client:
        async def handle(book: dict):
            nonlocal fixed, done
            async with sem:
                try:
                    if await ensure_cover(book):
                        fixed += 1
                except Exception as exc:
                    logger.warning("cover lookup failed for %s: %s", book.get("title"), exc)
                done += 1
                if done % 3 == 0 or done == len(todo):
                    await update_job(job_id, done=done, covers_fixed=fixed)
        await asyncio.gather(*(handle(b) for b in todo))
    await update_job(job_id, done=len(todo), covers_fixed=fixed)
    return fixed


async def detect_series(user_id: str, job_id: Optional[str] = None, only_ids: Optional[set] = None) -> int:
    """Reihe für Bücher ohne Reihe bestimmen – über Titel, DNB-Katalog und Google Books (nicht nur die eigene Bibliothek)."""
    books = await load_books(user_id)
    todo = [b for b in books if (only_ids is None or b["id"] in only_ids) and not b.get("series_name") and not b.get("series_checked")]
    await update_job(job_id, phase="series", total=len(todo), done=0)
    existing = [i["name"] for i in await taxonomy_items(user_id, "series", books)]
    found_count = 0
    done = 0
    sem = asyncio.Semaphore(4)
    async with httpx.AsyncClient(timeout=15) as client:
        async def handle(book: dict):
            nonlocal found_count, done
            async with sem:
                try:
                    name, part = await find_series(client, book)
                    update = {"series_checked": True, "updated_at": now_iso()}
                    if name:
                        name = canonical(name, existing)
                        if name not in existing:
                            existing.append(name)
                        update["series_name"] = name
                        if part is not None:
                            update["series_part"] = part
                        found_count += 1
                    await db.books.update_one({"id": book["id"], "user_id": user_id, "series_name": {"$in": [None, ""]}}, {"$set": update})
                except Exception as exc:
                    logger.warning("series lookup failed for %s: %s", book.get("title"), exc)
                done += 1
                if done % 3 == 0 or done == len(todo):
                    await update_job(job_id, done=done, series_found=found_count)
        await asyncio.gather(*(handle(b) for b in todo))
    await update_job(job_id, done=len(todo), series_found=found_count)
    return found_count


async def run_enrich(kind: str, user_id: str, job_id: str):
    try:
        if kind in ("covers", "all"):
            await fix_covers(user_id, job_id)
        if kind in ("series", "all"):
            await detect_series(user_id, job_id)
        await finish_job(job_id)
    except Exception as exc:
        logger.exception("enrich failed")
        await finish_job(job_id, str(exc))


@router.post("/{kind}")
async def start_enrich(kind: str, user: User = Depends(get_current_user)):
    if kind not in ("covers", "series", "all"):
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Unbekannt")
    running = await db.jobs.find_one({"user_id": user.user_id, "kind": kind, "status": "running"}, {"_id": 0, "id": 1})
    if running:
        return {"job_id": running["id"]}
    if kind == "series":  # erneut prüfen lassen → Markierung zurücksetzen
        await db.books.update_many({"user_id": user.user_id, "series_name": None}, {"$unset": {"series_checked": ""}})
    job_id = await create_job(user.user_id, kind)
    asyncio.create_task(run_enrich(kind, user.user_id, job_id))
    return {"job_id": job_id}
