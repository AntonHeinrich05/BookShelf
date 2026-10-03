"""Bounded parallel catalogue search with source-level status and genuine pagination."""
import asyncio
import hashlib
import re
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from rapidfuzz import fuzz

from auth_utils import get_current_user
from database import db
from models import User
from sources import clean_isbn, dnb_search_text, find_cover, google_search, open_library_search

router = APIRouter(prefix="/search", tags=["search"])
PAGE_SIZE = 20
_inflight = {}


def norm(text):
    return re.sub(r"[^\w]", "", (text or "").casefold())


def item_key(item):
    isbn = clean_isbn(item.get("isbn"))
    if isbn:
        if len(isbn) == 10:
            base = "978" + isbn[:9]
            isbn = base + str((-sum(int(n) * (1 if i % 2 == 0 else 3) for i, n in enumerate(base))) % 10)
        return f"isbn:{isbn}"
    return f"{norm(item['title'])}:{norm(' '.join(item.get('authors') or []))}:{item.get('published_year')}"


def merge_into(base, other):
    for key in ("cover_url", "page_count", "description", "publisher", "published_year", "isbn", "series_name", "series_part", "subtitle"):
        if base.get(key) in (None, "") and other.get(key) not in (None, ""):
            base[key] = other[key]
    if not base.get("categories"):
        base["categories"] = other.get("categories") or []
    base["sources"] = list(dict.fromkeys([*base.get("sources", []), other["source"]]))


def relevance(q, item, lang):
    if clean_isbn(q) and item.get("isbn") == clean_isbn(q):
        return 200
    hay = f"{item['title']} {item.get('subtitle') or ''} {' '.join(item.get('authors') or [])}".casefold()
    score = fuzz.WRatio(q.casefold(), hay)
    score += 12 if item.get("language") == (lang or "de") else 0
    return score + (3 if item.get("cover_url") else 0)


async def run_search(q, lang, start):
    async with httpx.AsyncClient(timeout=httpx.Timeout(4.5, connect=2), headers={"User-Agent": "BookShelf/3.0 (personal reading tracker)"}) as client:
        calls = {"google": google_search(client, q, lang, start),
                 "openlibrary": open_library_search(client, q, lang, start),
                 "dnb": dnb_search_text(client, q, lang, start)}
        async def bounded(coro):
            try:
                return await asyncio.wait_for(coro, timeout=5)
            except Exception:
                return None
        results = await asyncio.gather(*(bounded(c) for c in calls.values()))
    merged, sources, failed = {}, {}, []
    for name, page in zip(calls, results):
        if page is None:
            failed.append(name)
            sources[name] = {"status": "unavailable", "total": 0, "has_more": False}
            continue
        sources[name] = {"status": "ok", "total": getattr(page, "total", len(page)), "has_more": getattr(page, "has_more", False)}
        for item in page:
            key = item_key(item)
            if key in merged:
                merge_into(merged[key], item)
            else:
                merged[key] = {**item, "sources": [name], "result_key": key}
    if len(failed) == len(calls):
        raise HTTPException(502, "Die Buchkataloge sind gerade nicht erreichbar. Bitte erneut versuchen.")
    items = sorted(merged.values(), key=lambda i: (-relevance(q, i, lang), i["result_key"]))
    # Totals are estimates across catalogues, never advertised as exact unique book counts.
    has_more = any(s["has_more"] for s in sources.values())
    return {"items": items, "total": sum(s["total"] for s in sources.values()), "total_is_estimate": True,
            "has_more": has_more, "next_start": start + PAGE_SIZE if has_more else None,
            "sources": sources, "degraded_sources": failed, "source": "merged"}


async def cached_search(q, lang, start):
    key = hashlib.sha256(f"v4:{q.casefold()}:{lang}:{start}".encode()).hexdigest()
    now = datetime.now(timezone.utc)
    cached = await db.search_cache.find_one({"key": key, "valid_until": {"$gt": now}}, {"_id": 0, "result": 1})
    if cached:
        return cached["result"]
    if key not in _inflight:
        _inflight[key] = asyncio.create_task(run_search(q, lang, start))
    task = _inflight[key]
    try:
        result = await asyncio.shield(task)
        ttl = 45 if result["degraded_sources"] else 3600 if not result["items"] else 24 * 3600
        await db.search_cache.update_one({"key": key}, {"$set": {"result": result, "created_at": now, "valid_until": now + timedelta(seconds=ttl)}}, upsert=True)
        return result
    finally:
        if task.done():
            _inflight.pop(key, None)


@router.get("")
async def search_books(q: str = Query(min_length=1, max_length=200), lang: Optional[str] = Query(None, pattern="^(de|en)$"),
                       start: int = Query(0, ge=0, le=100000), user: User = Depends(get_current_user)):
    q = " ".join(q.split())
    if not q:
        raise HTTPException(422, "Bitte einen Suchbegriff eingeben")
    return await cached_search(q, lang, start)


@router.get("/cover")
async def search_cover(title: str = Query(min_length=1, max_length=200), author: Optional[str] = None,
                       isbn: Optional[str] = None, google_id: Optional[str] = None, user: User = Depends(get_current_user)):
    async with httpx.AsyncClient(timeout=5) as client:
        try:
            url = await asyncio.wait_for(find_cover(client, title, [author] if author else [], isbn, google_id), 12)
        except asyncio.TimeoutError:
            url = None
    return {"cover_url": url}