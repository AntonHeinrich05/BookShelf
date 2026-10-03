"""Büchersuche über mehrere Quellen (Google Books, Open Library, DNB) – zusammengeführt, dedupliziert, nach Relevanz sortiert."""
import asyncio
import re
from datetime import datetime, timezone
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from rapidfuzz import fuzz

from auth_utils import get_current_user
from database import db
from models import User
from sources import clean_isbn, dnb_search_text, find_cover, google_search, open_library_search

router = APIRouter(prefix="/search", tags=["search"])

DATAMUSE_URL = "https://api.datamuse.com/words"


def norm(text: str) -> str:
    return re.sub(r"[^a-z0-9äöüß]", "", (text or "").lower())


def item_key(item: dict) -> str:
    if item.get("isbn"):
        return f"isbn:{item['isbn']}"
    author = (item.get("authors") or [""])[0].split()[-1] if item.get("authors") else ""
    return f"t:{norm(item['title'])[:40]}:{norm(author)}"


def merge_into(base: dict, other: dict) -> dict:
    for key in ("cover_url", "page_count", "description", "publisher", "published_year", "isbn", "series_name", "series_part", "subtitle"):
        if not base.get(key) and other.get(key):
            base[key] = other[key]
    if not base.get("categories") and other.get("categories"):
        base["categories"] = other["categories"]
    if other.get("source") == "google" and base.get("source") != "google":
        base["google_id"] = other["google_id"]  # Google-ID bevorzugen (stabil, Cover per ID)
    base.setdefault("sources", []).append(other.get("source"))
    return base


def relevance(q: str, item: dict, lang: Optional[str]) -> float:
    hay = f"{item['title']} {item.get('subtitle') or ''} {' '.join(item.get('authors') or [])}".lower()
    title_score = fuzz.token_set_ratio(q.lower(), item["title"].lower())
    score = max(fuzz.token_set_ratio(q.lower(), hay), fuzz.partial_ratio(q.lower(), hay)) * 0.6 + title_score * 0.4
    if item.get("cover_url"):
        score += 6
    if lang and item.get("language") == lang:
        score += 4
    if len(item.get("sources") or []) > 1:
        score += 5
    if item.get("page_count"):
        score += 1
    return score


async def run_search(client: httpx.AsyncClient, q: str, lang: Optional[str], start: int) -> Optional[dict]:
    is_subject = q.startswith("subject:")
    tasks = [google_search(client, q, lang, start), open_library_search(client, q, lang, start)]
    if start == 0 and not is_subject:
        tasks.append(google_search(client, f"intitle:{q}", lang, 0, 10))
        tasks.append(dnb_search_text(client, q))
        if lang:
            tasks.append(google_search(client, q, None, 0, 10))  # ohne Sprachfilter – Google filtert oft zu streng
    results = await asyncio.gather(*tasks, return_exceptions=True)
    lists = [r for r in results if isinstance(r, list)]
    if not lists:
        return None
    merged: dict[str, dict] = {}
    for items in lists:
        for item in items:
            key = item_key(item)
            if key in merged:
                merge_into(merged[key], item)
            else:
                merged[key] = {**item, "sources": [item.get("source")]}
    # zweite Dedup-Runde über Titel+Autor (gleiches Buch mit anderer ISBN)
    by_title: dict[str, dict] = {}
    for item in merged.values():
        tkey = f"{norm(item['title'])[:40]}:{norm((item.get('authors') or [''])[0].split()[-1] if item.get('authors') else '')}"
        if tkey in by_title:
            merge_into(by_title[tkey], item)
        else:
            by_title[tkey] = item
    items = list(by_title.values())
    threshold = 0 if is_subject or clean_isbn(q) else 45
    scored = [(relevance(q, i, lang), i) for i in items]
    scored = [(s, i) for s, i in scored if s >= threshold]
    scored.sort(key=lambda x: -x[0])
    return {"total": len(scored), "items": [i for _, i in scored], "source": "merged"}


async def correct_spelling(client: httpx.AsyncClient, q: str) -> Optional[str]:
    words = q.split()
    if not words or q.startswith("subject:"):
        return None

    async def fix(word: str) -> str:
        if len(word) < 4 or word.isdigit():
            return word
        try:
            res = await client.get(DATAMUSE_URL, params={"sp": word, "max": 1})
            best = (res.json() or [{}])[0].get("word") if res.status_code == 200 else None
        except Exception:
            best = None
        return best if best and best.lower() != word.lower() else word

    fixed = await asyncio.gather(*(fix(w) for w in words))
    corrected = " ".join(fixed)
    return corrected if corrected.lower() != q.lower() else None


async def relaxed_search(client: httpx.AsyncClient, q: str, lang: Optional[str]) -> Optional[dict]:
    """Letzte Stufe: je ein Wort weglassen, Ergebnisse nach Ähnlichkeit zum Original filtern."""
    words = q.split()
    if len(words) < 2:
        return None
    variants = [" ".join(words[:i] + words[i + 1 :]) for i in range(len(words))]
    results = await asyncio.gather(*(run_search(client, v, lang, 0) for v in variants[:4]), return_exceptions=True)
    seen, items = set(), []
    for res in results:
        if not isinstance(res, dict):
            continue
        for item in res["items"]:
            key = item_key(item)
            hay = f"{item['title']} {' '.join(item.get('authors') or [])}"
            score = fuzz.token_set_ratio(q.lower(), hay.lower())
            if key not in seen and score >= 55:
                seen.add(key)
                items.append((score, item))
    if not items:
        return None
    items.sort(key=lambda x: -x[0])
    return {"total": len(items), "items": [i for _, i in items], "source": "fuzzy", "fuzzy": True}


@router.get("")
async def search_books(q: str = Query(min_length=1), lang: Optional[str] = None, start: int = 0, user: User = Depends(get_current_user)):
    q = q.strip()
    cache_key = {"q": q.lower(), "lang": lang or "", "start": start, "v": 2}
    cached = await db.search_cache.find_one(cache_key, {"_id": 0, "result": 1})
    if cached:
        return cached["result"]
    async with httpx.AsyncClient(timeout=15) as client:
        result = await run_search(client, q, lang, start)
        if result is not None and not result["items"] and start == 0:
            corrected = await correct_spelling(client, q)
            if corrected:
                retry = await run_search(client, corrected, lang, start)
                if retry and retry["items"]:
                    result = {**retry, "corrected": corrected}
            if not result["items"]:
                relaxed = await relaxed_search(client, q, lang)
                if relaxed:
                    result = relaxed
    if result is None:
        raise HTTPException(status_code=502, detail="Büchersuche derzeit nicht verfügbar")
    if result["items"]:
        await db.search_cache.update_one(cache_key, {"$set": {"result": result, "created_at": datetime.now(timezone.utc)}}, upsert=True)
    return result


@router.get("/cover")
async def search_cover(title: str = Query(min_length=1), author: Optional[str] = None, isbn: Optional[str] = None, google_id: Optional[str] = None, user: User = Depends(get_current_user)):
    """Cover-Doppelcheck: in allen Quellen nach einem echten Cover für Titel/Autor/ISBN suchen."""
    async with httpx.AsyncClient(timeout=15) as client:
        url = await find_cover(client, title.strip(), [author] if author else [], isbn, google_id)
    return {"cover_url": url}
